import { prisma } from "../lib/prisma";
import { Prisma, EventType, BlockType, WEEK_DAYS } from "../generated/prisma/client";

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
  // We use queryRaw because grouping by custom ranges (bins) 
  // is much faster in SQL than fetching every call record.
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
    GROUP BY "range", "sortOrder"
    ORDER BY "sortOrder" ASC
  `;

  // Format the output to ensure numbers are not returned as BigInt strings
  return distribution.map(row => ({
    range: row.range,
    count: Number(row.count)
  }));
};


// HEATMAP
// @todo make another of this but: by hours instead of days and add a filter by users on both
// You take the min and max values of each and divide the difference by the 5 levels of intensity, so the intensity will the current cluster in which the value is. More specifically, calc. the intesity of seeds, then the intesity of talk time, and the avg of both is the intensity seeing here. 
// @todo this shoould be taked from which calculation? maybe from goals? maybe both and a toggle of intensityType on params?
export const getSeedTimelineHeatmap = async (
  companyId: number,
  startDate: Date,
  endDate: Date,
  filters: { agents: number[] }
) => {
  // 1. Fetch daily talkTime and seeds using raw SQL for efficiency
  const dailyData: any[] = await prisma.$queryRaw`
    SELECT 
      DATE(c."startAt") as "date",
      SUM(c."durationSeconds") / 60.0 as "talkTime",
      COUNT(fe.id) as "seeds"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe ON fe."callId" = c.id AND fe."type" = ${EventType.SEED}
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate}
      AND c."startAt" <= ${endDate}
    GROUP BY DATE(c."startAt")
    ORDER BY DATE(c."startAt") ASC
  `;

  if (dailyData.length === 0) return [];

  // 2. Extract values to find Min/Max for scaling intensity
  const talkTimeValues = dailyData.map(d => Number(d.talkTime));
  const seedValues = dailyData.map(d => Number(d.seeds));

  const minTalk = Math.min(...talkTimeValues);
  const maxTalk = Math.max(...talkTimeValues);
  const minSeeds = Math.min(...seedValues);
  const maxSeeds = Math.max(...seedValues);

  // Helper to calculate intensity (0-4)
  const calculateLevel = (val: number, min: number, max: number): number => {
    if (max === min) return 0;
    const step = (max - min) / 5;
    const level = Math.floor((val - min) / step);
    return Math.min(level, 4); // Ensure it doesn't exceed 4
  };

  // 3. Map the data and calculate average intensity
  return dailyData.map(day => {
    const talkIntensity = calculateLevel(Number(day.talkTime), minTalk, maxTalk);
    const seedIntensity = calculateLevel(Number(day.seeds), minSeeds, maxSeeds);
    
    // Average intensity of both metrics
    const avgIntensity = Math.round((talkIntensity + seedIntensity) / 2);

    return {
      date: day.date,
      intensity: avgIntensity,
      seeds: Number(day.seeds),
      talkTime: Math.round(Number(day.talkTime))
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
        companyId: companyId
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
  filters: { agents: number[] }
) => {
  // 1. Fetch the benchmark goals
  const goal = await prisma.temporalGoals.findUnique({
    where: { id: goalId }
  });

  if (!goal) throw new Error("Target goal not found");

  // 2. Fetch daily performance stats
  // We need: talkTime, seeds, callbacks, leads, sales, and totalCalls
  const dailyStats: any[] = await prisma.$queryRaw`
    SELECT 
      DATE(c."startAt") as "date",
      SUM(c."durationSeconds") / 60.0 as "talkTime",
      COUNT(c.id) as "calls",
      COUNT(fe_seed.id) as "seeds",
      COUNT(fe_callback.id) as "callbacks",
      COUNT(fe_lead.id) as "leads",
      COUNT(fe_sale.id) as "sales"
    FROM "Call" c
    LEFT JOIN "FunnelEvent" fe_seed ON fe_seed."callId" = c.id AND fe_seed."type" = ${EventType.SEED}
    LEFT JOIN "FunnelEvent" fe_lead ON fe_lead."callId" = c.id AND fe_lead."type" = ${EventType.LEAD}
    LEFT JOIN "FunnelEvent" fe_sale ON fe_sale."callId" = c.id AND fe_sale."type" = ${EventType.SALE}
    WHERE c."companyId" = ${companyId}
      AND c."startAt" >= ${startDate}
      AND c."startAt" <= ${endDate}
    GROUP BY DATE(c."startAt")
    ORDER BY DATE(c."startAt") ASC
  `;

  // 3. Calculation logic
  return dailyStats.map(day => {
    const scores: number[] = [];

    // Helper to calculate individual metric score
    const addScore = (current: number, target: number) => {
      if (target > 0) {
        const s = (current / target) * 100;
        scores.push(Math.min(s, 100)); // Cap at 100 for consistency streak view
      }
    };

    addScore(Number(day.talkTime), goal.talkTimeMinutes);
    addScore(Number(day.seeds), goal.seeds);
    addScore(Number(day.callbacks), goal.callbacks);
    addScore(Number(day.leads), goal.leads);
    addScore(Number(day.sales), goal.sales);
    addScore(Number(day.calls), goal.numberOfCalls);

    // Final score is the average of active goal metrics
    const finalScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
      : 0;

    return {
      day: day.date.toISOString().split('T')[0].split('-')[2], // Extracts 'DD'
      score: finalScore
    };
  });
};