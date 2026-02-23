import { TemporalGoals } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";

/**
 * Creates a new Temporal Goal set by a Manager
 */
export const createTemporalGoal = async (data: {
  startTime: Date;
  endTime: Date;
  talkTimeMinutes: number;
  seeds: number;
  callbacks: number;
  leads: number;
  sales: number;
  numberOfCalls: number;
  numberOfLongCalls: number;
  companyId: number;
  creatorId: number;
}): Promise<TemporalGoals> => {
  return await prisma.temporalGoals.create({
    data,
  });
};

/**
 * Retrieves all goals for a specific company
 * Useful for a dashboard view
 */
export const findGoalsByCompany = async (companyId: number): Promise<TemporalGoals[]> => {
  return await prisma.temporalGoals.findMany({
    where: { companyId },
    orderBy: { startTime: 'desc' },
  });
};

/**
 * Updates an existing goal
 * Uses Partial to allow updating only specific metrics
 */
export const updateTemporalGoal = async (
  id: number,
  data: Partial<Omit<TemporalGoals, "id" | "createdAt" | "updatedAt">>
): Promise<TemporalGoals> => {
  return await prisma.temporalGoals.update({
    where: { id },
    data,
  });
};

/**
 * Deletes a goal by ID
 */
export const deleteTemporalGoal = async (id: number): Promise<TemporalGoals> => {
  return await prisma.temporalGoals.delete({
    where: { id },
  });
};

/**
 * Find goals active during a specific time range
 * Helpful for comparing "Actual vs Goal" for a specific shift
 */
export const findActiveGoals = async (companyId: number, date: Date): Promise<TemporalGoals[]> => {
  return await prisma.temporalGoals.findMany({
    where: {
      companyId,
      startTime: { lte: date },
      endTime: { gte: date },
    },
  });
};