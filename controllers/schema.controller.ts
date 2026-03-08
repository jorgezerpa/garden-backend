import { prisma } from "../lib/prisma";
import { SchemaType, BlockType, SchemaAssignation } from "../generated/prisma/client";

export const createSchema = async (data: {
  name: string;
  companyId: number;
  creatorId: number;
  blocks: {
    startMinutesFromMidnight: number;
    endMinutesFromMidnight: number;
    blockType: BlockType;
    name?: string;
  }[];
}) => {
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

export const getSchemaById = async (id: number) => {
  return await prisma.schema.findUnique({
    where: { id },
    include: {
      blocks: { orderBy: { startMinutesFromMidnight: 'asc' } } 
    },
  });
};

export const getSchemaByName = async (name: string, companyId: number) => {
  return await prisma.schema.findFirst({
    where: { name, companyId },
    include: { blocks: true },
  });
};

export const getSchemasPaginated = async (companyId: number, skip: number, take: number) => {
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

export const deleteSchema = async (id: number) => {
  // Prisma handles cascading deletes if configured in DB, 
  // otherwise we delete child records first in a transaction.
  return await prisma.$transaction(async (tx) => { 
    await tx.schemaAssignation.deleteMany({ where: { schemaId: id } }) // delete assignations
    await tx.schemaBlock.deleteMany({ where: { schemaId: id }}); // delete blocks
    return await tx.schema.delete({ where: { id } }); // delete schema 
  });
};

export const updateSchemaName = async (id: number, name: string) => {
  return await prisma.schema.update({
    where: { id },
    data: { name },
  });
};

/**
 * Updates just the basic metadata of a Schema
 */
export const updateSchemaMetadata = async (id: number, data: { name?: string }) => {
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
export const fullUpdateSchema = async (id: number, data: {
  name?: string;
  blocks: {
    startMinutesFromMidnight: number;
    endMinutesFromMidnight: number;
    blockType: BlockType;
    name?: string;
  }[];
}) => {
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

export const getAssignationsByRange = async (
  companyId: number,
  from: Date,
  to: Date
): Promise<SchemaAssignation[]> => {
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

export const upsertSchemaAssignation = async (
  companyId: number,
  date: string,
  schemaId: number
): Promise<SchemaAssignation> => {
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

export const deleteSchemaAssignation = async (id: number): Promise<SchemaAssignation> => {
  return await prisma.schemaAssignation.delete({
    where: { id },
  });
};


// HELPERS 
/**
 * Normalizes a date to 00:00:00.000
 */
const getStartOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Normalizes a date to 23:59:59.999
 */
const getEndOfDay = (date: Date): Date => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};