import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('DataVis Integration with Webhook Seeding', () => {
  const apiKey = "Analytics_Corp";
  const authHeader = `Basic ${Buffer.from(`${apiKey}:pass`).toString('base64')}`;

  beforeEach(async () => {
    // 1. Reset Database
    const tablenames = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`
    );
    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" RESTART IDENTITY CASCADE;`);
      }
    }

    // 2. Setup Company & Schema
    const company = await prisma.company.create({ data: { name: apiKey } });
    const manager = await prisma.manager.create({ data: { name: "Boss", email: "b@b.com", companyId: company.id } });
    
    // Seed a daily schema for block-performance tests
    await prisma.schema.create({
      data: {
        id: 1, name: "Standard", companyId: company.id, creatorId: manager.id,
        schemaDays: {
          create: [{
            dayIndex: 0,
            blocks: {
              create: [
                { name: "Morning", startMinutesFromMidnight: 480, endMinutesFromMidnight: 720 },
                { name: "Afternoon", startMinutesFromMidnight: 720, endMinutesFromMidnight: 1080 }
              ]
            }
          }]
        }
      }
    });

    // 3. SEED 100 CALLS VIA WEBHOOK
    // We'll spread 100 calls over 30 days (approx 3-4 calls per day)
    const startDate = new Date("2024-05-01T09:00:00Z");
    
    for (let i = 0; i < 100; i++) {
      const callDate = new Date(startDate.getTime() + i * (7 * 60 * 60 * 1000)); // Every 7 hours
      const talkTime = 60 + (i * 10); // Increasing duration for variation

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          id: `LD-${i}`,
          agent_id: "1",
          agent_username: "Agent_1",
          talk_time: talkTime.toString(),
          talk_start: callDate.toISOString().replace('T', ' ').split('.')[0],
          talk_end: new Date(callDate.getTime() + talkTime * 1000).toISOString().replace('T', ' ').split('.')[0],
          number: `+3580000${i}`,
          order_ids: i % 10 === 0 ? [1] : [] // Every 10th call is a sale
        }
      });

      await request(app)
        .get('/api/leaddesk/webhook')
        .set('Authorization', authHeader)
        .query({ last_call_id: `LD-${i}` });
        
      // If the call was a "sale" based on our logic above, manually add a FunnelEvent 
      // (Assuming your webhook doesn't do this automatically yet)
      if (i % 10 === 0) {
        const lastCall = await prisma.call.findFirst({ orderBy: { id: 'desc' } });
        await prisma.funnelEvent.create({
          data: { type: 'SALE', agentId: 1, callId: lastCall!.id, timestamp: callDate }
        });
      }
    }
  });

  describe("Analytics Verification", () => {
    it('GET /daily-activity returns data spread across the month', async () => {
      const response = await request(app)
        .get('/api/datavis/daily-activity')
        .query({ companyId: 1, from: "2024-05-01", to: "2024-05-30" });

      expect(response.status).toBe(200);
      // Since we did 100 calls every 7 hours, we should have nearly 30 days of data
      expect(response.body.length).toBeGreaterThan(25);
      expect(response.body[0]).toHaveProperty('talkTime');
    });

    it('GET /block-performance calculates stats correctly for seeded blocks', async () => {
      const response = await request(app)
        .get('/api/datavis/block-performance')
        .query({ companyId: 1, schemaId: 1, from: "2024-05-01", to: "2024-05-02" });

      expect(response.status).toBe(200);
      // Should find calls that fell into "Morning" (480-720 mins) or "Afternoon"
      const totalTalk = response.body.reduce((acc: number, b: any) => acc + b.talkTime, 0);
      expect(totalTalk).toBeGreaterThan(0);
    });

    it('GET /long-call-distribution categorizes our 100 calls', async () => {
      const response = await request(app)
        .get('/api/datavis/long-call-distribution')
        .query({ companyId: 1, from: "2024-05-01", to: "2024-06-01" });

      expect(response.status).toBe(200);
      const tenPlus = response.body.find((b: any) => b.range === '10+ min');
      expect(tenPlus.count).toBeGreaterThan(0); // Our increasing i*10 duration ensures this
    });

    it('GET /seed-timeline-heatmap generates intensity values', async () => {
      const response = await request(app)
        .get('/api/datavis/seed-timeline-heatmap')
        .query({ companyId: 1, from: "2024-05-01", to: "2024-05-30" });

      expect(response.status).toBe(200);
      // Check if intensities are in range 0-4
      const intensities = response.body.map((d: any) => d.intensity);
      expect(Math.max(...intensities)).toBeLessThanOrEqual(4);
    });
  });
});