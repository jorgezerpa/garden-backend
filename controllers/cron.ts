import { prisma } from "../lib/prisma";
import { EventType } from "../generated/prisma/client";

// TEMPORAL HELPER TILL WE IMPLEMENT THE CRON JOB ON THE SERVER 

/**
 * Reconciles agent levels based on call duration from the last 7 days.
 * 1. Calculates target levels.
 * 2. Compares with current active levels.
 * 3. Closes old levels and inserts new ones if a change is detected.
 */
//  TODO this should -> find current "since", calculate level for each week, create the register for each one
// so, even if manager forget updates by weeks, this will work. (NOT consider current week)
export const updateLevels = async (companyId: number, thresholdGold: number, thresholdSilver: number) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getDate() - 7);

  return await prisma.$transaction(async (tx) => {
    // 1. Get weekly stats for all agents who had calls
    const weeklyStats = await tx.call.groupBy({
      by: ['agentId'],
      where: {
        companyId,
        startAt: { gte: sevenDaysAgo },
      },
      _sum: {
        durationSeconds: true,
      },
    });

    const updates = [];

    for (const stat of weeklyStats) {
      const totalDuration = stat._sum.durationSeconds || 0;
      const agentId = stat.agentId;

      // Determine what the level SHOULD be
      let calculatedLevel = 3; // Default Bronze
      if (totalDuration >= thresholdGold) {
        calculatedLevel = 1; // Gold
      } else if (totalDuration >= thresholdSilver) {
        calculatedLevel = 2; // Silver
      }

      // 2. Fetch the current active level for this agent
      const currentLevelRow = await tx.agentLevel.findFirst({
        where: {
          agentId: agentId,
          till: null,
        },
      });

      // 3. Check if level has changed (or if no level exists yet)
      if (!currentLevelRow || currentLevelRow.level !== calculatedLevel) {
        const now = new Date();

        // If an old level exists, close it
        if (currentLevelRow) {
          const since = new Date(currentLevelRow.since);
          const diffInMs = now.getTime() - since.getTime();
          const weeks = diffInMs / (1000 * 60 * 60 * 24 * 7);

          await tx.agentLevel.update({
            where: { id: currentLevelRow.id },
            data: {
              till: now,
              durationInWeeks: weeks,
            },
          });
        }

        // 4. Insert the new level record
        await tx.agentLevel.create({
          data: {
            agentId: agentId,
            level: calculatedLevel,
            since: now,
            till: null,
            durationInWeeks: 0,
          },
        });
        
        updates.push({ agentId, oldLevel: currentLevelRow?.level, newLevel: calculatedLevel });
      }
    }

    return {
      success: true,
      agentsUpdated: updates.length,
      details: updates,
    };
  });
};



export const getHistoricalLevels = async (companyId: number, from: string, to: string) => {
  const startDate = new Date(from);
  const endDate = new Date(to);
  const now = new Date();

  const records = await prisma.agentLevel.findMany({
    where: {
      agent: { companyId },
      since: { lt: endDate },
      OR: [
        { till: null },
        { till: { gt: startDate } }
      ]
    },
    select: {
      agentId: true,
      level: true,
      since: true,
      till: true,
    }
  });

  // Aggregation object including currentLevel
  const aggregation: Record<number, { 
    agentId: number, 
    level1: number, 
    level2: number, 
    level3: number, 
    currentLevel: number | null 
  }> = {};

  for (const record of records) {
    if (!aggregation[record.agentId]) {
      aggregation[record.agentId] = { 
        agentId: record.agentId, 
        level1: 0, 
        level2: 0, 
        level3: 0, 
        currentLevel: null 
      };
    }

    // Identify current level (where till is null)
    if (record.till === null) {
      aggregation[record.agentId].currentLevel = record.level;
    }

    // Determine the effective boundaries for the requested range
    const effectiveStart = record.since < startDate ? startDate : record.since;
    const actualTill = record.till ?? now;
    const effectiveEnd = actualTill > endDate ? endDate : actualTill;

    const diffInMs = effectiveEnd.getTime() - effectiveStart.getTime();
    
    if (diffInMs > 0) {
      const weeks = diffInMs / (1000 * 60 * 60 * 24 * 7);
      const levelKey = `level${record.level}` as 'level1' | 'level2' | 'level3';
      
      aggregation[record.agentId][levelKey] += weeks;
    }
  }

  return Object.values(aggregation).map(item => ({
    agentId: item.agentId,
    currentLevel: item.currentLevel,
    totalWeeksInLevel1: Number(item.level1.toFixed(1)),
    totalWeeksInLevel2: Number(item.level2.toFixed(1)),
    totalWeeksInLevel3: Number(item.level3.toFixed(1)),
  }));
};

export const getAgentHistoricalLevels = async (companyId: number, agentId: number, from: string, to: string) => {
  const startDate = new Date(from);
  const endDate = new Date(to);
  const now = new Date();

  const a = await prisma.agentLevel.findMany({ where: { agentId } })

  const records = await prisma.agentLevel.findMany({
    where: {
      agent: { companyId, id: agentId },
      since: { lt: endDate },
      OR: [
        { till: null },
        { till: { gt: startDate } }
      ]
    },
    select: {
      agentId: true,
      level: true,
      since: true,
      till: true,
    }
  });

  // Aggregation object including currentLevel
  const aggregation: Record<number, { 
    agentId: number, 
    level1: number, 
    level2: number, 
    level3: number, 
    currentLevel: number | null 
  }> = {};

  for (const record of records) {
    if (!aggregation[record.agentId]) {
      aggregation[record.agentId] = { 
        agentId: record.agentId, 
        level1: 0, 
        level2: 0, 
        level3: 0, 
        currentLevel: null 
      };
    }

    // Identify current level (where till is null)
    if (record.till === null) {
      aggregation[record.agentId].currentLevel = record.level;
    }

    // Determine the effective boundaries for the requested range
    const effectiveStart = record.since < startDate ? startDate : record.since;
    const actualTill = record.till ?? now;
    const effectiveEnd = actualTill > endDate ? endDate : actualTill;

    const diffInMs = effectiveEnd.getTime() - effectiveStart.getTime();
    
    if (diffInMs > 0) {
      const weeks = diffInMs / (1000 * 60 * 60 * 24 * 7);
      const levelKey = `level${record.level}` as 'level1' | 'level2' | 'level3';
      
      aggregation[record.agentId][levelKey] += weeks;
    }
  }

  return Object.values(aggregation).map(item => ({
    agentId: item.agentId,
    currentLevel: item.currentLevel,
    totalWeeksInLevel1: Number(item.level1.toFixed(1)),
    totalWeeksInLevel2: Number(item.level2.toFixed(1)),
    totalWeeksInLevel3: Number(item.level3.toFixed(1)),
  }));
};