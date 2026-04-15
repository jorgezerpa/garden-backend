import { prisma } from "../lib/prisma";
import { EventType } from "../generated/prisma/client";
import { getDailyWeekBoundariesInUTC, getDayBoundariesInUTC, getYYYYMMDD, getZonedLocalTime } from "../utils/date";

export const getAgentPerformanceReport = async (
  companyId: number,
  date: string, // YYYYMMDD
  timeGap: `weekly`|`daily`,
  page: number = 1,
  size: number = 10
) => {  
  let startDate: Date = new Date()
  let endDate: Date = new Date()
  
  if(timeGap=="daily") {
    const boundaries = getDayBoundariesInUTC(date, "Europe/Amsterdam")
    startDate = boundaries.startDate
    endDate = boundaries.endDate
  }
  if(timeGap=="weekly") {
    const boundaries = getDailyWeekBoundariesInUTC(date, "Europe/Amsterdam") 
    startDate = boundaries[0].startDate
    endDate = boundaries[boundaries.length - 1].endDate
  }
  
  const offset = (page - 1) * size;

  /**
   * We use a Raw Query to:
   * 1. Join Agents with their current Level (till is null).
   * 2. Left join with Calls and FunnelEvents within the date range.
   * 3. Group by Agent to get sums/counts.
   * 4. Calculate a 'performance_score' for sorting.
   */
  const report: any[] = await prisma.$queryRaw`
    SELECT 
      a.id,
      a.name,
      a."profileImg",
      COALESCE(al.level, 3) as "currentLevel", -- Default to 3 (Bronze) if no level found
      SUM(COALESCE(c."durationSeconds", 0)) as "totalCallingTime",
      COUNT(DISTINCT CASE WHEN fe.type = ${EventType.SEED} THEN fe.id END) as "totalSeeds",
      COUNT(DISTINCT CASE WHEN fe.type = ${EventType.SALE} THEN fe.id END) as "totalSales",
      -- Formula: (CallingTime + Seeds + Sales) / 3
      (
        SUM(COALESCE(c."durationSeconds", 0)) + 
        COUNT(DISTINCT CASE WHEN fe.type = ${EventType.SEED} THEN fe.id END) + 
        COUNT(DISTINCT CASE WHEN fe.type = ${EventType.SALE} THEN fe.id END)
      ) / 3.0 as "performanceScore"
    FROM "Agent" a
    -- Get current level
    LEFT JOIN "AgentLevel" al ON al."agentId" = a.id AND al.till IS NULL
    -- Join Calls in range
    LEFT JOIN "Call" c ON c."agentId" = a.id 
      AND c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate} 
      AND c."startAt" <= ${endDate}
    -- Join FunnelEvents in range
    LEFT JOIN "FunnelEvent" fe ON fe."agentId" = a.id 
      AND fe.timestamp >= ${startDate} 
      AND fe.timestamp <= ${endDate}
    WHERE a."companyId" = ${companyId}
    GROUP BY a.id, a.name, al.level
    ORDER BY "performanceScore" DESC
    LIMIT ${size}
    OFFSET ${offset}
  `;

  // Get total count for pagination metadata
  const totalAgents = await prisma.agent.count({ where: { companyId } });

  const data: {
    id: number,
    name: string,
    callingTime: number,
    seeds: number,
    sales: number,
    currentLevel: any, // @todo use level type gold, silver or bronze
    averageScore: number,
    profileImg: any, // @todo use real type
    direction: "static"|"asc"|"desc" // static|ascending|descending
  }[] = report.map(item => ({
    id: item.id,
    name: item.name,
    callingTime: Number(item.totalCallingTime),
    seeds: Number(item.totalSeeds),
    sales: Number(item.totalSales),
    currentLevel: item.currentLevel,
    averageScore: parseFloat(Number(item.performanceScore).toFixed(2)),
    profileImg: item.profileImg,
    direction: "static" 
  }))


  return {
    data,
    meta: {
      totalAgents,
      totalPages: Math.ceil(totalAgents / size),
      currentPage: page
    }
  };
};



