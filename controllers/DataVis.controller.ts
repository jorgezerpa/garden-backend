import { prisma } from "../lib/prisma";
import { Prisma, EventType, BlockType, WEEK_DAYS } from "../generated/prisma/client";

export const getLastRegister = async (companyId: number) => {
  const lastCall = await prisma.call.findFirst({
    where: {
      companyId: companyId,
    },
    orderBy: {
      startAt: "desc",
    },
    select: {
      startAt: true,
    },
  });

  return {
    // Returns the ISO string date or null if no calls exist
    lastCallDate: lastCall?.startAt || null,
  };
};

export const getGeneralInsights = async (
  companyId: number,
  startDate: Date,
  endDate: Date,
  filters: { agents: number[] }
) => {
  // 1. Common Filter for Agent IDs
  const agentFilter = filters.agents?.length > 0 ? { in: filters.agents } : undefined;

  // 2. Aggregate Call Data (TalkTime, Total Calls, Avg Duration)
  const callMetrics = await prisma.call.aggregate({
    where: {
      companyId,
      startAt: { gte: startDate, lte: endDate },
      agentId: agentFilter,
    },
    _sum: {
      durationSeconds: true,
    },
    _count: {
      id: true,
    },
    _avg: {
      durationSeconds: true,
    },
  });

  // 3. Aggregate Funnel Events (Seeds, Leads, Sales)
  const eventCounts = await prisma.funnelEvent.groupBy({
    by: ['type'],
    where: {
      agent: { companyId },
      agentId: agentFilter,
      timestamp: { gte: startDate, lte: endDate },
    },
    _count: {
      id: true,
    },
  });

  // Helper to extract count from grouped results
  const getEventCount = (type: EventType) => 
    eventCounts.find((e) => e.type === type)?._count.id || 0;

  const totalSeeds = getEventCount(EventType.SEED);
  const totalLeads = getEventCount(EventType.LEAD);
  const totalSales = getEventCount(EventType.SALE);
  
  const totalCalls = callMetrics._count.id || 0;
  const totalTalkTime = callMetrics._sum.durationSeconds || 0;
  const avgCallDuration = Math.round(callMetrics._avg.durationSeconds || 0);

  // 4. Calculate Conversion Rate (Seeds to Sales)
  // Formula: (Sales / Seeds) * 100
  const conversionRate = totalSeeds > 0 
    ? parseFloat(((totalSales / totalSeeds) * 100).toFixed(2)) 
    : 0;

  return {
    totalTalkTime,      // In seconds
    totalCalls,
    totalSeeds,
    totalLeads,
    totalSales,
    conversionRate,     // Percentage
    avgCallDuration,    // In seconds
  };
};

export const getDailyActivity = async (
  companyId: number,
  startDate: Date,
  endDate: Date,
  filters: { agents: number[] }
) => {
  // 1. Prepare the Dynamic Filter for Agents
  // If agents array is empty, we use a "1=1" style true condition or skip it.
  const agentFilter = filters.agents && filters.agents.length > 0 
    ? Prisma.sql`AND "agentId" IN (${Prisma.join(filters.agents)})` 
    : Prisma.empty;

  // For the Seed query, we need to prefix the column with the table alias 'fe'
  const seedAgentFilter = filters.agents && filters.agents.length > 0 
    ? Prisma.sql`AND fe."agentId" IN (${Prisma.join(filters.agents)})` 
    : Prisma.empty;

  // 2. Aggregate Call data
  const dailyCalls: any[] = await prisma.$queryRaw`
    SELECT 
      DATE("startAt") as "date",
      SUM("durationSeconds") as "talkTime",
      COUNT(id) as "calls"
    FROM "Call"
    WHERE "companyId" = ${companyId}
      AND "startAt" >= ${startDate}
      AND "startAt" <= ${endDate}
      ${agentFilter}
    GROUP BY DATE("startAt")
    ORDER BY DATE("startAt") ASC
  `;

  // 3. Aggregate FunnelEvent data (Seeds)
  const dailySeeds: any[] = await prisma.$queryRaw`
    SELECT 
      DATE(fe."timestamp") as "date",
      COUNT(fe.id) as "seeds"
    FROM "FunnelEvent" fe
    JOIN "Agent" a ON fe."agentId" = a.id
    WHERE a."companyId" = ${companyId}
      AND fe."type" = ${EventType.SEED}
      AND fe."timestamp" >= ${startDate}
      AND fe."timestamp" <= ${endDate}
      ${seedAgentFilter}
    GROUP BY DATE(fe."timestamp")
  `;


  // 4. Merge the datasets
  return dailyCalls.map(callDay => {
    // Note: Some SQL drivers return "date" as a string or a Date object. 
    // Ensuring it's a Date object before calling toISOString.
    const dateObj = new Date(callDay.date);
    const dayString = dateObj.toISOString().split('T')[0];
    
    const seedData = dailySeeds.find(s => {
      const sDateObj = new Date(s.date);
      return sDateObj.toISOString().split('T')[0] === dayString;
    });

    return {
      date: dayString,
      talkTime: Number(callDay.talkTime) || 0,
      calls: Number(callDay.calls) || 0,
      seeds: Number(seedData?.seeds) || 0
    };
  });
};


