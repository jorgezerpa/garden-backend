import { prisma } from "../lib/prisma";
import { PrismaClient, Role, BlockType, EventType, WEEK_DAYS } from '../generated/prisma/client';
import crypto from 'crypto';
import {hash, compare} from 'bcrypt'; // Assuming you use bcrypt for hashing/checking

// Helper Functions
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (start: Date, end: Date) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
const getWeekDay = (date: Date): WEEK_DAYS => {
  const days = [
    WEEK_DAYS.SUNDAY, WEEK_DAYS.MONDAY, WEEK_DAYS.TUESDAY, 
    WEEK_DAYS.WEDNESDAY, WEEK_DAYS.THURSDAY, WEEK_DAYS.FRIDAY, WEEK_DAYS.SATURDAY
  ];
  return days[date.getDay()];
};

async function main() {
  console.log('🌱 Starting Sales Garden DB Seed...');

  // Optional: Clean up existing data to prevent unique constraint errors on re-runs
  // await prisma.call.deleteMany();
  // await prisma.user.deleteMany();
  // etc...

  // ---------------------------------------------------------
  // 1. Company, Manager (MAIN_ADMIN) Registration
  // ---------------------------------------------------------
  const company = await prisma.company.create({
    data: { name: 'Sales Garden HQ' }
  });

  const manager = await prisma.manager.create({
    data: {
      name: 'Admin Manager',
      email: 'admin@salesgarden.com',
      companyId: company.id,
    }
  });

    const saltRounds = 10;
    const passwordHash = await hash("adf343rfa%bj$", saltRounds);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@salesgarden.com',
      passwordHash: passwordHash,
      role: Role.MAIN_ADMIN,
      companyId: company.id,
      managerId: manager.id,
      isActive: true
    }
  });
  console.log('✅ Company and Admin User created.');

  // ---------------------------------------------------------
  // 2. LeadDesk Configuration & API Keys
  // ---------------------------------------------------------
  await prisma.aPIKeysAuth.create({
    data: {
      publicKey: `ld-prefix-${crypto.randomUUID()}`,
      secretKeyHash: crypto.createHash('sha256').update('super_secret_key').digest('hex'),
      companyId: company.id
    }
  });

  await prisma.leadDeskCustomData.create({
    data: {
      authString: crypto.randomBytes(16).toString('hex'),
      SeedEventIds: ['1', '2', '3'],
      SaleEventIds: ['4', '5', '6'],
      IANATimeZone: 'Europe/Amsterdam',
      companyId: company.id
    }
  });
  console.log('✅ LeadDesk custom data and API keys configured.');

  // ---------------------------------------------------------
  // 3. Block Schemas & Assignations
  // ---------------------------------------------------------
  const schemaNames = ['Standard Shift', 'Morning Blitz', 'Afternoon Grind', 'Weekend Chill'];
  const schemaIds = []
  for (let i = 0; i < 4; i++) {
    const schema = await prisma.schema.create({
      data: {
        name: schemaNames[i],
        companyId: company.id,
        creatorId: manager.id,
        blocks: {
          create: [
            { startMinutesFromMidnight: 420, endMinutesFromMidnight: 720, blockType: BlockType.WORKING, name: 'Morning Work' },
            { startMinutesFromMidnight: 720, endMinutesFromMidnight: 780, blockType: BlockType.REST, name: 'Lunch' },
            { startMinutesFromMidnight: 780, endMinutesFromMidnight: 1020, blockType: BlockType.WORKING, name: 'Afternoon Work' }
          ]
        }
      }
    });
    schemaIds.push(schema.id)
  }

  for (let i = 0; i < 31; i++) {
    // Assign to the first 4 days of March 2026
    await prisma.schemaAssignation.create({
      data: {
        companyId: company.id,
        schemaId: schemaIds[i%4],
        date: new Date(`2026-03-${(i + 1).toString().padStart(2,"0")}T00:00:00Z`)
      }
    });
  }
  console.log('✅ 4 Block schemas created and assigned to each day of the month evenly.');

  // ---------------------------------------------------------
  // 4. Temporal Goals & Assignations
  // ---------------------------------------------------------
  const goalsData = [
    { name: 'Daily Goals - Aggressive', sales: 15, talkTimeMinutes: 120, seeds: 20, callbacks: 10, leads: 5, numberOfCalls: 50, numberOfLongCalls: 10 },
    { name: 'Daily Goals - Standard', sales: 5, talkTimeMinutes: 60, seeds: 10, callbacks: 5, leads: 2, numberOfCalls: 30, numberOfLongCalls: 5 },
    { name: 'Weekly Goals - Team', sales: 100, talkTimeMinutes: 600, seeds: 200, callbacks: 50, leads: 30, numberOfCalls: 500, numberOfLongCalls: 80 },
    { name: 'Weekend Goals', sales: 2, talkTimeMinutes: 30, seeds: 5, callbacks: 2, leads: 1, numberOfCalls: 15, numberOfLongCalls: 2 }
  ];
  const goalIds = []

  for (let i = 0; i < 4; i++) {
    const goal = await prisma.temporalGoals.create({
      data: {
        ...goalsData[i],
        companyId: company.id,
        creatorId: manager.id
      }
    });

    goalIds.push(goal.id)
  }

  for (let i = 0; i < 31; i++) {
    // Assign to the first 4 days of March 2026
    await prisma.goalsAssignation.create({
      data: {
        companyId: company.id,
        goalId: goalIds[i%4],
        date: new Date(`2026-03-${(i + 1).toString().padStart(2,"0")}T00:00:00Z`)
      }
    });
  }
  console.log('✅ 4 Temporal goals created and assigned to each day of the month evenly.');

  // ---------------------------------------------------------
  // 5. Register 25 Agents with Varied Levels and Profile Images
  // ---------------------------------------------------------
  const profileImages = [
    "https://garden-bucket-test-0x2222.s3.us-east-1.amazonaws.com/profiles/Screenshot+2025-06-05+215849.png",
    "https://garden-bucket-test-0x2222.s3.us-east-1.amazonaws.com/profiles/Screenshot+2025-06-05+220720.png",
    "https://garden-bucket-test-0x2222.s3.us-east-1.amazonaws.com/profiles/Screenshot+2025-06-08+080841.png",
    "https://garden-bucket-test-0x2222.s3.us-east-1.amazonaws.com/profiles/Screenshot+2025-08-08+151622.png"
  ];
  
  const agents = [];
  const passwordHashAgent = await hash("123456", saltRounds);
  
  for (let i = 1; i <= 25; i++) {
    const agent = await prisma.agent.create({
      data: {
        name: `Agent ${i}`,
        companyId: company.id,
        profileImg: profileImages[i % 4],
        agentToThird: {
          create: {
            serviceIdentifier: "LEADDESK",
            agentServiceIdentifier: i.toString()
          }
        },
        agentLevel: {
          create: {
            level: randomInt(1, 3), // Variate levels 1, 2, 3
            since: new Date('2026-02-01T00:00:00Z')
          }
        },
        user: {
          create: {
            email: `agent${i}@salesgarden.com`,
            passwordHash: passwordHashAgent,
            role: Role.AGENT,
            companyId: company.id
          }
        }
      }
    });
    agents.push(agent);
  }
  console.log('✅ 25 Agents registered with images and levels.');

  // ---------------------------------------------------------
  // 6. Simulate 200 Calls (March 2026) & Callees Logic
  // ---------------------------------------------------------
  // Target: 200 total calls. 
  // Rule: ~40% calls (80) repeat to the same numbers, 60% (120) do not repeat.
  const callNumbers: string[] = [];
  
  // Create 120 unique numbers (called exactly once)
  for (let i = 0; i < 120; i++) callNumbers.push(`+3580000${1000 + i}`);
  
  // Create ~30 numbers that repeat to fill the remaining 80 calls
  const repeatingNumbers = Array.from({ length: 30 }, (_, i) => `+3589999${1000 + i}`);
  let repeatsLeft = 80;
  while (repeatsLeft > 0) {
    // Pick a random number from the repeating pool
    callNumbers.push(repeatingNumbers[randomInt(0, repeatingNumbers.length - 1)]);
    repeatsLeft--;
  }

  // Shuffle the distribution to randomize the chronological order
  callNumbers.sort(() => Math.random() - 0.5);

  const startDate = new Date('2026-03-01T00:00:00Z');
  const endDate = new Date('2026-03-31T23:59:59Z');

  for (const phoneNumber of callNumbers) {
    const callDate = randomDate(startDate, endDate);
    const duration = randomInt(10, 900); // Between 10s and 15m
    const agent = agents[randomInt(0, agents.length - 1)];

    // Find or create Callee
    const callee = await prisma.callee.upsert({
      where: { phoneNumber },
      update: { totalAttempts: { increment: 1 } },
      create: { phoneNumber, totalAttempts: 1 }
    });

    // Create the Call
    const call = await prisma.call.create({
      data: {
        agentId: agent.id,
        calleeId: callee.id,
        companyId: company.id,
        startAt: callDate,
        endAt: new Date(callDate.getTime() + duration * 1000),
        durationSeconds: duration,
        dayOfTheWeek: getWeekDay(callDate)
      }
    });

    // Upsert AgentToCallee tracking
    const agentToCalleeId = { agentId: agent.id, calleeId: callee.id };
    await prisma.agentToCallee.upsert({
      where: { agentId_calleeId: agentToCalleeId },
      update: { totalAttemps: { increment: 1 } },
      create: { agentId: agent.id, calleeId: callee.id, totalAttemps: 1 }
    });

    // 50/50 Chance to generate an event
    if (Math.random() > 0.5) {
      const eventTypes = [EventType.SEED, EventType.LEAD, EventType.SALE];
      const selectedType = eventTypes[randomInt(0, eventTypes.length - 1)];
      
      await prisma.funnelEvent.create({
        data: {
          type: selectedType,
          timestamp: call.endAt || callDate,
          callId: call.id,
          agentId: agent.id
        }
      });
    }
  }
  console.log('✅ 200 Calls simulated with callee-repetition and 50/50 event chance.');

  // ---------------------------------------------------------
  // 7. Register Agent States (Feelings)
  // ---------------------------------------------------------
  for (let i = 0; i < 200; i++) {
    const agent = agents[randomInt(0, agents.length - 1)];
    
    await prisma.agentState.create({
      data: {
        agentId: agent.id,
        timestamp: randomDate(startDate, endDate),
        energyScore: randomInt(1, 10),
        focusScore: randomInt(1, 10),
        motivationScore: randomInt(1, 10)
      }
    });
  }
  console.log('✅ 200 Agent state submissions registered.');
  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });