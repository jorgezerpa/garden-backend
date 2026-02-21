import { Request, Response } from 'express';
import { prisma } from '../lib/prisma'; // Adjust path to your prisma client
import { BlockType } from '../generated/prisma/client';

interface BlockDefinitionInput {
  startTime: string; // ISO String or "2024-10-12T08:00:00Z"
  endTime: string;
  blockType: BlockType;
}

export const createBlockSchema = async (req: Request, res: Response) => {
  try {
    const { name, companyId, definitions } = req.body;

    // 1. Basic Validation
    if (!name || !companyId || !definitions || !definitions.length) {
      return res.status(400).json({ error: "Missing required fields or definitions." });
    }

    // 2. Database Transaction
    // We use a transaction to ensure that if a definition fails, the schema isn't created
    const newSchema = await prisma.$transaction(async (tx) => {
      const schema = await tx.blockSchema.create({
        data: {
          name,
          companyId: Number(companyId),
          // We map the definitions directly into the creation
          definitions: {
            create: definitions.map((def: BlockDefinitionInput) => ({
              startTime: new Date(def.startTime),
              endTime: new Date(def.endTime),
              blockType: def.blockType,
            })),
          },
        },
        include: {
          definitions: true, // Return the definitions in the response
        },
      });

      return schema;
    });

    return res.status(201).json(newSchema);
  } catch (error) {
    console.error("Error creating block schema:", error);
    return res.status(500).json({ error: "Internal server error while creating schema." });
  }
};