// BLOCK VIEWS 
export const getBlockPerformance = async (
  companyId: number,
  startDate: Date,
  endDate: Date,
  schemaId: number,
  filters: { days: boolean[]; types: boolean[], agents: number[] }
) => {

  // 1. Map the 'types' boolean array to BlockType enums
  // Index 0: WORKING, 1: REST, 2: EXTRA_TIME
  const activeBlockTypes: BlockType[] = [];
  if (filters.types[0]) activeBlockTypes.push(BlockType.WORKING);
  if (filters.types[1]) activeBlockTypes.push(BlockType.REST);
  if (filters.types[2]) activeBlockTypes.push(BlockType.EXTRA_TIME);

  // 2. Fetch the Schema with the day and block filters applied at the DB level where possible
  const schema = await prisma.schema.findUnique({
    where: { id: schemaId },
    include: {
      schemaDays: {
        include: {
          blocks: {
            // Filter by block type (Working/Rest/Extra)
            where: { blockType: { in: activeBlockTypes } }
          }
        }
      }
    }
  });

  if (!schema) throw new Error("Schema not found");

  // 3. Fetch all calls (we fetch all in range, then map them to the allowed filtered blocks)
  const activeDays: WEEK_DAYS[] = [];
  if (filters.days[0]) activeDays.push(WEEK_DAYS.MONDAY);
  if (filters.days[1]) activeDays.push(WEEK_DAYS.TUESDAY);
  if (filters.days[2]) activeDays.push(WEEK_DAYS.WEDNESDAY);
  if (filters.days[3]) activeDays.push(WEEK_DAYS.THURSDAY);
  if (filters.days[4]) activeDays.push(WEEK_DAYS.FRIDAY);
  if (filters.days[5]) activeDays.push(WEEK_DAYS.SATURDAY);
  if (filters.days[6]) activeDays.push(WEEK_DAYS.SUNDAY);
  
  const calls = await prisma.call.findMany({
    where: {
      companyId,
      startAt: { gte: startDate, lte: endDate },
      dayOfTheWeek: {
        in: activeDays // Prisma will generate: WHERE "dayOfTheWeek" IN ('MONDAY', 'TUESDAY'...)
      },
      agentId: {
        in: filters.agents?.length > 0 ? filters.agents : undefined
      }
    },
    include: { events: true }
  });

  // 4. Initialize the results (Flat list of valid blocks)
  const blockStats = schema.schemaDays.flatMap(day =>
    day.blocks.map(block => ({
      id: block.id,
      dayIndex: day.dayIndex,
      startMinutes: block.startMinutesFromMidnight,
      endMinutes: block.endMinutesFromMidnight,
      type: block.blockType,
      talkTime: 0,
      seeds: 0,
      sales: 0
    }))
  );

  // 5. Map calls to the filtered blocks
  calls.forEach(call => {
    // Determine the day of the week (0-6)
    // Note: getDay() returns 0 for Sunday, 1 for Monday. 
    // If your dayIndex 0 is Monday, we adjust:
    const rawDay = call.startAt.getDay(); 
    const dayIndex = rawDay === 0 ? 6 : rawDay - 1; 

    // Skip call if this day is filtered out
    if (!filters.days[dayIndex]) return;

    const callMinutes = call.startAt.getHours() * 60 + call.startAt.getMinutes();

    // Find the target block among the allowed blocks
    const targetBlock = blockStats.find(b => 
      callMinutes >= b.startMinutes &&
      callMinutes < b.endMinutes
    );
    
    if (targetBlock) {
      targetBlock.talkTime += (call.durationSeconds / 60);
      
      call.events.forEach(event => {
        if (event.type === EventType.SEED) targetBlock.seeds++;
        if (event.type === EventType.SALE) targetBlock.sales++;
      });
    }
  });

  // 6. Final Formatting for Frontend
  // We sort by dayIndex then startMinutes to ensure the chart flow is logical
  return blockStats
    .sort((a, b) => a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes)
    .map(b => ({
      blockStartTimeMinutesFromMidnight: b.startMinutes,
      blockEndTimeMinutesFromMidnight: b.endMinutes,
      talkTime: Math.round(b.talkTime),
      seeds: b.seeds,
      sales: b.sales,
      dayIndex: b.dayIndex,
      type: b.type
    }));
};