export const getTeamHeatScore = async (
  companyId: number,
  dateStr: string, // yymmdd
  config: { IANA:string }
) => {
  const targetDate = new Date(`${dateStr}T00:00:00.000Z`);
  const dayBoundaries = getDayBoundariesInUTC(dateStr, config.IANA)
  const startDate = dayBoundaries.startDate
  const endDate = dayBoundaries.endDate

  // 1. Fetch the Goals assigned for this specific day/company
  const goalAssignation = await prisma.goalsAssignation.findUnique({
    where: {
      companyId_date: {
        companyId,
        date: targetDate,
      },
    },
    include: { goal: true },
  });

  // If no goals are set, we can't calculate heat against a target. 
  // We return 0 or a default, but here we'll use a fallback or handle gracefully.
  if (!goalAssignation) {
    return {
      heatScore: 0,
      message: "No goals assigned for this date.",
      metrics: null
    };
  }

  const targets = goalAssignation.goal;

  /**
   * 2. Aggregate Actual Performance for the team on that day
   * We count total calls, duration, seeds, sales, and leads.
   */
  const actuals: any[] = await prisma.$queryRaw`
    SELECT 
      COUNT(c.id)::float as "totalCalls",
      SUM(COALESCE(c."durationSeconds", 0))::float as "totalDuration",
      COUNT(CASE WHEN fe.type = ${EventType.SEED} THEN 1 END)::float as "totalSeeds",
      COUNT(CASE WHEN fe.type = ${EventType.SALE} THEN 1 END)::float as "totalSales",
      COUNT(CASE WHEN fe.type = ${EventType.LEAD} THEN 1 END)::float as "totalLeads"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe ON fe."callId" = c.id
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate}
      AND c."startAt" <= ${endDate}
  `;

  const fc = await prisma.call.findFirst({ where: { companyId } })
  const stats = actuals[0];
  
  /**
   * 3. Calculate Heat Score
   * We calculate the percentage of completion for each metric.
   * We use weights to give "Sales" or "Seeds" more importance in the "Heat".
   */
  const weights = {
    calls: 0.10,
    time: 0.20,
    seeds: 0.25,
    leads: 0.15,
    sales: 0.30
  };

  const calcProgress = (actual: number, target: number) => {
    if (target <= 0) return 1; // If no goal set, consider it met
    return Math.min(actual / target, 1.2); // Cap individual contribution at 120%
  };

  const callProgress = calcProgress(Number(stats.totalCalls), targets.numberOfCalls);
  const timeProgress = calcProgress(Number(stats.totalDuration) / 60, targets.talkTimeMinutes);
  const seedProgress = calcProgress(Number(stats.totalSeeds), targets.seeds);
  const leadProgress = calcProgress(Number(stats.totalLeads), targets.leads);
  const saleProgress = calcProgress(Number(stats.totalSales), targets.sales);

  const weightedScore = (
    (callProgress * weights.calls) +
    (timeProgress * weights.time) +
    (seedProgress * weights.seeds) +
    (leadProgress * weights.leads) +
    (saleProgress * weights.sales)
  ) * 100;

  return {
    heatScore: Math.round(Math.min(weightedScore, 100)), // Cap final score at 100
    details: {
      actual: {
        calls: Number(stats.totalCalls),
        minutes: Math.round(Number(stats.totalDuration) / 60),
        seeds: Number(stats.totalSeeds),
        leads: Number(stats.totalLeads),
        sales: Number(stats.totalSales)
      },
      targets: {
        calls: targets.numberOfCalls,
        minutes: targets.talkTimeMinutes,
        seeds: targets.seeds,
        leads: targets.leads,
        sales: targets.sales
      }
    }
  };
};
/*
Why this logic?
Relative vs. Absolute: A team of 50 making 100 calls is "cold," but a team of 2 making 100 calls is "on fire." By using the TemporalGoals table, the score is always relative to what the Manager expected for that day.
Weighting: I've assigned higher weights to Sales (30%) and Seeds (25%) because those are high-value events. Raw Call Count (10%) matters less than the quality of the outcomes.
The "Cap": I capped individual metrics at 1.2 (120%). This prevents a massive over-performance in just one area (like making 1,000 short calls) from artificially inflating the heat score to 100 if no sales were made.
SQL Efficiency: It uses a single raw query with a LEFT JOIN to fetch all performance counts in one database trip.
*/