import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import { getJWT } from '../utils/authJWT';

interface TableNameRow { tablename: string; }

describe('Goals Assignation Testing', () => {
  let JWT = '';
  let goalId: number;
  let companyId: number;

  beforeEach(async () => {
    // Database Cleanup
    const tablenames = await prisma.$queryRawUnsafe<TableNameRow[]>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`
    );
    const tables = tablenames
      .map(({ tablename }) => tablename)
      .filter((name) => name !== '_prisma_migrations')
      .map((name) => `"public"."${name}"`)
      .join(', ');

    if (tables.length > 0) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
    }

    // Setup: Create company and a goal template to assign
    await request(app).post('/api/auth/register').send({
      companyName: "Calendar Corp",
      admin_email: "admin@cal.com",
      admin_name: "Calendar Admin",
      password: "password123"
    });
    JWT = await getJWT(app, "admin@cal.com", "password123");

    const company = await prisma.company.findFirst();
    companyId = company!.id;

    const goalRes = await request(app)
      .post('/api/admin/goals/create')
      .set('Authorization', `Bearer ${JWT}`)
      .send({ name: "Daily Target", sales: 5 });
    goalId = goalRes.body.id;
  });

  describe("Calendar Endpoints", () => {

    describe("POST /api/admin/upsert-assignation", () => {
      it('Success: Should assign a goal to a date and normalize to midnight UTC', async () => {
        const res = await request(app)
          .post('/api/admin/upsert-assignation')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ date: "2026-05-20", goalId });

        expect(res.status).toBe(200);
        expect(res.body.goalId).toBe(goalId);
        
        // Verify database normalization
        const stored = await prisma.goalsAssignation.findUnique({
          where: { id: res.body.id }
        });
        expect(stored?.date.toISOString()).toBe("2026-05-20T00:00:00.000Z");
      });

      it('Success (Update): Should overwrite existing goal for the same date (Upsert)', async () => {
        // First assignment
        await request(app).post('/api/admin/upsert-assignation').set('Authorization', `Bearer ${JWT}`)
          .send({ date: "2026-05-20", goalId });

        // Create second goal
        const goal2 = await request(app).post('/api/admin/goals/create').set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Revised Target", sales: 10 });

        // Upsert to same date
        const res = await request(app)
          .post('/api/admin/upsert-assignation')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ date: "2026-05-20", goalId: goal2.body.id });

        expect(res.status).toBe(200);
        
        const count = await prisma.goalsAssignation.count({ where: { companyId, date: new Date("2026-05-20T00:00:00.000Z") } });
        expect(count).toBe(1); // No duplicates
        expect(res.body.goalId).toBe(goal2.body.id);
      });
    });

    describe("GET /api/admin/assignation", () => {
      beforeEach(async () => {
        // Seed some dates
        const dates = ["2026-01-01", "2026-01-15", "2026-01-31"];
        for (const d of dates) {
          await request(app).post('/api/admin/upsert-assignation').set('Authorization', `Bearer ${JWT}`)
            .send({ date: d, goalId });
        }
      });

      it('Success: Should return assignations within range inclusive', async () => {
        const res = await request(app)
          .get('/api/admin/assignation?from=2026-01-01&to=2026-01-15')
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(2);
        expect(res.body[0]).toHaveProperty('goal'); // Verify "include: goal" logic
      });

      it('Validation: Should return 400 if dates are missing', async () => {
        const res = await request(app)
          .get('/api/admin/assignation?from=2026-01-01')
          .set('Authorization', `Bearer ${JWT}`);
        expect(res.status).toBe(400);
      });
    });

    describe("DELETE /api/admin/delete-assignation-by-id/:id", () => {
      it('Success: Should remove entry by PK ID', async () => {
        const setup = await request(app).post('/api/admin/upsert-assignation').set('Authorization', `Bearer ${JWT}`)
          .send({ date: "2026-12-25", goalId });
        
        const res = await request(app)
          .delete(`/api/admin/delete-assignation-by-id/${setup.body.id}`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(200);
        const find = await prisma.goalsAssignation.findUnique({ where: { id: setup.body.id } });
        expect(find).toBeNull();
      });
    });

    describe("DELETE /api/admin/delete-assignation-by-date", () => {
      it('Success: Should remove entry using composite key (date string)', async () => {
        const dateStr = "2026-07-04";
        await request(app).post('/api/admin/upsert-assignation').set('Authorization', `Bearer ${JWT}`)
          .send({ date: dateStr, goalId });

        const res = await request(app)
          .delete(`/api/admin/delete-assignation-by-date?date=${dateStr}`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(200);
        const find = await prisma.goalsAssignation.findFirst({
          where: { companyId, date: new Date(`${dateStr}T00:00:00.000Z`) }
        });
        expect(find).toBeNull();
      });
    });

  });
});