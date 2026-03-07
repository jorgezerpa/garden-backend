import { prisma } from "../lib/prisma";
import { SchemaType, BlockType } from "../generated/prisma/client";

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
    await tx.schemaBlock.deleteMany({ where: { schemaId: id }});
    return await tx.schema.delete({ where: { id } });
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