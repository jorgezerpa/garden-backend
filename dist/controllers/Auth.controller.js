import { prisma } from "../lib/prisma";
export const createUser = async (data) => {
    return await prisma.user.create({
        data: {
            email: data.email,
            passwordHash: data.passwordHash,
            companyId: data.companyId,
            role: data.role,
        },
    });
};
export const findUserByEmail = async (email) => {
    return await prisma.user.findUnique({
        where: { email },
    });
};
