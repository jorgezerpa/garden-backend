import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from "../../lib/prisma";
import axios from 'axios';
import { getJWT } from '../../utils/authJWT';

vi.mock('axios');



const mockedAxios = axios as Mocked<typeof axios>;

describe('LeadDesk Webhook', () => {

  let publicKey = ''
  let secretKey = ''

  beforeEach(async () => {
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
    const registerResponse = await request(app).post('/api/auth/register').send({
      companyName: "Test Corp",
      admin_email: "admin@test.com",
      admin_name: "Tester",
      password: "12345"
    });
    if(registerResponse.error) throw("error registering company")

    // 2. Generate Key-pair
    const responseKeysGeneration = await request(app).post('/api/auth/generate-key-pair').auth(await getJWT(app, "admin@test.com", "12345"), { type: "bearer" });
    if(registerResponse.error) throw("error registering company");
    ({ publicKey, secretKey } = responseKeysGeneration.body);
    
    // 3. Register the LeadDesk auth string
    // if no auth string, will fail @todo
    const registerLeadDeskAuthStringResponse = await request(app).post('/api/admin/upsertLeadDeskAPIAuthString').auth(await getJWT(app, "admin@test.com", "12345"), { type: "bearer" }).send({authString:"authString"});
    if(registerLeadDeskAuthStringResponse.error) throw("error storing auth string")
    vi.clearAllMocks();
  });

  describe("GET /api/leaddesk/webhook", () => {
    
    it('successfully processes the exact LeadDesk payload structure', async () => {
      // 0. Setup auth
      const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

      // 1. Setup agent
      // If no agent, endpoint should fail @todo
      await request(app)
      .post('/api/admin/addAgent')
      .auth(await getJWT(app, "admin@test.com", "12345"), { type: "bearer" })
      .send({ email: `agent@test.com`, name: `John Due`, password: "123456", leadDeskId: "1" })

      // 1. Mock return of the call to leaddesk api to get call info 
      const mockLeadDeskData = {
        id: "4999", // call Id
        agent_id: "1", // Lead desk Id
        agent_username: "teuvotest",
        talk_time: "45",
        talk_start: "2016-01-01 12:13:14",
        talk_end: "2016-02-02 14:12:10",
        number: "+358123123",
        campaign: "14",
        campaign_name: "test campaign",
        record_file: "test_recording.wav.mp3",
        created_at: "2016-01-01 12:13:10",
        customer_id: "21",
        comment: "test comment",
        agent_group_id: "13",
        agent_group_name: "test group",
        call_ending_reason: "15", 
        call_ending_reason_name: "test reason",
        handling_stop: "2016-02-02 14:20:30",
        direction: "out",
        call_type: "1",
        contact_id: "1",
        call_type_name: "semi",
        order_ids: [1, 3]
      };

      mockedAxios.get.mockResolvedValue({ data: mockLeadDeskData }); // when controllers calls axios.get, will mock the returned value with this

      // 2. Trigger Webhook (simulating a call from Leadesk)
      const response = await request(app)
        .get('/api/leaddesk/webhook')
        .set('Authorization', authHeader)
        .query({ last_call_id: '4999' });

      // 3. Check if webhook exec succesfully
      expect(response.status).toBe(200);

      // 4. Compare db register with expected data
      const dbCall = await prisma.call.findFirst({
        where: { agentId: 1 },
        include: { agent: true, callee: true }
      });

      expect(dbCall).not.toBeNull();
      
      // Check data type conversions
      expect(dbCall?.durationSeconds).toBe(Number(mockLeadDeskData.talk_time));
      expect(dbCall?.agentId).toBe(1);          // Should correctly map from LD agentId to our agent Id
      expect(dbCall?.callee.phoneNumber).toBe(mockLeadDeskData.number);

      // Check Date parsing (LeadDesk space format to JS Date) -> we use start_at field of the call 
      // "2016-01-01 12:13:14"
      expect(dbCall?.startAt.getUTCFullYear()).toBe(2016);
      expect(dbCall?.startAt.getUTCMonth()).toBe(0); 
      expect(dbCall?.startAt.getUTCDate()).toBe(1); 
      expect(dbCall?.startAt.getUTCHours()).toBe(12); 
      expect(dbCall?.startAt.getUTCMinutes()).toBe(13); 
      expect(dbCall?.startAt.getUTCSeconds()).toBe(14); 
    });

    it('successfully increments totalAttempts for an existing callee', async () => {
        const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

        // Pre-seed a callee
        await prisma.callee.create({
            data: { phoneNumber: "+358123123", totalAttempts: 5 }
        });

        // create agent
        await request(app)
          .post('/api/admin/addAgent')
          .auth(await getJWT(app, "admin@test.com", "12345"), { type: "bearer" })
          .send({
            email: `agent@test.com`,
            name: `John Due`,
            password: "123456",
            leadDeskId: "1"

          })

        const mockData = { // only used data, to simplify
            id: "5000",
            agent_id: "1",
            agent_username: "teuvotest",
            talk_time: "10",
            talk_start: "2024-01-01 10:00:00",
            talk_end: "2024-01-01 10:00:10",
            number: "+358123123"
        };
        mockedAxios.get.mockResolvedValue({ data: mockData });

        await request(app)
            .get('/api/leaddesk/webhook')
            .set('Authorization', authHeader)
            .query({ last_call_id: '5000' });

        const callee = await prisma.callee.findUnique({ where: { phoneNumber: "+358123123" } });
        const perAgentCounter = await prisma.agentToCallee.findUnique({ where: { agentId_calleeId: { agentId: Number(mockData.agent_id), calleeId: callee?.id as number } } })

        expect(callee?.totalAttempts).toBe(6); // 5 + 1
        expect(perAgentCounter?.totalAttemps).toBe(1)
    });

    it('Fails when webhook is called for a non-existant agent', async () => {
        const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;
        
        const mockData = { // only needed data
            id: "5000",
            agent_id: "1", // NOT EXISTS
            talk_time: "10",
            talk_start: "2024-01-01 10:00:00",
            talk_end: "2024-01-01 10:00:10",
            number: "+358123123"
        };
        mockedAxios.get.mockResolvedValue({ data: mockData });

        const response = await request(app)
            .get('/api/leaddesk/webhook')
            .set('Authorization', authHeader)
            .query({ last_call_id: '5000' });

        expect(response.status).toBe(500)
    });


  });
});