// CALL DURATION
export const getLongCallDistribution = async (
  companyId: number,
  startDate: Date,
  endDate: Date,
  filters: { agents: number[] }
) => {
  // 1. Prepare conditional SQL fragment
  const agentFilter = filters.agents && filters.agents.length > 0 
    ? Prisma.sql`AND "agentId" IN (${Prisma.join(filters.agents)})` 
    : Prisma.empty;

  // 2. Execute query with the dynamic filter injected
  const distribution: any[] = await prisma.$queryRaw`
    SELECT 
      CASE 
        WHEN "durationSeconds" < 60 THEN '0-1 min'
        WHEN "durationSeconds" >= 60 AND "durationSeconds" < 180 THEN '1-3 min'
        WHEN "durationSeconds" >= 180 AND "durationSeconds" < 300 THEN '3-5 min'
        WHEN "durationSeconds" >= 300 AND "durationSeconds" < 600 THEN '5-10 min'
        ELSE '10+ min'
      END as "range",
      COUNT(*) as "count",
      CASE 
        WHEN "durationSeconds" < 60 THEN 1
        WHEN "durationSeconds" >= 60 AND "durationSeconds" < 180 THEN 2
        WHEN "durationSeconds" >= 180 AND "durationSeconds" < 300 THEN 3
        WHEN "durationSeconds" >= 300 AND "durationSeconds" < 600 THEN 4
        ELSE 5
      END as "sortOrder"
    FROM "Call"
    WHERE "companyId" = ${companyId}
      AND "startAt" >= ${startDate}
      AND "startAt" <= ${endDate}
      ${agentFilter}
    GROUP BY "range", "sortOrder"
    ORDER BY "sortOrder" ASC
  `;

  return distribution.map(row => ({
    range: row.range,
    count: Number(row.count)
  }));
};

