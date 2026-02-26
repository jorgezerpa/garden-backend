import { Company, User, Role } from "../generated/prisma/client";
import { randomBytes, createHash, randomUUID } from "crypto";
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

export const generateKeyPair = async (companyId: number) => {
  // 1. Generate Raw Keys
  // We use randomUUID for the public key and 32 random bytes for the secret
  const publicKey = `pk_${randomUUID()}`;
  const rawSecretKey = randomBytes(32).toString("hex");

  // 2. Hash the secret key for storage
  // SHA-256 is the standard for high-entropy API key hashing
  const secretHash = createHash("sha256").update(rawSecretKey).digest("hex");

  // 3. Save to Database
  await prisma.aPIKeysAuth.upsert({
    where: { companyId },
    update: {
      publicKey,
      secretKeyHash: secretHash,
    },
    create: {
      publicKey,
      secretKeyHash: secretHash,
      companyId,
    },
  });

  // 4. Return the rawSecretKey ONLY ONCE
  // The user must save this; we cannot recover it later.
  return {
    publicKey,
    secretKey: rawSecretKey, 
  };
};