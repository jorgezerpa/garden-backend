import { prisma } from "../lib/prisma";
export const createSchema = async (data) => {
    return await prisma.schema.create({
        data: {
            name: data.name,
            companyId: data.companyId,
            creatorId: data.creatorId,
            blocks: {
                create: data.blocks
            },
        },
        include: { blocks: true }
    });
};
export const getSchemaById = async (id) => {
    return await prisma.schema.findUnique({
        where: { id },
        include: {
            blocks: { orderBy: { startMinutesFromMidnight: 'asc' } }
        },
    });
};
export const getSchemaByName = async (name, companyId) => {
    return await prisma.schema.findFirst({
        where: { name, companyId },
        include: { blocks: true },
    });
};
export const getSchemasPaginated = async (companyId, skip, take) => {
    const [total, data] = await prisma.$transaction([
        prisma.schema.count({ where: { companyId } }),
        prisma.schema.findMany({
            where: { companyId },
            include: { blocks: true },
            skip,
            take,
            orderBy: { id: 'desc' },
        }),
    ]);
    return { total, data };
};
export const deleteSchema = async (id) => {
    // Prisma handles cascading deletes if configured in DB, 
    // otherwise we delete child records first in a transaction.
    return await prisma.$transaction(async (tx) => {
        await tx.schemaAssignation.deleteMany({ where: { schemaId: id } }); // delete assignations
        await tx.schemaBlock.deleteMany({ where: { schemaId: id } }); // delete blocks
        return await tx.schema.delete({ where: { id } }); // delete schema 
    });
};
export const updateSchemaName = async (id, name) => {
    return await prisma.schema.update({
        where: { id },
        data: { name },
    });
};
/**
 * Updates just the basic metadata of a Schema
 */
export const updateSchemaMetadata = async (id, data) => {
    return await prisma.schema.update({
        where: { id },
        data,
        include: { blocks: true }
    });
};
/**
 * Performs a full structural update.
 * It deletes existing days/blocks and replaces them with the new structure.
 */
export const fullUpdateSchema = async (id, data) => {
    return await prisma.$transaction(async (tx) => {
        // 1. Delete all existing blocks associated with this schema's days    
        await tx.schemaBlock.deleteMany({ where: { schemaId: id } });
        // 2. Update the schema and create new nested structure
        return await tx.schema.update({
            where: { id },
            data: {
                name: data.name,
                blocks: {
                    create: data.blocks
                }
            },
            include: {
                blocks: true
            }
        });
    });
};
export const getAssignationsByRange = async (companyId, from, to) => {
    return await prisma.schemaAssignation.findMany({
        where: {
            companyId,
            date: {
                gte: getStartOfDay(from),
                lte: getEndOfDay(to),
            },
        },
        orderBy: {
            date: 'asc',
        },
    });
};
export const upsertSchemaAssignation = async (companyId, date, schemaId) => {
    const targetDate = new Date(`${date}T00:00:00.000Z`);
    return await prisma.schemaAssignation.upsert({
        where: {
            companyId_date: { companyId, date: targetDate }
        },
        update: {
            schemaId
        },
        create: {
            companyId,
            date: targetDate,
            schemaId
        },
    });
};
export const deleteSchemaAssignation = async (id) => {
    return await prisma.schemaAssignation.delete({
        where: { id },
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
