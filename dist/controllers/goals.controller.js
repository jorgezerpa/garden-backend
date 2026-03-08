import { prisma } from "../lib/prisma";
/**
 * Creates a new Temporal Goal set by a Manager
 */
export const createTemporalGoal = async (data) => {
    return await prisma.temporalGoals.create({
        data,
    });
};
/**
 * Retrieves all goals for a specific company
 * Useful for a dashboard view
 */
export const findGoalsByCompany = async (companyId) => {
    return await prisma.temporalGoals.findMany({
        where: { companyId },
        // orderBy: { startTime: 'desc' },
    });
};
export const findGoalById = async (goalId) => {
    return await prisma.temporalGoals.findUnique({
        where: { id: goalId },
    });
};
/**
 * Updates an existing goal
 * Uses Partial to allow updating only specific metrics
 */
export const updateTemporalGoal = async (id, data) => {
    return await prisma.temporalGoals.update({
        where: { id },
        data,
    });
};
/**
 * Deletes a goal by ID, ensuring all linked assignations
 * are removed first to prevent foreign key constraint errors.
 */
export const deleteTemporalGoal = async (id) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Delete all assignations linked to this specific goal
        await tx.goalsAssignation.deleteMany({
            where: { goalId: id },
        });
        // 2. Now delete the goal itself
        return await tx.temporalGoals.delete({
            where: { id },
        });
    });
};
/////////////////////////
// ASIGNATION OF GOALS
/////////////////////////
/**
 * Retrieves assignations within a specific date range.
 * inclusive: from 00:00:00 of 'from' to 23:59:59 of 'to'.
 */
export const getAssignationsByRange = async (companyId, from, to) => {
    return await prisma.goalsAssignation.findMany({
        where: {
            companyId,
            date: {
                gte: getStartOfDay(from),
                lte: getEndOfDay(to),
            },
        },
        include: {
            goal: true, // Usually helpful to see what the goal actually was
        },
        orderBy: {
            date: 'asc',
        },
    });
};
/**
 * Assigns a goal to a specific date.
 * If a goal is already assigned to that date, it updates it to the new goalId.
 */
export const upsertGoalAssignation = async (companyId, date, goalId) => {
    const targetDate = new Date(`${date}T00:00:00.000Z`);
    return await prisma.goalsAssignation.upsert({
        where: {
            companyId_date: { companyId, date: targetDate }
        },
        update: {
            goalId: goalId,
        },
        create: {
            companyId,
            date: targetDate,
            goalId: goalId,
        },
    });
};
/**
 * Removes a goal assignation by its ID
 */
export const deleteGoalAssignation = async (id) => {
    return await prisma.goalsAssignation.delete({
        where: { id },
    });
};
/**
 * Optional: Delete by Date
 * Useful if the UI doesn't have the primary key ID handy
 */
export const deleteGoalAssignationByDate = async (companyId, date) => {
    const targetDate = new Date(date);
    targetDate.setUTCHours(0, 0, 0, 0);
    return await prisma.goalsAssignation.delete({
        where: { companyId_date: { companyId, date: targetDate } },
    });
};
// HELPERS 
/**
 * Normalizes a date to 00:00:00.000
 */
const getStartOfDay = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};
/**
 * Normalizes a date to 23:59:59.999
 */
const getEndOfDay = (date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
};
