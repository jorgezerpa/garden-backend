import { prisma } from "../lib/prisma";
import { EventType } from "../generated/prisma/client";

export const getAgentPerformanceReport = async (
  companyId: number,
  startDateStr: string,
  endDateStr: string,
  page: number = 1,
  size: number = 10
) => {
  const startDate = new Date(`${startDateStr}T00:00:00Z`);
  const endDate = new Date(`${endDateStr}T23:59:59.999Z`);
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

  return {
    data: report.map(item => ({
      name: item.name,
      callingTime: Number(item.totalCallingTime),
      seeds: Number(item.totalSeeds),
      sales: Number(item.totalSales),
      currentLevel: item.currentLevel,
      averageScore: parseFloat(Number(item.performanceScore).toFixed(2))
    })),
    meta: {
      totalAgents,
      totalPages: Math.ceil(totalAgents / size),
      currentPage: page
    }
  };
};