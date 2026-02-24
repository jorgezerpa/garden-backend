import { prisma } from "../lib/prisma";
import { EventType } from "../generated/prisma/client";


// @todo -> add an input "users" so get the data of a specific users list 
export const getDailyActivity = async (
  companyId: number,
  startDate: Date,
  endDate: Date
) => {
  // 1. Aggregate Call data (Talk Time and Total Calls) by Date
  // Note: We use queryRaw because grouping by a "Date" part of a "DateTime" 
  // column is more efficient in raw SQL than fetching everything and grouping in JS.
  const dailyCalls: any[] = await prisma.$queryRaw`
    SELECT 
      DATE("startAt") as "date",
      SUM("durationSeconds") as "talkTime",
      COUNT(id) as "calls"
    FROM "Call"
    WHERE "companyId" = ${companyId}
      AND "startAt" >= ${startDate}
      AND "startAt" <= ${endDate}
    GROUP BY DATE("startAt")
    ORDER BY DATE("startAt") ASC
  `;

  // 2. Aggregate FunnelEvent data (Seeds) by Date
  // We filter specifically for SEED events linked to agents in that company
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
    GROUP BY DATE(fe."timestamp")
  `;

  // 3. Merge the datasets into the final structure
  // We use the dailyCalls as the base
  return dailyCalls.map(callDay => {
    const dayString = callDay.date.toISOString().split('T')[0];
    const seedData = dailySeeds.find(s => 
      s.date.toISOString().split('T')[0] === dayString
    );

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
  schemaId: number
) => {
  // 1. Fetch the Schema with all its days and blocks
  const schema = await prisma.schema.findUnique({
    where: { id: schemaId },
    include: {
      schemaDays: {
        include: { blocks: true }
      }
    }
  });

  if (!schema) throw new Error("Schema not found");

  // 2. Fetch all calls and events in the range for this company
  const calls = await prisma.call.findMany({
    where: {
      companyId,
      startAt: { gte: startDate, lte: endDate }
    },
    include: { events: true }
  });

  // 3. Initialize the results based on the Schema structure
  // We want to return a flat list of all blocks defined in the schema
  const blockStats = schema.schemaDays.flatMap(day => 
    day.blocks.map(block => ({
      dayIndex: day.dayIndex,
      startMinutes: block.startMinutesFromMidnight,
      endMinutes: block.endMinutesFromMidnight,
      talkTime: 0,
      seeds: 0,
      sales: 0
    }))
  );

  // 4. Map calls to blocks
  calls.forEach(call => {
    // Determine the day index relative to the start date
    // (e.g., if call is on the same day as startDate, index is 0)
    const diffTime = Math.abs(call.startAt.getTime() - startDate.getTime());
    const dayIndex = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Determine minutes from midnight for the call
    const callMinutes = call.startAt.getHours() * 60 + call.startAt.getMinutes();

    // Find the matching block in the schema
    const targetBlock = blockStats.find(b => 
      b.dayIndex === dayIndex &&
      callMinutes >= b.startMinutes &&
      callMinutes < b.endMinutes
    );

    if (targetBlock) {
      targetBlock.talkTime += (call.durationSeconds / 60); // In minutes
      
      // Count events within this call
      call.events.forEach(event => {
        if (event.type === EventType.SEED) targetBlock.seeds++;
        if (event.type === EventType.SALE) targetBlock.sales++;
      });
    }
  });

  // 5. Format for the frontend
  return blockStats.map(b => ({
    blockStartTimeMinutesFromMidnight: b.startMinutes,
    blockEndTimeMinutesFromMidnight: b.endMinutes,
    talkTime: Math.round(b.talkTime),
    seeds: b.seeds,
    sales: b.sales
  }));
};

// filtered by specific dayIndex range 
export const getBlockPerformanceFiltered = async (
  companyId: number,
  startDate: Date,
  endDate: Date,
  schemaId: number,
  fromDayIndex: number,
  toDayIndex: number
) => {
  // 1. Fetch the Schema with only the requested day range
  const schema = await prisma.schema.findUnique({
    where: { id: schemaId },
    include: {
      schemaDays: {
        where: {
          dayIndex: { gte: fromDayIndex, lte: toDayIndex }
        },
        include: { blocks: true }
      }
    }
  });

  if (!schema || schema.schemaDays.length === 0) {
    throw new Error("No schema days found for the specified range.");
  }

  // 2. Fetch calls only for the date range
  const calls = await prisma.call.findMany({
    where: {
      companyId,
      startAt: { gte: startDate, lte: endDate }
    },
    include: { events: true }
  });

  // 3. Initialize results for the blocks in the requested days
  const blockStats = schema.schemaDays.flatMap(day => 
    day.blocks.map(block => ({
      dayIndex: day.dayIndex,
      startMinutes: block.startMinutesFromMidnight,
      endMinutes: block.endMinutesFromMidnight,
      talkTime: 0,
      seeds: 0,
      sales: 0,
      blockName: block.name
    }))
  );

  // 4. Map calls
  calls.forEach(call => {
    // Calculate which day index this call belongs to relative to the start of the filter
    const diffTime = call.startAt.getTime() - startDate.getTime();
    const dayIndexOffset = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // The actual schema day index we are looking for
    const targetDayIndex = dayIndexOffset; 

    // Only process if the dayIndex is within our requested sub-range
    if (targetDayIndex >= fromDayIndex && targetDayIndex <= toDayIndex) {
      const callMinutes = call.startAt.getHours() * 60 + call.startAt.getMinutes();

      const targetBlock = blockStats.find(b => 
        b.dayIndex === targetDayIndex &&
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
    }
  });

  return blockStats.map(b => ({
    dayIndex: b.dayIndex,
    blockStartTimeMinutesFromMidnight: b.startMinutes,
    blockEndTimeMinutesFromMidnight: b.endMinutes,
    blockName: b.blockName,
    talkTime: Math.round(b.talkTime * 100) / 100,
    seeds: b.seeds,
    sales: b.sales
  }));
};

// CALL DURATION
export const getLongCallDistribution = async (
  companyId: number,
  startDate: Date,
  endDate: Date
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
  endDate: Date
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
  endDate: Date
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
    { name: 'Callbacks', value: getCount(EventType.CALLBACK) },
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
  endDate: Date
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
    LEFT JOIN "FunnelEvent" fe_callback ON fe_callback."callId" = c.id AND fe_callback."type" = ${EventType.CALLBACK}
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