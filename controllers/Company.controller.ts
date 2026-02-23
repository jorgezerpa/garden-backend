import { Company, User, Role } from "../generated/prisma/client";

import { prisma } from "../lib/prisma";

export const registerCompany = async (
  companyName: string,
  email: string,
  passwordHash: string,
  name: string
): Promise<{ company: Company; user: User }> => {
  return await prisma.$transaction(async (tx) => {
    // 1. Create the Company
    const company = await tx.company.create({
      data: { name: companyName },
    });

    // 2. Create the Manager Profile (Profile data)
    const manager = await tx.manager.create({
      data: {
        name,
        email,
        companyId: company.id,
      },
    });

    // 3. Create the User (Auth data) linked to Company and Manager
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: Role.MAIN_ADMIN,
        companyId: company.id,
        managerId: manager.id,
      },
    });

    return { company, user };
  });
};