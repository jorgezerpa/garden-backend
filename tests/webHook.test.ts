import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('LeadDesk Webhook Actual Data testing', () => {

  beforeEach(async () => {
    // Clean DB
    const tablenames = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`
    );
    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" RESTART IDENTITY CASCADE;`);
      }
    }

    // Setup Company using the name expected by controller via Basic Auth
    await prisma.company.create({
      data: { name: "REAL_LEADDESK_KEY" }
    });

    vi.clearAllMocks();
  });

  describe("GET /api/leaddesk/webhook", () => {
    const authHeader = `Basic ${Buffer.from('REAL_LEADDESK_KEY:secret').toString('base64')}`;

    it('successfully processes the exact LeadDesk payload structure', async () => {
      // 1. Precise LeadDesk Mock Data
      const mockLeadDeskData = {
        id: "4999",
        agent_id: "11",
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

      mockedAxios.get.mockResolvedValue({ data: mockLeadDeskData });

      // 2. Trigger Webhook
      const response = await request(app)
        .get('/api/leaddesk/webhook')
        .set('Authorization', authHeader)
        .query({ last_call_id: '4999' });

      // 3. Status Assertions
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('success');

      // 4. DB Assertions - Mapping checks
      const dbCall = await prisma.call.findFirst({
        where: { leadDeskId: "4999" },
        include: { agent: true, callee: true }
      });

      expect(dbCall).not.toBeNull();
      
      // Check data type conversions
      expect(dbCall?.durationSeconds).toBe(45); // Parsed from "45"
      expect(dbCall?.agentId).toBe(11);          // Parsed from "11"
      expect(dbCall?.agent.name).toBe("teuvotest");
      expect(dbCall?.callee.phoneNumber).toBe("+358123123");

      // Check Date parsing (LeadDesk space format to JS Date)
      // "2016-01-01 12:13:14"
      expect(dbCall?.startAt.getUTCFullYear()).toBe(2016);
      expect(dbCall?.startAt.getUTCMonth()).toBe(0); // January is 0
    });

    it('successfully increments totalAttempts for an existing callee', async () => {
        // Pre-seed a callee
        await prisma.callee.create({
            data: { phoneNumber: "+358123123", totalAttempts: 5 }
        });

        const mockData = {
            id: "5000",
            agent_id: "11",
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
        expect(callee?.totalAttempts).toBe(6); // 5 + 1
    });
  });
});