import { PrismaClient, Role, UserStatus, BlockType, SchemaType, EventType } from '../generated/prisma/client';
import {prisma} from "../lib/prisma"
import {  } from "../controllers/Company.controller"
import {  } from "../controllers/Auth.controller"
import {  } from "../controllers/DataVis.controller"
import {  } from "../controllers/Webhook.controller"
import {  } from "../controllers/goals.controller"
import {  } from "../controllers/schema.controller"


async function main() {
  console.log('Start seeding...');

  // 1. Create Company
  const company = await prisma.company.create({
    data: {
      name: 'Global Connect Solutions',
      apiKey: {
        create: {
          publicKey: 'pk_live_550e8400-e29b-41d4-a716-446655440000',
          secretKeyHash: 'hashed_secret_key_12345',
        },
      },
    },
  });

  // 2. Create Main Admin (who is also a Manager)
  const adminManager = await prisma.manager.create({
    data: {
      name: 'Main Admin User',
      email: 'admin@company.com',
      companyId: company.id,
    },
  });

  await prisma.user.create({
    data: {
      email: adminManager.email,
      passwordHash: 'PBKDF2_SECURE_HASH',
      role: Role.MAIN_ADMIN,
      companyId: company.id,
      managerId: adminManager.id,
    },
  });

  // 3. Create 3 additional Managers
  const managers = [];
  for (let i = 1; i <= 3; i++) {
    const m = await prisma.manager.create({
      data: {
        name: `Manager ${i}`,
        email: `manager${i}@company.com`,
        companyId: company.id,
      },
    });
    
    await prisma.user.create({
      data: {
        email: m.email,
        passwordHash: 'PBKDF2_SECURE_HASH',
        role: Role.MANAGER,
        companyId: company.id,
        managerId: m.id,
      },
    });
    managers.push(m);
  }

  // 4. Create 10 Agents
  const agents = [];
  for (let i = 1; i <= 10; i++) {
    const a = await prisma.agent.create({
      data: {
        name: `Agent ${i}`,
        companyId: company.id,
      },
    });

    await prisma.user.create({
      data: {
        email: `agent${i}@company.com`,
        passwordHash: 'PBKDF2_SECURE_HASH',
        role: Role.AGENT,
        companyId: company.id,
        agentId: a.id,
      },
    });
    agents.push(a);
  }

  // 5. Create a Schema and Temporal Goal (Required for realistic structure)
  const defaultGoal = await prisma.temporalGoals.create({
    data: {
      name: 'Standard 2025 Goals',
      companyId: company.id,
      creatorId: adminManager.id,
      seeds: 50,
      leads: 20,
      sales: 5,
    },
  });

  // 6. Create Callee numbers
  // We'll create 100 unique callees to distribute 1000 calls
  const callees = [];
  for (let i = 1; i <= 100; i++) {
    const c = await prisma.callee.create({
      data: {
        phoneNumber: `+1555000${i.toString().padStart(3, '0')}`,
      },
    });
    callees.push(c);
  }

  // 7. Generate 1000 Calls
  console.log('Generating 1000 calls...');
  const startTimestamp = new Date('2025-01-01T08:00:00Z').getTime();
  const endTimestamp = new Date('2026-01-01T08:00:00Z').getTime();
  const step = (endTimestamp - startTimestamp) / 1000;

  for (let i = 0; i < 1000; i++) {
    const agent = agents[i % agents.length];
    const callee = callees[i % callees.length];
    const callDate = new Date(startTimestamp + (step * i));
    const duration = Math.floor(Math.random() * 300) + 10; // 10s to 310s

    const call = await prisma.call.create({
      data: {
        agentId: agent.id,
        calleeId: callee.id,
        companyId: company.id,
        startAt: callDate,
        endAt: new Date(callDate.getTime() + duration * 1000),
        durationSeconds: duration,
        leadDeskId: `LD-${i}`,
      },
    });

    // Randomly add a Funnel Event to some calls (e.g., every 3rd call is a SEED)
    if (i % 3 === 0) {
      await prisma.funnelEvent.create({
        data: {
          type: EventType.SEED,
          callId: call.id,
          agentId: agent.id,
          timestamp: callDate,
        },
      });
    }

    // Track agent-to-callee attempts
    await prisma.agentToCallee.upsert({
      where: {
        agentId_calleeId: { agentId: agent.id, calleeId: callee.id }
      },
      update: { totalAttemps: { increment: 1 } },
      create: { agentId: agent.id, calleeId: callee.id, totalAttemps: 1 }
    });
  }

  console.log('Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });