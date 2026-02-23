import { prisma } from "../lib/prisma";

export const createTeam = async (
  name: string, 
  companyId: number, 
  managerIds?: number[]
) => {
  return await prisma.team.create({
    data: {
      name,
      companyId,
      manager: {
        connect: managerIds?.map((id) => ({ id })),
      },
    },
  });
};

export const editTeam = async (teamId: number, name: string) => {
  return await prisma.team.update({
    where: { id: teamId },
    data: { name },
  });
};

export const deleteTeam = async (teamId: number): Promise<void> => {
  await prisma.team.delete({
    where: { id: teamId },
  });
};