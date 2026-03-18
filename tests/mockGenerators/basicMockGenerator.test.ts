import { describe, it, expect, beforeEach, vi, Mocked, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../app';
import axios from 'axios';
import { getJWT } from '../../utils/authJWT';
import { prisma } from '../../lib/prisma';

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

describe('Mock', () => {


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

    for (let i = 0; i < totalCalls; i++) {
      const callIndex = i;
      const callDate = new Date(startDate.getTime() + (callIndex*6000000) ); // 600_000ms = 10 minutes diff each call
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

    // 10. SIMULATE LEADS (10 agents calling the same person 1-3 times)
    const lead_promises = [];
    const randomAgents = AGENTS.sort(() => 0.5 - Math.random()).slice(0, 10);

    for (const agent of randomAgents) {
      // Create a unique phone number for this specific lead
      const leadPhoneNumber = `+358-LEAD-${Math.floor(Math.random() * 9000) + 1000}`;
      // Randomly decide to call 1, 2, or 3 times
      const callCount = Math.floor(Math.random() * 3) + 1; 

      for (let j = 0; j < callCount; j++) {
        const leadCallIndex = `LEAD-${agent.leadDeskId}-${j}`;
        const talkTime = Math.floor(Math.random() * 300) + 30; // 30s to 5:30m
        
        const mockLeadCall = {
          id: leadCallIndex,
          agent_id: agent.leadDeskId,
          agent_username: agent.name,
          talk_time: talkTime.toString(),
          talk_start: new Date().toISOString().replace('T', ' ').split('.')[0],
          talk_end: new Date(Date.now() + talkTime * 1000).toISOString().replace('T', ' ').split('.')[0],
          number: leadPhoneNumber, // Same number for all iterations in this sub-loop
          order_ids: [] 
        };

        mockedAxios.get.mockResolvedValueOnce({ data: mockLeadCall });

        lead_promises.push(
          request(app)
            .get('/api/leaddesk/webhook')
            .set('Authorization', authHeader)
            .query({ last_call_id: `LD-${leadCallIndex}` })
            .expect(200)
        );
      }
    }

    await Promise.all(lead_promises);

  }, 60000);

  it("generated", ()=>{
    console.log("done")
  })
  
});






