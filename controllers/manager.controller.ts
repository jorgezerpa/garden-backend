import { THIRD_PARTY_SERVICES } from "../generated/prisma/enums";
import {prisma} from "../lib/prisma"
import {hash, compare} from 'bcrypt'; // Assuming you use bcrypt for hashing/checking

export const upsertLeadDeskAPIAuthString = async(authString: string, companyId: number) => {
  const result = await prisma.leadDeskCustomData.upsert({
    where: { companyId },
    create: { authString, companyId }, 
    update: { authString }
  })

  return { id: result.id }
}

export const isLeadDeskAuthString = async(companyId:number) => {
  const result = await prisma.leadDeskCustomData.findUnique({ where: { companyId }, select: { authString: true } })
  return result?.authString || null
}

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

    return { managerId: manager.id, userId: user.id };
  });
};

export const updateManagerData = async (id: number, data: { name?: string; email?: string, password?: string }) => {
  const saltRounds = 10;
  const passwordHash = data.password ? await hash(data.password, saltRounds) : undefined;

  return await prisma.manager.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      // If email changes, the linked User email should also change
      user: (data.email || passwordHash) ? { update: { email: data.email, passwordHash } } : undefined
    }
  });
};

export const getManagerById = async (id: number) => {
  return await prisma.manager.findUnique({
    where: { id },
    include: { user: true, company: true }
  });
};

export const getManagersPaginated = async (skip: number, take: number, companyId: number) => {
  const [total, data] = await prisma.$transaction([
    prisma.manager.count(),
    prisma.manager.findMany({
      skip,
      take,
      where: { companyId },
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


////////////////////////////////
////////////////////////////////
////////////////////////////////

export const createAgentWithUser = async (data: {
  email: string;
  name: string;
  passwordHash: string;
  companyId: number;
}) => {
  // We use a transaction to ensure both User and Manager profiles are created
  return await prisma.$transaction(async (tx) => {
    const agent = await tx.agent.create({
      data: {
        name: data.name,
        companyId: data.companyId,
      },
    });

    const user = await tx.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: 'AGENT',
        companyId: data.companyId,
        agentId: agent.id,
      },
    });

    return { agentId: agent.id, userId: user.id };
  });
};

export const updateAgentData = async (
  id: number, 
  data: { 
    name?: string; 
    email?: string; 
    password?: string;
    thirdPartyService?: { 
      agentServiceIdentifier: string; 
      serviceIdentifier: THIRD_PARTY_SERVICES 
    } 
  }
) => {

  const saltRounds = 10;
  const passwordHash = data.password ? await hash(data.password, saltRounds) : undefined;

  return await prisma.agent.update({
    where: { id },
    data: {
      name: data.name,
      // Nested update for User only if email is provided
      user: (data.email || data.password) ? { update: { email: data.email || undefined, passwordHash  } } : undefined,
      
      // We use the "upsert" approach or conditional logic for the relation
      agentToThird: data.thirdPartyService ? {
        upsert: {
          where: { 
            agentId_serviceIdentifier: { 
              agentId: id, 
              serviceIdentifier: data.thirdPartyService.serviceIdentifier 
            } 
          },
          update: {
            agentServiceIdentifier: data.thirdPartyService.agentServiceIdentifier
          },
          create: {
            serviceIdentifier: data.thirdPartyService.serviceIdentifier,
            agentServiceIdentifier: data.thirdPartyService.agentServiceIdentifier
          }
        }
      } : undefined
    }
  });
};

export const upsertAgentThirdParty = async (id: number, data: { serviceIdentifier: THIRD_PARTY_SERVICES, agentServiceIdentifier: string }) => {
  return await prisma.agentToThird.upsert({
    where: { agentId_serviceIdentifier: { agentId: id, serviceIdentifier: data.serviceIdentifier } },
    create: {
      agentId: id, 
      serviceIdentifier: data.serviceIdentifier, 
      agentServiceIdentifier: data.agentServiceIdentifier,
    },
    update: {
      agentServiceIdentifier: data.agentServiceIdentifier
    }
  })
};

export const getAgentById = async (id: number) => {
  return await prisma.agent.findUnique({
    where: { id },
    include: { user: true, company: true, agentToThird: true }
  });
};


export const getAgentsPaginated = async (skip: number, take: number, companyId: number) => {

  const [total, data] = await prisma.$transaction([
    // Apply the filter here so the count matches the result set
    prisma.agent.count({
      where: {
        companyId,
        user: {
          status: "ACTIVE",
        },
      },
    }),
    prisma.agent.findMany({
      skip,
      take,
      where: {
        companyId,
        user: {
          status: "ACTIVE",
        },
      },
      include: {
        company: { select: { name: true } },
        user: { omit: { passwordHash: true } },
        agentToThird: true
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  return { total, data };
};


// export const deleteAgentAndUser = async (id: number) => {
//   return await prisma.$transaction(async (tx) => {
//     // Note: Due to your schema, we should delete the user profile associated
//     const agent = await tx.agent.findUnique({ where: { id }, include: { user: true } });
//     if (agent?.user) {
//       await tx.user.delete({ where: { id: agent.user.id } });
//     }
//     return await tx.agent.delete({ where: { id } });
//   });
// };
// WE CAN NOT DELETE to being able to keep historical data, so we just change user status to REMOVED
export const deleteAgentAndUser = async (id: number) => {
  const agent = await prisma.agent.findUnique({ where: { id }, include: { user:true } })
  return await prisma.user.update({
    where: { id: agent?.user?.id },
    data: {
      status: "REMOVED"
    }
  });
};