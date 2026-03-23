import { describe, it, vi, Mocked, beforeAll, expect, } from 'vitest';
import request from 'supertest';
import app from '../app';
import axios from 'axios';
import { getJWT } from '../utils/authJWT';
import { prisma } from '../lib/prisma';
import { updateLevels } from '../controllers/cron';

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
    const startDate = new Date("2026-03-22T00:00:00Z");
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




  describe('Agents Positions (Ranking)', async () => {
    it("Should return a ranked list of agents with performance scores and levels", async () => {
      const token = await getJWT(app, "admin@test.com", "123456");

      const query = {
        from: "2026-01-01",
        to: "2026-01-01",
        page: 1,
        pageSize: 10
      };

      const response = await request(app)
        .get("/api/shared-screen/get_agents_positions")
        .auth(token, { type: "bearer" })
        .query(query)
        .expect(200);

      // 1. Verify Structure
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      // 2. Verify Pagination
      expect(response.body.data.length).toBe(10);
      expect(response.body.meta.currentPage).toBe(1);
      expect(response.body.meta.totalAgents).toBe(100); // We seeded 100 agents

      // 3. Verify Data Content
      const firstAgent = response.body.data[0];
      expect(firstAgent).toHaveProperty('name');
      expect(firstAgent).toHaveProperty('callingTime');
      expect(firstAgent).toHaveProperty('seeds');
      expect(firstAgent).toHaveProperty('sales');
      expect(firstAgent).toHaveProperty('currentLevel');
      expect(firstAgent).toHaveProperty('averageScore');
      expect(firstAgent).toHaveProperty('profileImg');

      // 4. Verify Sorting (High to Low)
      if (response.body.data.length >= 2) {
        const topScore = response.body.data[0].averageScore;
        const secondScore = response.body.data[1].averageScore;
        expect(topScore).toBeGreaterThanOrEqual(secondScore);
      }

      // 5. Verify currentLevel defaults to 3 if not set
      // (Since we didn't explicitly seed AgentLevel rows, they should be 3)
      expect(firstAgent.currentLevel).toBe(3);
    });

    it("Should return 400 if date parameters are missing", async () => {
        const token = await getJWT(app, "admin@test.com", "123456");
        await request(app)
          .get("/api/shared-screen/get_agents_positions")
          .auth(token, { type: "bearer" })
          .query({ page: 1 }) // missing from/to
          .expect(400);
    });
  });












});