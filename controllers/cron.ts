import { prisma } from "../lib/prisma";
import { EventType } from "../generated/prisma/client";

// TEMPORAL HELPER TILL WE IMPLEMENT THE CRON JOB ON THE SERVER 

export const updateLevels = async (companyId: number, thresholdGold: number, thresholdSilver: number) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Define the end of the last completed week (Last Sunday 23:59:59 UTC)
    const now = new Date();
    const lastSunday = new Date(now);
    // Adjust to last Sunday. If today is Sunday (0), it goes back 7 days.
    const daysToSubtract = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
    lastSunday.setUTCDate(now.getUTCDate() - daysToSubtract);
    lastSunday.setUTCHours(23, 59, 59, 999);

    // 2. Get all agents for the company
    const agents = await tx.agent.findMany({
      where: { companyId },
      select: { id: true }
    });

    const allUpdates = [];

    for (const agent of agents) {
      const agentId = agent.id;

      let lastRecord = await tx.agentLevel.findFirst({
        where: { agentId, till: null },
        orderBy: { since: 'desc' }
      });

      if (!lastRecord) continue;

      // Start from 'since' + 'durationInWeeks' 
      // This prevents re-processing weeks already accounted for in the duration column
      let currentSince = new Date(lastRecord.since);
      const weeksAlreadyProcessed = Number(lastRecord.durationInWeeks);
      currentSince.setUTCDate(currentSince.getUTCDate() + (weeksAlreadyProcessed * 7));
      
      while (true) {
        const nextWeekStart = new Date(currentSince);
        nextWeekStart.setUTCDate(currentSince.getUTCDate() + 7);

        if (nextWeekStart > lastSunday) break;

        // Calculate stats for THIS specific window (currentSince -> nextWeekStart)
        const stats = await tx.call.aggregate({
          where: {
            agentId,
            startAt: {
              gte: currentSince,
              lt: nextWeekStart,
            },
          },
          _sum: { durationSeconds: true },
        });

        const totalDuration = stats._sum.durationSeconds || 0;
        
        // Determine level for the NEXT period based on this period's performance
        let calculatedLevel = 3; // Bronze
        if (totalDuration >= thresholdGold) calculatedLevel = 1;
        else if (totalDuration >= thresholdSilver) calculatedLevel = 2;

        // Calculate precise duration (allows for decimal weeks if run mid-week in the future)
        const diffMs = nextWeekStart.getTime() - currentSince.getTime();
        const weeksToAdd = diffMs / (1000 * 60 * 60 * 24 * 7);
        
        // Prisma stores Decimal, so we convert to Number to do math, then fix to 1 decimal
        const currentDuration = Number(lastRecord.durationInWeeks);
        const newDuration = parseFloat((currentDuration + weeksToAdd).toFixed(1));

        // 5. Update database
        if (lastRecord.level !== calculatedLevel) {
          // Level CHANGED: Close old level and update final duration
          await tx.agentLevel.update({
            where: { id: lastRecord.id },
            data: {
              till: nextWeekStart,
              durationInWeeks: newDuration, 
            },
          });

          // Open new level
          lastRecord = await tx.agentLevel.create({
            data: {
              agentId,
              level: calculatedLevel,
              since: nextWeekStart,
              till: null,
              durationInWeeks: 0,
            },
          });
          
          allUpdates.push({ agentId, weekStarting: nextWeekStart, newLevel: calculatedLevel });
        } else {
          // Level is the SAME: Just update the duration of the current record
          lastRecord = await tx.agentLevel.update({
            where: { id: lastRecord.id },
            data: { durationInWeeks: newDuration }
          });
        }

        // Move cursor forward
        currentSince = nextWeekStart;
      }
    }

    return {
      success: true,
      totalLevelChanges: allUpdates.length,
      details: allUpdates,
    };
  });
};

export const getHistoricalLevels = async (companyId: number, from: string, to: string) => {
  const startDate = new Date(from);
  const endDate = new Date(to);

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
      durationInWeeks: true,
      till: true,
    }
  });

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

    // Identify current active level
    if (record.till === null) {
      aggregation[record.agentId].currentLevel = record.level;
    }

    // Sum up the pre-calculated DB values directly
    const weeks = Number(record.durationInWeeks);
    
    if (weeks > 0) {
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
      durationInWeeks: true,
      till: true,
    }
  });

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

    // Identify current active level
    if (record.till === null) {
      aggregation[record.agentId].currentLevel = record.level;
    }

    // Sum up the pre-calculated DB values directly
    const weeks = Number(record.durationInWeeks);
    
    if (weeks > 0) {
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