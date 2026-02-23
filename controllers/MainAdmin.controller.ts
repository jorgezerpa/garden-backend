import { Role } from "../generated/prisma/client";

import { prisma } from "../lib/prisma";


export const createManager = async (
  email: string,
  passwordHash: string,
  name: string,
  companyId: number
) => {
  return await prisma.$transaction(async (tx) => {
    const manager = await tx.manager.create({
      data: { name, email, companyId },
    });

    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: Role.MANAGER,
        companyId,
        managerId: manager.id,
      },
    });

    return { manager, user };
  });
};

export const editManager = async (
  managerId: number,
  data: { name?: string; email?: string; passwordHash?: string }
) => {
  return await prisma.manager.update({
    where: { id: managerId },
    data: {
      name: data.name,
      email: data.email,
      user: {
        update: {
          email: data.email,
          passwordHash: data.passwordHash,
        },
      },
    },
  });
};

export const deleteManager = async (managerId: number): Promise<void> => {
  // If your schema doesn't have Cascade Delete, we delete the User first
  const manager = await prisma.manager.findUnique({
    where: { id: managerId },
    include: { user: true },
  });

  await prisma.$transaction([
    prisma.user.delete({ where: { id: manager?.user?.id } }),
    prisma.manager.delete({ where: { id: managerId } }),
  ]);
};