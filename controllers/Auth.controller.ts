import { PrismaClient, User, Role } from "../generated/prisma/client";
import {prisma} from "../lib/prisma"

export const createUser = async (data: { 
  email: string; 
  passwordHash: string; 
  companyId: number; 
  role: Role 
}): Promise<User> => {
  return await prisma.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      companyId: data.companyId,
      role: data.role,
    },
  });
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
  return await prisma.user.findUnique({
    where: { email },
  });
};