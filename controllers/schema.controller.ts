import { prisma } from "../lib/prisma";
import { SchemaType, BlockType } from "../generated/prisma/client";

export const createSchema = async (data: {
  name: string;
  type: SchemaType;
  companyId: number;
  creatorId: number;
  days: {
    dayIndex: number;
    blocks: {
      startMinutesFromMidnight: number;
      endMinutesFromMidnight: number;
      blockType: BlockType;
      name?: string;
    }[];
  }[];
}) => {
  return await prisma.schema.create({
    data: {
      name: data.name,
      type: data.type,
      companyId: data.companyId,
      creatorId: data.creatorId,
      schemaDays: {
        create: data.days.map((day) => ({
          dayIndex: day.dayIndex,
          blocks: {
            create: day.blocks,
          },
        })),
      },
    },
    include: {
      schemaDays: {
        include: { blocks: true },
      },
    },
  });
};

export const getSchemaById = async (id: number) => {
  return await prisma.schema.findUnique({
    where: { id },
    include: {
      schemaDays: {
        orderBy: { dayIndex: 'asc' },
        include: { 
          blocks: { orderBy: { startMinutesFromMidnight: 'asc' } } 
        },
      },
    },
  });
};

export const getSchemaByName = async (name: string, companyId: number) => {
  return await prisma.schema.findFirst({
    where: { name, companyId },
    include: {
      schemaDays: {
        include: { blocks: true },
      },
    },
  });
};

export const getSchemasPaginated = async (companyId: number, skip: number, take: number) => {
  const [total, data] = await prisma.$transaction([
    prisma.schema.count({ where: { companyId } }),
    prisma.schema.findMany({
      where: { companyId },
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
    const days = await tx.schemaDay.findMany({ where: { schemaId: id } });
    const dayIds = days.map(d => d.id);
    
    await tx.schemaBlock.deleteMany({ where: { schemaDayId: { in: dayIds } } });
    await tx.schemaDay.deleteMany({ where: { schemaId: id } });
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
  });
};

/**
 * Performs a full structural update. 
 * It deletes existing days/blocks and replaces them with the new structure.
 */
export const fullUpdateSchema = async (id: number, data: {
  name?: string;
  type?: SchemaType;
  days: {
    dayIndex: number;
    blocks: {
      startMinutesFromMidnight: number;
      endMinutesFromMidnight: number;
      blockType: BlockType;
      name?: string;
    }[];
  }[];
}) => {
  return await prisma.$transaction(async (tx) => {
    // 1. Delete all existing blocks associated with this schema's days
    const existingDays = await tx.schemaDay.findMany({ where: { schemaId: id } });
    const dayIds = existingDays.map(d => d.id);
    
    await tx.schemaBlock.deleteMany({ where: { schemaDayId: { in: dayIds } } });
    
    // 2. Delete the days themselves
    await tx.schemaDay.deleteMany({ where: { schemaId: id } });

    // 3. Update the schema and create new nested structure
    return await tx.schema.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        schemaDays: {
          create: data.days.map((day) => ({
            dayIndex: day.dayIndex,
            blocks: {
              create: day.blocks,
            },
          })),
        },
      },
      include: {
        schemaDays: { include: { blocks: true } }
      }
    });
  });
};