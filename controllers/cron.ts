import { prisma } from "../lib/prisma";
import { EventType } from "../generated/prisma/client";

// TEMPORAL HELPER TILL WE IMPLEMENT THE CRON JOB ON THE SERVER 

/**
 * Reconciles agent levels based on call duration from the last 7 days.
 * 1. Calculates target levels.
 * 2. Compares with current active levels.
 * 3. Closes old levels and inserts new ones if a change is detected.
 */
export const updateLevels = async (thresholdGold: number, thresholdSilver: number) => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  return await prisma.$transaction(async (tx) => {
    // 1. Get weekly stats for all agents who had calls
    const weeklyStats = await tx.call.groupBy({
      by: ['agentId'],
      where: {
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