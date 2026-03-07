import { prisma } from "../lib/prisma";
import { EventType } from "../generated/prisma/client";

export const getAgentDayInsights = async (agentId: number, date: string) => {
  const startOfDay = new Date(`${date}T00:00:00.000Z`);
  const endOfDay = new Date(`${date}T23:59:59.999Z`);

  // 1. Get Metrics and Aggregate Calls
  const agent = await prisma.agent.findUnique({ where:{ id:agentId } })
  const companyId = agent?.companyId

  const [callMetrics, events, latestState] = await Promise.all([
    prisma.call.aggregate({
      where: { agentId, startAt: { gte: startOfDay, lte: endOfDay } },
      _count: { id: true },
      _sum: { durationSeconds: true },
    }),
    prisma.funnelEvent.findMany({
      where: { agentId, timestamp: { gte: startOfDay, lte: endOfDay } },
    }),
    prisma.agentState.aggregate({
      where: { agentId, timestamp: { gte: startOfDay, lte: endOfDay } },
      _count: { id: true },
      _sum: { energyScore: true, focusScore: true, motivationScore: true }
    }),
    // prisma.agentState.findFirst({
    //   where: { agentId, timestamp: { gte: startOfDay, lte: endOfDay } },
    //   orderBy: { timestamp: "desc" },
    // }),
  ]);

  // 2. Calculate basics
  const totalCalls = callMetrics._count.id || 0;
  const talkTime = callMetrics._sum.durationSeconds || 0;
  const seeds = events.filter((e) => e.type === EventType.SEED).length;
  const leads = events.filter((e) => e.type === EventType.LEAD).length;
  const sales = events.filter((e) => e.type === EventType.SALE).length;
  const deepCalls = await prisma.call.count({
    where: { agentId, startAt: { gte: startOfDay, lte: endOfDay }, durationSeconds: { gte: 300 } },
  });

  // 3. Current Streak (Goal comparison)
  const goalAssignation = await prisma.goalsAssignation.findFirst({
    where: { companyId: companyId, date: startOfDay },
    include: { goal: true },
  });

  console.log(startOfDay)
  console.log(goalAssignation)

  let currentStreak = 100;
  let goalSeeds = 0
  let goalLeads = 0 
  let goalSales = 0
  let goalNumberOfCalls = 0
  let goalNumberOfLongCalls = 0
  let goalTalkTimeMinutes = 0

  if (goalAssignation) {
    const g = goalAssignation.goal;
    const percentages = [
      g.seeds ? (seeds / g.seeds) : 1,
      g.leads ? (leads / g.leads) : 1,
      g.sales ? (sales / g.sales) : 1,
      g.numberOfCalls ? (totalCalls / g.numberOfCalls) : 1,
    ];
    currentStreak = Math.min(100, Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100));
    goalSeeds = g.seeds
    goalLeads = g.leads
    goalSales = g.sales
    goalNumberOfCalls = g.numberOfCalls
    goalNumberOfLongCalls = g.numberOfLongCalls
    goalTalkTimeMinutes = g.talkTimeMinutes
  }

  const energy = latestState?._sum.energyScore
  const motivation = latestState?._sum.motivationScore
  const focus = latestState?._sum.focusScore
  const feelingsCount = latestState._count.id

  return {
    seeds, leads, sales, currentStreak,
    number_of_calls: totalCalls,
    number_of_deep_call: deepCalls,
    energy: (feelingsCount > 0 && energy) ? energy/feelingsCount : 0,
    focus: (feelingsCount > 0 && focus) ? focus/feelingsCount : 0,
    motivation: (feelingsCount > 0 && motivation) ? motivation/feelingsCount : 0,
    talkTime,
    goalSeeds,
    goalLeads, 
    goalSales,
    goalNumberOfCalls,
    goalNumberOfLongCalls,
    goalTalkTimeMinutes,
  };
};

export const getAgentWeeklyGrowth = async (agentId: number, dateStr: string) => {
  // Create date in UTC
  const date = new Date(`${dateStr}T00:00:00Z`);

  // Calculate day of week (0 is Sunday, 1 is Monday...)
  const day = date.getUTCDay();
  // Adjust to ensure Monday is the start (Mon=1, Sun=0)
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  
  const startOfWeek = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), diff));

  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyData = [];

  for (let i = 0; i < 7; i++) {
    const startOfDay = new Date(startOfWeek);
    startOfDay.setUTCDate(startOfWeek.getUTCDate() + i);
    
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCHours(23, 59, 59, 999);

    // prisma will now query using pure UTC boundaries
    const [calls, events, deepCalls] = await Promise.all([
      prisma.call.count({ where: { agentId, startAt: { gte: startOfDay, lte: endOfDay } } }),
      prisma.funnelEvent.findMany({ where: { agentId, timestamp: { gte: startOfDay, lte: endOfDay } } }),
      prisma.call.count({ where: { agentId, startAt: { gte: startOfDay, lte: endOfDay }, durationSeconds: { gte: 300 } } }),
    ]);

    const s = events.filter(e => e.type === EventType.SEED).length;
    const l = events.filter(e => e.type === EventType.LEAD).length;
    const sa = events.filter(e => e.type === EventType.SALE).length;

    const growth = s + (l * 2) + (sa * 3) + calls + (deepCalls * 2);
    weeklyData.push({ day: days[i], growth });
  }

  return weeklyData;
};





// Following the same patterns and styles, I need you to generate some new controllers, this ones are focused on per agent performance. So, one by one:
// 1) AgentDayInsights -> returns an object as follows: 
// "
// {
//     seeds: Number-total seeds of the day,
//     leads: number-total leads of the day,
//     sales: number-total sales of the day,
//     currentStreak: number from 0 to 100 - you check goals assignation table, and then goes like : (currentSeeds/goalSeeds)*100, (currentCallbacks/goalCallabcks)*100...then the average of all % is the streak. If no goal assignation, then return 100. 
//     number_of_calls: number , total calls of the day,
//     number_of_deep_call: is obvious, a deep call is a +5min call, 
//     //
//     energy,
//     focus,
//     motivation,
//     talkTime: Sum the total time of all calls for the current day 
// }
// "
// 2) agentWeeklyGrowh:
// - returns an array like [{ day: 'Mon', growth: 40 }, ...]. 
// - always correspond to the current week. From mon the sun
// - We use a weighted summatory to measure growth. So growth = seeds + (leads*2) + (sales*3) + number_of_calls + number_of_deep_calls*2
// Both controllers with receive a date as a parameter, also a agentId. Remember, it gives the data of 1 single day (the one passed on the date parameter) considering all from 00:00 to 23:59:59