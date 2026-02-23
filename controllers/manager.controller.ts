import {prisma} from "../lib/prisma"

export const createManagerWithUser = async (data: {
  email: string;
  name: string;
  passwordHash: string;
  companyId: number;
}) => {
  // We use a transaction to ensure both User and Manager profiles are created
  return await prisma.$transaction(async (tx) => {
    const manager = await tx.manager.create({
      data: {
        email: data.email,
        name: data.name,
        companyId: data.companyId,
      },
    });

    const user = await tx.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: 'MANAGER',
        companyId: data.companyId,
        managerId: manager.id,
      },
    });

    return { manager, user };
  });
};

// @todo should be able to update password too, in case agent forgets it 
export const updateManagerData = async (id: number, data: { name?: string; email?: string }) => {
  return await prisma.manager.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      // If email changes, the linked User email should also change
      user: data.email ? { update: { email: data.email } } : undefined
    }
  });
};

export const getManagerById = async (id: number) => {
  return await prisma.manager.findUnique({
    where: { id },
    include: { user: true, company: true }
  });
};

export const getManagersPaginated = async (skip: number, take: number) => {
  const [total, data] = await prisma.$transaction([
    prisma.manager.count(),
    prisma.manager.findMany({
      skip,
      take,
      include: { company: { select: { name: true } } },
      orderBy: { id: 'asc' }
    })
  ]);
  return { total, data };
};

export const deleteManagerAndUser = async (id: number) => {
  return await prisma.$transaction(async (tx) => {
    // Note: Due to your schema, we should delete the user profile associated
    const manager = await tx.manager.findUnique({ where: { id }, include: { user: true } });
    if (manager?.user) {
      await tx.user.delete({ where: { id: manager.user.id } });
    }
    return await tx.manager.delete({ where: { id } });
  });
};