// HEATMAP yearly divided by days. 
// Calculating intensity based on the number of seeds for a specific year
// The intensity level (0-4) is determined by where the daily seed count falls within the range of the minimum and maximum seed counts found in the period.
export const getSeedTimelineHeatmap = async (
  companyId: number,
  year: number,
  filters: { agents: number[] }
) => {
  // 1. Define the full year range
  const startDate = new Date(year, 0, 1); // Jan 1st
  const endDate = new Date(year, 11, 31, 23, 59, 59); // Dec 31st

  // 2. SQL Filter
  const agentFilter = filters.agents && filters.agents.length > 0 
    ? Prisma.sql`AND c."agentId" IN (${Prisma.join(filters.agents)})` 
    : Prisma.empty;

  // 3. Fetch data
  const dailyData: any[] = await prisma.$queryRaw`
    SELECT 
      DATE(c."startAt") as "date",
      COUNT(fe.id) as "seeds"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe ON fe."callId" = c.id AND fe."type" = ${EventType.SEED}
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate}
      AND c."startAt" <= ${endDate}
      ${agentFilter}
    GROUP BY DATE(c."startAt")
    ORDER BY DATE(c."startAt") ASC
  `;

  // 4. Create a Map of existing data for quick lookup
  // We use date strings as keys to avoid timezone comparison headaches
  const dataMap = new Map(
    dailyData.map(d => [new Date(d.date).toISOString().split('T')[0], Number(d.seeds)])
  );

  // 5. Determine Min/Max for scaling (from the existing data only)
  const seedValues = Array.from(dataMap.values());
  const minSeeds = seedValues.length > 0 ? Math.min(...seedValues) : 0;
  const maxSeeds = seedValues.length > 0 ? Math.max(...seedValues) : 0;

const calculateLevel = (val: number, min: number, max: number): number => {
  // If there are no seeds, intensity is always 0
  if (val === 0) return 0;

  // If max and min are the same but val > 0, it means all active days 
  // have the same count. We return a mid-to-high intensity (e.g., level 2 or 3).
  if (max === min) return 2; 

  const range = max - min;
  
  // Normalizing the value: (val - min) / range gives a 0.0 to 1.0 scale
  // Multiplying by 4 (to get 0, 1, 2, 3, 4) or 5 (then floor)
  const level = Math.floor(((val - min) / range) * 5);

  // Ensure we stay within 0-4 bounds
  return Math.max(1, Math.min(level, 4)); 
};

  // 6. Generate the full year array (Backfilling)
  const fullYearData = [];
  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const seeds = dataMap.get(dateStr) || 0;
    
    fullYearData.push({
      date: dateStr,
      intensity: calculateLevel(seeds, minSeeds, maxSeeds),
      seeds: seeds
    });

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return fullYearData;
};

export const getSeedTimelineHeatmapPerDay = async (
  companyId: number,
  targetDate: String,
  filters: { agents: number[] }
) => {
  // 1. Explicitly parse the YYYY-MM-DD string to avoid timezone shifts
  // This ensures we are looking at the 24h window of that specific calendar date
  const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

  // 2. Prepare conditional SQL fragment
  const agentFilter = filters.agents && filters.agents.length > 0 
    ? Prisma.sql`AND c."agentId" IN (${Prisma.join(filters.agents)})` 
    : Prisma.empty;

  // 3. Fetch hourly seeds (Added explicit casting for Enum)
  const hourlyData: { hour: number; seeds: number }[] = await prisma.$queryRaw`
    SELECT 
      EXTRACT(HOUR FROM (c."startAt"::timestamp)) as "hour",
      COUNT(fe.id) as "seeds"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe ON fe."callId" = c.id 
      AND fe."type" = ${EventType.SEED}::"EventType"
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startOfDay}
      AND c."startAt" <= ${endOfDay}
      ${agentFilter}
    GROUP BY "hour"
    ORDER BY "hour" ASC
  `;

  // 4. Map results
  const hourMap = new Map(hourlyData.map(d => [Number(d.hour), Number(d.seeds)]));
  // 5. Scaling logic
  const seedValues = Array.from(hourMap.values());
  const maxSeeds = seedValues.length > 0 ? Math.max(...seedValues) : 0;

  const calculateLevel = (val: number, max: number): number => {
    if (val === 0) return 0;
    // If there is only 1 seed or max is same as val, give it a visible intensity
    if (max === 0 || val === max) return 3; 
    
    const level = Math.floor((val / max) * 5);
    // Ensure that if there's at least 1 seed, intensity is at least 1
    return Math.max(1, Math.min(level, 4));
  };

  // 6. Generate 24-hour array
  return Array.from({ length: 24 }, (_, hour) => {
    const seeds = hourMap.get(hour) || 0;
    
    return {
      hour: hour,
      intensity: calculateLevel(seeds, maxSeeds),
      seeds: seeds,
      label: `${hour.toString().padStart(2, '0')}:00`
    };
  });
};

