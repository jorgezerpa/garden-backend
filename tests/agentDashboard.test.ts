import { describe, it, expect, beforeEach, vi, Mocked, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import axios from 'axios';
import { getJWT } from '../utils/authJWT';
import { prisma } from '../lib/prisma';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

const REGISTER_COMPANY_OBJECT = { companyName: "Test Corp", admin_email: "admin@test.com", admin_name: "Tester", password: "123456" }
const BLOCK_SCHEMA_1 = {
  name: "Standard",
  blocks: [
    { startMinutesFromMidnight: 7*60, endMinutesFromMidnight: 12*60, blockType: "WORKING", name: "Morning block 1" },
    { startMinutesFromMidnight: 12*60, endMinutesFromMidnight: 13*60, blockType: "REST", name: "Lunch break" },
    { startMinutesFromMidnight: 13*60, endMinutesFromMidnight: 17*60, blockType: "WORKING", name: "Afternoon block 1" },
  ] 
}
const BLOCK_SCHEMA_2 = {
  name: "Hourly division",
  blocks: [
    { startMinutesFromMidnight: 7*60, endMinutesFromMidnight: 8*60, blockType: "WORKING", name: "Morning block 1" },
    { startMinutesFromMidnight: 8*60, endMinutesFromMidnight: 9*60, blockType: "WORKING", name: "Lunch break" },
    { startMinutesFromMidnight: 9*60, endMinutesFromMidnight: 10*60, blockType: "WORKING", name: "Lunch break" },
    { startMinutesFromMidnight: 10*60, endMinutesFromMidnight: 11*60, blockType: "WORKING", name: "Lunch break" },
    { startMinutesFromMidnight: 11*60, endMinutesFromMidnight: 12*60, blockType: "WORKING", name: "Lunch break" },
    { startMinutesFromMidnight: 12*60, endMinutesFromMidnight: 13*60, blockType: "WORKING", name: "Lunch break" },
    { startMinutesFromMidnight: 13*60, endMinutesFromMidnight: 14*60, blockType: "REST", name: "Lunch break" },
    { startMinutesFromMidnight: 14*60, endMinutesFromMidnight: 15*60, blockType: "WORKING", name: "Lunch break" },
    { startMinutesFromMidnight: 15*60, endMinutesFromMidnight: 16*60, blockType: "WORKING", name: "Lunch break" },
    { startMinutesFromMidnight: 16*60, endMinutesFromMidnight: 17*60, blockType: "WORKING", name: "Lunch break" },
    { startMinutesFromMidnight: 17*60, endMinutesFromMidnight: 18*60, blockType: "WORKING", name: "Lunch break" },
  ] 
} 
const GOALS_1 = {name: "Daily Goals Week Day - Per User",sales: 10,talkTime: 30,seeds: 5,callbacks: 20,leads:3,numberOfCalls:10,numberOfLongCalls: 4 }
const GOALS_2 = {name: "Daily Goals Week Day - Team",sales: 100,talkTime: 100,seeds: 50,callbacks: 200,leads:30,numberOfCalls:100,numberOfLongCalls: 40,      }
const GOALS_3 = {name: "Daily Goals Week End - Per user",sales: 5,talkTime: 20,seeds: 3,callbacks: 10,leads: 1,numberOfCalls:7,numberOfLongCalls: 2,}
const GOALS_4 = {name: "Daily Goals Week End - Team",sales: 503,talkTime: 220,seeds: 34,callbacks: 140,leads: 61,numberOfCalls:27,numberOfLongCalls: 52,}
let AGENTS = []
const CALLS = []
const FEELINGS = []
let PUBLIC_KEY = ''
let SECRET_KEY = ''

describe('Datavis', () => {


  beforeAll(async () => {
    // 0. Clean DB
    const tablenames = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`
    );
    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" RESTART IDENTITY CASCADE;`);
      }
    }

    // 1. Setup Company id 1, also admin id 1
    const registerResponse = await request(app).post('/api/auth/register').send(REGISTER_COMPANY_OBJECT);
    if(registerResponse.error) throw("error registering company")

    // 2. Get token
    const token = await getJWT(app, "admin@test.com", "123456");

    // 3. Generate Key-pair
    const responseKeysGeneration = await request(app).post('/api/auth/generate-key-pair').auth(token, { type: "bearer" });
    if(registerResponse.error) throw("error registering company");
    const { publicKey, secretKey } = responseKeysGeneration.body;
    PUBLIC_KEY = publicKey
    SECRET_KEY = secretKey
    // 4. Register the LeadDesk auth string
    const registerLeadDeskAuthStringResponse = await request(app).post('/api/admin/upsertLeadDeskAPIAuthString').auth(token, { type: "bearer" }).send({authString:"authString"});
    if(registerLeadDeskAuthStringResponse.error) throw("error storing auth string")
    vi.clearAllMocks();

    // 5. create block schemas
    await request(app)
        .post('/api/schema/create')
        .auth(token, { type: "bearer" })
        .send(BLOCK_SCHEMA_1); 

    await request(app)
    .post('/api/schema/create')
    .auth(token, { type: "bearer" })
    .send(BLOCK_SCHEMA_2); 

    // 6. Create goals 
    await request(app).post('/api/admin/goals/create').auth(token, { type: "bearer" }).send(GOALS_1);
    await request(app).post('/api/admin/goals/create').auth(token, { type: "bearer" }).send(GOALS_2);
    await request(app).post('/api/admin/goals/create').auth(token, { type: "bearer" }).send(GOALS_3);
    await request(app).post('/api/admin/goals/create').auth(token, { type: "bearer" }).send(GOALS_4);

    // 7. Register 100 Agents
    AGENTS = Array.from({ length: 100 }, (_, i) => ({
        email: `agent${i+1}@test.com`,
        name: `John-${i+1} Due`,
        password: "123456",
        leadDeskId: String(i+1)
    }));
    
    for (const agent of AGENTS) {
      await request(app).post('/api/admin/addAgent').auth(token, { type: 'bearer' }).send(agent).expect(201);
    }
    
    // 8. SIMULATE WEBHOOK CALLS 
    const totalCalls = 100;
    const startDate = new Date("2026-01-01T00:00:00Z");
    const authHeader = `Basic ${Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64')}`;
    const promises = [];

    for (let i = 0; i < totalCalls; i++) {
      const callIndex = i;
      const callDate = new Date(startDate.getTime() + (callIndex*600000) ); // 600_000ms = 10 minutes diff each call
      const talkTime = parseInt(`${600 * Math.random()}`); // in seconds

      const mockCall = {
        id: `${callIndex}`,
        agent_id: Math.floor(Math.random() * 100)+1, 
        agent_username: "Agent_X",
        talk_time: talkTime.toString(),
        talk_start: callDate.toISOString().replace('T', ' ').split('.')[0],
        talk_end: new Date(callDate.getTime() + talkTime * 1000).toISOString().replace('T', ' ').split('.')[0],
        number: `+3580000${callIndex}`,
        order_ids: callIndex % 10 === 0 ? [1] : []
      }

      mockedAxios.get.mockResolvedValueOnce({
          data: mockCall
      });

      CALLS.push(mockCall)      

      // 2. Add the request promise to our chunk array
      promises.push(
          request(app)
            .get('/api/leaddesk/webhook')
            .set('Authorization', authHeader)
            .query({ last_call_id: `LD-${callIndex}` })
            .expect(200)
          );
    }

    await Promise.all(promises);


    // 9. SIMULATE AGENTS SUPPLY FEELINGS 
    const feelings_promises = [];

    for (let i = 0; i < totalCalls; i++) {
      const callIndex = i;

      const feelings = { energy: Math.floor(Math.random()*10+1), focus: Math.floor(Math.random()*10+1), motivation: Math.floor(Math.random()*10+1) }      
      FEELINGS.push(feelings)

      const promiseWithToken = async() => {
        const token = await getJWT(app, `agent${Math.floor(Math.random()*100)+1}@test.com`, "123456")
        await request(app)
          .post("/api/agent-dashboard/register-agent-state")
          .auth(token, { type: "bearer" })
          .send(feelings)
          .expect(200)
      }

      feelings_promises.push(promiseWithToken()) 
    }

    await Promise.all(feelings_promises)

  }, 60000);



    describe('Agent Day Insights', async() => { 
      it("should return detailed personal insights for ONLY the authenticated agent", async () => {
        // 1. Setup: Get the specific agent's ID from the DB
        const token = await getJWT(app, "agent1@test.com", "123456");
        const user = await prisma.user.findUnique({ 
          where: { email: "agent1@test.com" } 
        });
        const agentId = user?.agentId;
        if(!agentId) throw("no agent")
        const date = "2026-01-01";

        const response = await request(app)
          .get("/api/agent-dashboard/get-agent-day-insights")
          .auth(token, { type: "bearer" })
          .query({ date });

        expect(response.status).toBe(200);

        // 2. Perform independent DB counts for this specific agent
        const startOfDay = new Date(`${date}T00:00:00.000Z`);
        const endOfDay = new Date(`${date}T23:59:59.999Z`);

        const expectedCallCount = await prisma.call.count({
          where: {
            agentId,
            startAt: { gte: startOfDay, lte: endOfDay }
          }
        });

        const expectedDeepCallCount = await prisma.call.count({
          where: {
            agentId,
            startAt: { gte: startOfDay, lte: endOfDay },
            durationSeconds: { gte: 300 }
          }
        });

        // 3. Assertions
        expect(response.body.number_of_calls).toBe(expectedCallCount);
        expect(response.body.number_of_deep_call).toBe(expectedDeepCallCount);
        
        // Also verify it's not returning the whole company's data (100)
        // unless this agent happened to make all 100 calls (unlikely with 10 agents)
        expect(response.body.number_of_calls).toBeLessThan(100);

        // 4. Verification of latest State (Feelings)
        // If no state was registered yet, it should be 0 (as per your controller)
        expect(response.body.energy).toBeDefined();
      });
    })


    describe('Agent weekly growth', async() => { 
      it("should return the weekly growth trend using ONLY the authenticated agent's data", async () => {
        // 1. Get Token and find the specific Agent ID for this user
        const token = await getJWT(app, "agent1@test.com", "123456");
        const user = await prisma.user.findUnique({ 
          where: { email: "agent1@test.com" } 
        });
        const agentId = user?.agentId;
        if(!agentId) throw("no agent")
        const targetDate = "2026-01-01"; // The seeded Thursday

        // 2. Execute Request
        const response = await request(app)
          .get("/api/agent-dashboard/get-agent-weekly-growth")
          .auth(token, { type: "bearer" })
          .query({ date: targetDate });

        expect(response.status).toBe(200);

        // 3. Independent DB check for this specific agent on that specific day
        const startOfDay = new Date(`${targetDate}T00:00:00.000Z`);
        const endOfDay = new Date(`${targetDate}T23:59:59.999Z`);

        const [calls, events, deepCalls] = await Promise.all([
          prisma.call.count({ where: { agentId, startAt: { gte: startOfDay, lte: endOfDay } } }),
          prisma.funnelEvent.findMany({ where: { agentId, timestamp: { gte: startOfDay, lte: endOfDay } } }),
          prisma.call.count({ where: { agentId, startAt: { gte: startOfDay, lte: endOfDay }, durationSeconds: { gte: 300 } } }),
        ]);

        const s = events.filter(e => e.type === "SEED").length;
        const l = events.filter(e => e.type === "LEAD").length;
        const sa = events.filter(e => e.type === "SALE").length;

        // Manual calculation of the expected growth score
        const expectedGrowth = s + (l * 2) + (sa * 3) + calls + (deepCalls * 2);

        // 4. Assertion
        const thursdayData = response.body.find((d: any) => d.day === "Thu");
        expect(thursdayData.growth).toBe(expectedGrowth);
        
      });
    })



    describe('Assigned Schema', async() => { 
        it("should return the assigned schema and blocks for the company", async () => {
            const token = await getJWT(app, "agent1@test.com", "123456");
            const date = "2026-01-01";

            const response = await request(app)
                .get("/api/agent-dashboard/get-assigned-schema")
                .auth(token, { type: "bearer" })
                .query({ date });

            expect(response.status).toBe(200);
            
            if (response.body) {
                expect(response.body).toHaveProperty("blocks");
                expect(Array.isArray(response.body.blocks)).toBe(true);
                // Verify sorting
                const blocks = response.body.blocks;
                if (blocks.length > 1) {
                expect(blocks[0].startMinutesFromMidnight).toBeLessThan(blocks[1].startMinutesFromMidnight);
                }
            }
        });
     })



    describe('Set agent feelings', async() => {
        it("should successfully register the agent's psychological state", async () => {
            const token = await getJWT(app, "agent1@test.com", "123456");
            
            const payload = {
                energy: 8,
                focus: 9,
                motivation: 7
            };

            const response = await request(app)
                .post("/api/agent-dashboard/register-agent-state")
                .auth(token, { type: "bearer" })
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.energyScore).toBe(8);
            expect(response.body.focusScore).toBe(9);

            // Validate that out-of-bounds scores fail
            const badResponse = await request(app)
                .post("/api/agent-dashboard/register-agent-state")
                .auth(token, { type: "bearer" })
                .send({ energy: 11, focus: 5, motivation: 5 });

            expect(badResponse.status).toBe(500); // Controller throws error
        });
    })



})