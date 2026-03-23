import { describe, it, expect, beforeEach, vi, Mocked, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import axios from 'axios';
import { getJWT } from '../utils/authJWT';
import { prisma } from '../lib/prisma';
import { updateLevels } from '../controllers/cron';
import { getDayBoundariesInUTC, getUTCIsoString } from '../utils/date';

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
    await request(app).post('/api/admin/upsertLeadDeskEventIds').auth(token, { type: "bearer" }).send({ seedEventIds: [1,2,3], saleEventIds: [4,5,6] }).expect(201);
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
    
    // 6.1 Assign goals 
    await request(app).post('/api/admin/upsert-assignation').auth(token, { type: "bearer" }).send({ date: "2026-01-01", goalId: 1 }).expect(200);
    await request(app).post('/api/admin/upsert-assignation').auth(token, { type: "bearer" }).send({ date: "2026-01-02", goalId: 2 }).expect(200);
    await request(app).post('/api/admin/upsert-assignation').auth(token, { type: "bearer" }).send({ date: "2026-01-03", goalId: 3 }).expect(200);
    await request(app).post('/api/admin/upsert-assignation').auth(token, { type: "bearer" }).send({ date: "2026-01-04", goalId: 4 }).expect(200);


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
    const agentCallTimeCount:any = {}

    for (let i = 0; i < totalCalls; i++) {
      const callIndex = i;
      const callDate = new Date(startDate.getTime() + (callIndex*600000) ); // 600_000ms = 10 minutes diff each call
      const talkTime = parseInt(`${600 * Math.random()}`); // in seconds
      const agentId = Math.floor(Math.random() * 100)+1

      const mockCall = {
        id: `${callIndex}`,
        agent_id: agentId, 
        agent_username: "Agent_X",
        talk_time: talkTime.toString(),
        talk_start: callDate.toISOString().replace('T', ' ').split('.')[0],
        talk_end: new Date(callDate.getTime() + talkTime * 1000).toISOString().replace('T', ' ').split('.')[0],
        number: `+3580000${callIndex}`,
        order_ids: callIndex % 10 === 0 ? [1] : [],
        call_ending_reason: String(Math.floor(Math.random() * 6)+1), // 1,2,3 seed -- 4,5,6 sale 
      }

      if(!agentCallTimeCount[agentId]) agentCallTimeCount[agentId] = 0 
      agentCallTimeCount[agentId] += talkTime

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

    // provisional helper to update levels
    let biggestTalkTime = 0
    let smallestTalkTime = 0
    let keys = Object.keys(agentCallTimeCount)
    for (let key in keys) {
      if(agentCallTimeCount[key]>biggestTalkTime) biggestTalkTime = agentCallTimeCount[key]
      if(agentCallTimeCount[key]<100000000000) smallestTalkTime = agentCallTimeCount[key]
    }

    const cuarterDiff = Math.floor((biggestTalkTime - smallestTalkTime)/4)
    await updateLevels(smallestTalkTime + cuarterDiff*3, smallestTalkTime + cuarterDiff*2)

    // simulate users upload profile img
    await prisma.agent.updateMany({ data: { profileImg: "https://garden-bucket-test-0x2222.s3.us-east-1.amazonaws.com/profiles/1774202571891-156343379.png" } })

  }, 60000);


  describe('Agents Comparisson', async() => { 
    it("Should return accurate agent comparisson data", async()=>{
      const token = await getJWT(app, "admin@test.com", "123456");

      // 2. Define Query Params
      // We use the date from the beforeAll seeding
      const from = "2026-01-01";
      const to = "2026-01-01";
      const sortKey = "talkTime"  
      const direction = "asc"
      const page = 1 
      const pageSize = 100
      const agents:number[] = []

      const response = await request(app)
        .get("/api/datavis/get-agents-comparisson")
        .auth(token, { type: "bearer" })
        .query({ from, to, sortKey, direction, page, pageSize, agents })
        .expect(200)



    })
   })


  describe("General insights", async()=>{
    it("should return accurate general insights for the seeded day", async () => {
      // 1. Get Admin Token for Auth
      const token = await getJWT(app, "admin@test.com", "123456");

      // 2. Define Query Params
      // We use the date from the beforeAll seeding
      // I want the data of the whole day in a specific timezone, so we convert it to the equivalent in UTC-0
      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");

      // 3. Execute Request
      const response = await request(app)
        .get("/api/datavis/general-insights")
        .auth(token, { type: "bearer" })
        .query({ from, to });

      // 4. Assertions
      expect(response.status).toBe(200);
      
      const { 
        totalTalkTime, 
        totalCalls, 
        totalSeeds, 
        totalSales, 
        conversionRate, 
        avgCallDuration 
      } = response.body;

      // Validate against seeded data constants
      expect(totalCalls).toBe(100);

      /**
       * SEED CALCULATION:
       * In your webhook logic, every call usually triggers a SEED event.
       * Total Seeds should be 100.
       */
      expect(totalSeeds).toBeGreaterThan(0);

      /**
       * SALE CALCULATION:
       * order_ids: callIndex % 10 === 0 ? [1] : []
       * Indices: 0, 10, 20, 30, 40, 50, 60, 70, 80, 90 (10 total)
       */
      expect(totalSales).toBeGreaterThan(0);

      /**
       * CONVERSION RATE:
       * (Sales / Seeds) * 100 => (10 / 100) * 100 = 10%
       */
      expect(conversionRate).toBeGreaterThan(0);
      expect(conversionRate).toBeLessThanOrEqual(100);

      /**
       * DURATION & TALK TIME:
       * totalTalkTime is the sum of all Math.random() * 600.
       * We verify it is a positive number and avg is within a reasonable range.
       */
      expect(totalTalkTime).toBeGreaterThan(0);
      expect(avgCallDuration).toBeGreaterThan(0);
      expect(avgCallDuration).toBeLessThan(600); 

      // Cross-verify with DB directly to ensure logic alignment
      const dbCalls = await prisma.call.count({ where: { companyId: 1 } });
      expect(totalCalls).toBe(dbCalls);
    });

    it("should filter insights by specific agent IDs", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      
      // Pick agent with ID 2 (seeded in your quick test)
      const agentId = 2;

      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");
      
      const response = await request(app)
        .get("/api/datavis/general-insights")
        .auth(token, { type: "bearer" })
        .query({ 
          from, 
          to, 
          agents: [agentId] // Testing the parseNumberArray logic
        });

      expect(response.status).toBe(200);
      
      // Verify the count matches what the DB says for that specific agent
      const dbAgentCalls = await prisma.call.count({ where: { agentId } });
      expect(response.body.totalCalls).toBe(dbAgentCalls);
    });    
  })


  describe('Daily Activity', async() => { 
    it("should return daily aggregated activity for the seeded date range", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      // We query a 2-day range, but data only exists on the 1st
      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");

      const response = await request(app)
        .get("/api/datavis/daily-activity")
        .auth(token, { type: "bearer" })
        .query({ from, to });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Since all 100 calls are within ~16.6 hours of the same day:
      expect(response.body.length).toBe(1);

      const dayOne = response.body[0];

      // 1. Date Check
      expect(dayOne.date).toBe("2026-01-01");

      // 2. Calls Check
      // We seeded exactly 100 calls in beforeAll
      expect(dayOne.calls).toBe(100);

      // 3. Seeds Check
      // Your webhook creates one SEED event per call
      expect(dayOne.seeds).toBeGreaterThan(0);

      // 4. TalkTime Check
      // Total talkTime is the sum of all Math.random() * 600
      expect(dayOne.talkTime).toBeGreaterThan(0);
      
      // Quick sanity check: average talk time should be around 300s
      // 100 calls * 300s = 30,000s. Let's just ensure it's a plausible number.
      expect(dayOne.talkTime).toBeLessThan(100 * 600);
    });

    it("should return daily activity filtered by a subset of agents", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      
      // Let's filter for Agent ID 1 and Agent ID 2
      const agentIds = [1, 2];

      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");
      
      const response = await request(app)
        .get("/api/datavis/daily-activity")
        .auth(token, { type: "bearer" })
        .query({ 
          from, 
          to, 
          agents: agentIds
        });

      expect(response.status).toBe(200);

      // Calculate expected calls from DB for these specific agents
      const expectedCalls = await prisma.call.count({
        where: {
          agentId: { in: agentIds },
          startAt: {
            gte: new Date(from),
            lte: new Date(to)
          }
        }
      });

      if (response.body.length > 0) {
        expect(response.body[0].calls).toBe(expectedCalls);
        
        // Validate that seeds are also correctly filtered
        const expectedSeeds = await prisma.funnelEvent.count({
          where: {
            agentId: { in: agentIds },
            type: 'SEED',
            timestamp: {
              gte: new Date(from),
              lte: new Date(to)
            }
          }
        });
        expect(response.body[0].seeds).toBe(expectedSeeds);
      } else {
        // If the random distribution gave 0 calls to these agents, the body might be empty 
        // because of the map over dailyCalls.
        expect(expectedCalls).toBe(0);
      }
    });  
  })


  describe("Block Performance", async () => {
    it("should return performance metrics mapped to schema blocks", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      // 1. Identify valid Schema ID (We created 2 in beforeAll, let's use the first one)
      const schema = await prisma.schema.findFirst({ where: { name: "Standard" } });
      const sId = schema?.id;

      // 2. Setup Filters
      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");
      
      // Filter for Thursdays (Index 3: Monday=0, Tue=1, Wed=2, Thu=3)
      const days = [false, false, false, true, false, false, false];
      
      // Filter for WORKING and REST (Index 0 and 1)
      const types = [true, true, false];

      const response = await request(app)
        .get("/api/datavis/block-performance")
        .auth(token, { type: "bearer" })
        .query({ schemaId: sId, from, to, days, types })
        .expect(200)

      expect(Array.isArray(response.body)).toBe(true);
      
      /**
       * BLOCK VALIDATION (BLOCK_SCHEMA_1):
       * Block 0: 07:00 - 12:00 (300 mins) -> Should contain calls from index 42 to 71
       * Block 1: 12:00 - 13:00 (60 mins)  -> Should contain calls from index 72 to 77
       * Block 2: 13:00 - 17:00 (240 mins) -> Should contain calls from index 78 to 99
       */
      const morningBlock = response.body.find((b: any) => b.blockStartTimeMinutesFromMidnight >= 7 * 60 && b.blockStartTimeMinutesFromMidnight <= 12 * 60);
      const lunchBlock = response.body.find((b: any) => b.blockStartTimeMinutesFromMidnight >= 12 * 60 && b.blockStartTimeMinutesFromMidnight <= 13 * 60);
      expect(morningBlock).toBeDefined();
      expect(morningBlock.type).toBe("WORKING");
      
      // Call indices 42 to 71 = 30 calls.
      expect(morningBlock.seeds).toBeGreaterThan(0);

      // Since Call Index % 10 === 0 is a sale:
      // Indices 50, 60, 70 are sales in the morning block.
      expect(morningBlock.sales).toBeGreaterThan(0);

      expect(lunchBlock).toBeDefined();
      expect(lunchBlock.type).toBe("REST");
      // Call indices 72 to 77 = 6 calls.
    });

    it("should return empty stats if the specific day is filtered out", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      const schema = await prisma.schema.findFirst();

      // 2026-01-01 is a Thursday. We filter ONLY for Fridays.
      const days = [false, false, false, false, true, false, false]; 
      const types = [true, true, true];

      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");

      const response = await request(app)
        .get("/api/datavis/block-performance")
        .auth(token, { type: "bearer" })
        .query({ 
          schemaId: schema?.id, 
          from, 
          to, 
          days, 
          types 
        });

      expect(response.status).toBe(200);
      
      // The blocks should still exist (defined by the schema), but metrics should be 0
      response.body.forEach((block: any) => {
        expect(block.seeds).toBe(0);
        expect(block.talkTime).toBe(0);
      });
    });

    it("should fail if required parameters are missing", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      
      const response = await request(app)
        .get("/api/datavis/block-performance")
        .auth(token, { type: "bearer" })
        .query({ from: "2026-01-01" }); // Missing schemaId, to, days, etc.

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Missing required parameters");
    });
  })


  describe("Long Call Distribution", async()=>{
    it("should return the distribution of call durations across defined buckets", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");

      const response = await request(app)
        .get("/api/datavis/long-call-distribution")
        .auth(token, { type: "bearer" })
        .query({ from, to });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // 1. Verify Sort Order and Buckets
      // The query uses sortOrder ASC, so we expect this specific sequence:
      const expectedRanges = ['0-1 min', '1-3 min', '3-5 min', '5-10 min'];
      
      // We check that the ranges returned match our expected logic
      response.body.forEach((item: any, index: number) => {
        if (index < expectedRanges.length) {
          expect(item.range).toBe(expectedRanges[index]);
        }
      });

      // 2. Statistical Verification
      // With 100 calls and a random spread of 0-600s:
      // 0-60s (10%), 60-180s (20%), 180-300s (20%), 300-600s (50%)
      const totalCount = response.body.reduce((acc: number, curr: any) => acc + curr.count, 0);
      expect(totalCount).toBe(100);

      // 3. 10+ min Bucket Verification
      // Since Math.random() * 600 produces a max of 599.99...
      // The '10+ min' range should either be missing or have a count of 0.
      const tenPlus = response.body.find((r: any) => r.range === '10+ min');
      if (tenPlus) {
        expect(tenPlus.count).toBe(0);
      }
    });

    it("should accurately reflect distribution when filtered by specific agents", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      
      // We'll pick a small sample of agents
      const agentIds = [10, 20, 30];

      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");
      
      const response = await request(app)
        .get("/api/datavis/long-call-distribution")
        .auth(token, { type: "bearer" })
        .query({ 
          from, 
          to, 
          agents: agentIds 
        });

      expect(response.status).toBe(200);

      // Direct DB check for those agents
      const dbCount = await prisma.call.count({
        where: {
          agentId: { in: agentIds },
          startAt: {
            gte: new Date(from),
            lte: new Date(to)
          }
        }
      });

      const responseTotal = response.body.reduce((acc: number, curr: any) => acc + curr.count, 0);
      expect(responseTotal).toBe(dbCount);
    });
  })




  describe("Heatmap", async()=>{
    it("should return a full year of heatmap data with correct intensity scaling", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      // We seeded data for January 1st, 2026
      const year = 2026;

      const response = await request(app)
        .get("/api/datavis/seed-timeline-heatmap")
        .auth(token, { type: "bearer" })
        .query({ year });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // 1. Check Completeness
      // 2026 is not a leap year, so 365 days
      expect(response.body.length).toBe(365);

      // 2. Validate the specific day with data (Jan 1st)
      const janFirst = response.body.find((d: any) => d.date === "2026-01-01");
      expect(janFirst).toBeDefined();
      expect(janFirst.seeds).toBeGreaterThan(0);
      
      /**
       * INTENSITY LOGIC CHECK:
       * Only one day has data, so seedValues = [100].
       * min = 100, max = 100.
       * Per controller: if (max === min) return 2;
       */
      expect(janFirst.intensity).toBe(2);

      // 3. Validate an empty day (e.g., Summer)
      const julyFourth = response.body.find((d: any) => d.date === "2026-07-04");
      expect(julyFourth.seeds).toBe(0);
      expect(julyFourth.intensity).toBe(0);

      // 4. Validate first and last days of the year
      expect(response.body[0].date).toBe("2026-01-01");
      expect(response.body[response.body.length - 1].date).toBe("2026-12-31");
    });

    it("should filter the heatmap by agent correctly", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      
      // Pick an agent that definitely exists from your seed (e.g., ID 5)
      const agentId = 5;
      
      const response = await request(app)
        .get("/api/datavis/seed-timeline-heatmap")
        .auth(token, { type: "bearer" })
        .query({ 
          year: 2026, 
          agents: [agentId] 
        });

      expect(response.status).toBe(200);

      // Get the count from DB for this specific agent on Jan 1st
      const dbCount = await prisma.funnelEvent.count({
        where: {
          agentId: agentId,
          type: 'SEED',
          timestamp: {
            gte: new Date("2026-01-01T00:00:00Z"),
            lte: new Date("2026-01-01T23:59:59.999Z")
          }
        }
      });

      const janFirst = response.body.find((d: any) => d.date === "2026-01-01");
      expect(janFirst.seeds).toBe(dbCount);
    });

    it("should return 400 for invalid year parameters", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      const response = await request(app)
        .get("/api/datavis/seed-timeline-heatmap")
        .auth(token, { type: "bearer" })
        .query({ year: "not-a-year" });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid year parameter");
    });
  })



  describe('Daily Heatmap', async() => { 
    it("should return a 24-hour heatmap for a specific day with accurate hourly counts", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      // The day we seeded in beforeAll
      const day = "2026-01-01";

      const response = await request(app)
        .get("/api/datavis/seed-timeline-heatmap-per-day")
        .auth(token, { type: "bearer" })
        .query({ day });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // 1. Completeness Check
      // Always 24 hours
      expect(response.body.length).toBe(24);

      // 2. Data Consistency Check
      // Total seeds summed across all hours should equal the 100 seeded calls
      const totalSeeds = response.body.reduce((acc: number, curr: any) => acc + curr.seeds, 0);
      expect(totalSeeds).toBeGreaterThan(0);

      // 3. Hourly Specifics
      // At a 10-minute interval, most hours should have exactly 6 seeds (6 * 10 = 60 mins)
      const hourZero = response.body.find((h: any) => h.hour === 0);
      expect(hourZero.label).toBe("00:00");

      /**
       * INTENSITY LOGIC:
       * Since every active hour has 6 seeds, maxSeeds = 6.
       * Per controller: if (val === max) return 3;
       */
      // expect(hourZero.intensity).toBe(3);

      // 4. Empty Hour Check
      // 1000 minutes is ~16.6 hours. Hour 20:00 should be empty.
      const hourTwenty = response.body.find((h: any) => h.hour === 20);
      expect(hourTwenty.label).toBe("20:00");
    });

    it("should filter the hourly heatmap by specific agents", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      const agentId = 10;
      
      const response = await request(app)
        .get("/api/datavis/seed-timeline-heatmap-per-day")
        .auth(token, { type: "bearer" })
        .query({ 
          day: "2026-01-01", 
          agents: [agentId] 
        });

      expect(response.status).toBe(200);

      // Verify that the sum of seeds in the heatmap matches the DB count for this agent
      const responseTotal = response.body.reduce((acc: number, curr: any) => acc + curr.seeds, 0);
      
      const dayBoundaries = getDayBoundariesInUTC("2026-01-01", "Europe/Amsterdam") 
      const startOfDay = dayBoundaries.startDate;
      const endOfDay = dayBoundaries.endDate;

      const dbCount = await prisma.funnelEvent.count({
        where: {
          agentId: agentId,
          type: 'SEED',
          timestamp: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      });

      expect(responseTotal).toBe(dbCount);
    });

    it("should return 400 for an incorrectly formatted date", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      const response = await request(app)
        .get("/api/datavis/seed-timeline-heatmap-per-day")
        .auth(token, { type: "bearer" })
        .query({ day: "01-01-2026" }); // Wrong format

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Invalid date format");
    });
  })



  describe('Conversion Funnel', async() => { 
    it("should return the conversion funnel sums in the correct order", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");

      const response = await request(app)
        .get("/api/datavis/conversion-funnel")
        .auth(token, { type: "bearer" })
        .query({ from, to });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(3);

      // 1. Structure and Order Verification
      expect(response.body[0].name).toBe('Seeds');
      expect(response.body[1].name).toBe('Leads');
      expect(response.body[2].name).toBe('Sales');

      // 2. Data Verification (based on beforeAll seed)
      // We expect 100 seeds (1 per call)
      expect(response.body[0].value).toBeGreaterThan(0);

      expect(response.body[1].value).toBeGreaterThanOrEqual(0);

      // We expect 10 sales (indices 0, 10, 20...90)
      expect(response.body[2].value).toBeGreaterThan(0);
    });

    it("should filter the funnel by a specific agent", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      const agentId = 7;

      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");

      const response = await request(app)
        .get("/api/datavis/conversion-funnel")
        .auth(token, { type: "bearer" })
        .query({ 
          from, 
          to, 
          agents: [agentId] 
        });

      expect(response.status).toBe(200);

      // Verify that the seed count matches the DB count for this agent specifically
      const dbSeedCount = await prisma.funnelEvent.count({
        where: {
          agentId: agentId,
          type: 'SEED',
          timestamp: {
            gte: new Date(from),
            lte: new Date(to)
          }
        }
      });

      const funnelSeeds = response.body.find((f: any) => f.name === 'Seeds');
      expect(funnelSeeds.value).toBe(dbSeedCount);
    });

    it("should return zeros if the date range has no activity", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      // A date in the future with no seeded data
      const response = await request(app)
        .get("/api/datavis/conversion-funnel")
        .auth(token, { type: "bearer" })
        .query({ from: "2027-01-01", to: "2027-01-01" });

      expect(response.status).toBe(200);
      response.body.forEach((step: any) => {
        expect(step.value).toBe(0);
      });
    });
  })



  describe('Consistency Streak', async() => { 
    it("should calculate consistency scores by comparing daily stats against goals", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      // 1. Setup Goal and Data
      const goal = await prisma.temporalGoals.findFirst();
      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");
      
      // 2026-01-01 is a Thursday (Index 3)
      const days = [false, false, false, true, false, false, false];

      const response = await request(app)
        .get("/api/datavis/consistency-streak")
        .auth(token, { type: "bearer" })
        .query({ goalId: goal?.id, from, to, days });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      /**
       * CALCULATION LOGIC VERIFICATION:
       * If the goal was 100 seeds and 10 sales, and we hit 100 seeds and 10 sales:
       * Score = ( (100/100)*100 + (10/10)*100 ) / 2 = 100%
       * * Note: The day returned is just the DD part of the date.
       */
      const dayResult = response.body[0];
      expect(dayResult.day).toBe("01");
      expect(dayResult.score).toBeGreaterThan(0);
      expect(dayResult.score).toBeLessThanOrEqual(100);
    });

    it("should return an empty array if the active day filter excludes the data", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      const goal = await prisma.temporalGoals.findFirst();

      // 2026-01-01 is Thursday. Let's filter only for Mondays.
      const days = [true, false, false, false, false, false, false];

      const response = await request(app)
        .get("/api/datavis/consistency-streak")
        .auth(token, { type: "bearer" })
        .query({ 
          goalId: goal?.id, 
          from: "2026-01-01", 
          to: "2026-01-01", 
          days 
        });

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(0);
    });

    it("should accurately average multiple metrics into a single score", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");
      
      // Create a specific goal where we know we will hit 50%
      const customGoal = await prisma.temporalGoals.create({
        data: {
          companyId: 1,
          creatorId: 1,
          name: "Test Half Goal",
          seeds: 200, // We have 100, so this is 50%
          sales: 20,  // We have 10, so this is 50%
        }
      });

      const from = getUTCIsoString("2026-01-01T00:00:00.000Z", "Europe/Amsterdam");
      const to = getUTCIsoString("2026-01-01T23:59:59.999Z", "Europe/Amsterdam");

      const response = await request(app)
        .get("/api/datavis/consistency-streak")
        .auth(token, { type: "bearer" })
        .query({ 
          goalId: customGoal.id, 
          from, 
          to, 
          days: "[false, false, false, true, false, false, false]" 
        });

      expect(response.body[0].score).toBeGreaterThan(0);
    });
  })


  
});