// FUNNEL RATIOS AND SUMS
export const getConversionFunnel = async (
  companyId: number,
  startDate: Date,
  endDate: Date,
  filters: { agents: number[] }
) => {
  // We use groupBy on the FunnelEvent table.
  // We filter by companyId by joining with the Agent table.
  const eventCounts = await prisma.funnelEvent.groupBy({
    by: ['type'],
    where: {
      agent: {
        companyId: companyId,
      },
      agentId: {
        in: filters.agents?.length > 0 ? filters.agents : undefined
      },
      timestamp: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: {
      id: true
    }
  });

  // Helper to find count for a specific type
  const getCount = (type: EventType) => {
    return eventCounts.find(e => e.type === type)?._count.id || 0;
  };

  // Map to the specific order and structure required for a Funnel Chart
  // Usually, funnels are ordered: Seed -> Callback -> Lead -> Sale
  return [
    { name: 'Seeds', value: getCount(EventType.SEED) },
    // { name: 'Callbacks', value: getCount(EventType.CALLBACK) },
    { name: 'Leads', value: getCount(EventType.LEAD) },
    { name: 'Sales', value: getCount(EventType.SALE) },
  ];
};

// STREAKS 
// you go as: seeds score = (currentSeeds/goalSeeds)*100, (currentCallbacks/goalCallabcks)*100... and so on for each value. The final score will be the average of all calculated scores. 
export const getConsistencyHistory = async (
  goalId: number,
  companyId: number,
  startDate: Date,
  endDate: Date,
  filters: { agents: number[], days: boolean[] }
) => {
  // 1. Fetch the benchmark goals
  const goal = await prisma.temporalGoals.findUnique({
    where: { id: goalId }
  });

  if (!goal) throw new Error("Target goal not found");

  const dayEnumMap: WEEK_DAYS[] = [
    WEEK_DAYS.MONDAY,
    WEEK_DAYS.TUESDAY,
    WEEK_DAYS.WEDNESDAY,
    WEEK_DAYS.THURSDAY,
    WEEK_DAYS.FRIDAY,
    WEEK_DAYS.SATURDAY,
    WEEK_DAYS.SUNDAY,
  ];

  const activeDays = dayEnumMap.filter((_, index) => filters.days[index]);

  // 2. Prepare the Agent Filter
  const agentFilter = filters.agents && filters.agents.length > 0 
    ? Prisma.sql`AND c."agentId" IN (${Prisma.join(filters.agents)})` 
    : Prisma.empty;

    // Filter by the dayOfTheWeek column using the activeDays array
  const dayFilter = activeDays.length > 0
    ? Prisma.sql`AND c."dayOfTheWeek" IN (${Prisma.join(activeDays)})`
    : Prisma.empty;

  // 3. Fetch daily performance stats
  const dailyStats: any[] = await prisma.$queryRaw`
    SELECT 
      DATE(c."startAt") as "date",
      SUM(c."durationSeconds") / 60.0 as "talkTime",
      COUNT(c.id) as "calls",
      COUNT(fe_seed.id) as "seeds",
      COUNT(fe_lead.id) as "leads",
      COUNT(fe_sale.id) as "sales"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe_seed ON fe_seed."callId" = c.id AND fe_seed."type" = ${EventType.SEED}
    LEFT JOIN "FunnelEvent" fe_lead ON fe_lead."callId" = c.id AND fe_lead."type" = ${EventType.LEAD}
    LEFT JOIN "FunnelEvent" fe_sale ON fe_sale."callId" = c.id AND fe_sale."type" = ${EventType.SALE}
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate}
      AND c."startAt" <= ${endDate}
      ${agentFilter}
      ${dayFilter}
    GROUP BY DATE(c."startAt")
    ORDER BY DATE(c."startAt") ASC
  `;

  // 4. Calculation logic
  return dailyStats.map(day => {
    const scores: number[] = [];

    const addScore = (current: number, target: number | null) => {
      // Ensure target exists and is greater than 0
      if (target && target > 0) {
        const s = (current / target) * 100;
        scores.push(Math.min(s, 100));
      }
    };

    addScore(Number(day.talkTime), goal.talkTimeMinutes);
    addScore(Number(day.seeds), goal.seeds);
    addScore(Number(day.leads), goal.leads);
    addScore(Number(day.sales), goal.sales);
    addScore(Number(day.calls), goal.numberOfCalls);

    const finalScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
      : 0;

    return {
      // Robust date extraction to handle potential string/Date return types
      day: new Date(day.date).toISOString().split('T')[0].split('-')[2],
      score: finalScore
    };
  });
};