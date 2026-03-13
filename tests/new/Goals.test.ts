import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from "../../lib/prisma";
import { getJWT } from '../../utils/authJWT';

interface TableNameRow { tablename: string; }

describe('Goals CRUD Testing', () => {
  let JWT = '';
  let adminUserId: number;

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

    // Create company and get auth token
    const regRes = await request(app).post('/api/auth/register').send({
      companyName: "Goals Corp",
      admin_email: "manager@goals.com",
      admin_name: "Manager One",
      password: "password123"
    });
    
    // We need the admin user ID for creatorId verification
    const adminUser = await prisma.user.findUnique({ where: { email: "manager@goals.com" } });
    adminUserId = adminUser!.id;
    
    JWT = await getJWT(app, "manager@goals.com", "password123");
  });

  describe("Goal Template Endpoints", () => {

    describe("POST /api/admin/goals/create", () => {
      it('Success: Should create a goal and cast string inputs to numbers', async () => {
        const goalData = {
          name: "High Performance",
          talkTimeMinutes: "120", // Passing strings to test route casting
          sales: "5",
          seeds: 10
        };

        const res = await request(app)
          .post('/api/admin/goals/create')
          .set('Authorization', `Bearer ${JWT}`)
          .send(goalData);

        expect(res.status).toBe(201);
        expect(res.body.talkTimeMinutes).toBe(120);
        expect(res.body.sales).toBe(5);
        expect(res.body.creatorId).toBe(adminUserId);
      });

      it('Success: Should default omitted numeric metrics to 0', async () => {
        const res = await request(app)
          .post('/api/admin/goals/create')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Minimal Goal" });

        expect(res.status).toBe(201);
        expect(res.body.callbacks).toBe(0);
        expect(res.body.leads).toBe(0);
      });
    });

    describe("GET /api/admin/goals/company", () => {
      it('Scoping: Should only return goals for the requesting admin\'s company', async () => {
        // Create goal for Company A (current JWT)
        await request(app).post('/api/admin/goals/create').set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Company A Goal" });

        // Register Company B
        await request(app).post('/api/auth/register').send({
          companyName: "Company B",
          admin_email: "admin@b.com",
          admin_name: "Admin B",
          password: "password123"
        });
        const JWT_B = await getJWT(app, "admin@b.com", "password123");

        // Request as Company B
        const res = await request(app)
          .get('/api/admin/goals/company')
          .set('Authorization', `Bearer ${JWT_B}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(0); // Should not see Company A's goals
      });
    });

    describe("PUT /api/admin/goals/update/:id", () => {
      let goalId: number;

      beforeEach(async () => {
        const res = await request(app).post('/api/admin/goals/create').set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Original", sales: 10, seeds: 10 });
        goalId = res.body.id;
      });

      it('Success: Should allow partial updates', async () => {
        const res = await request(app)
          .put(`/api/admin/goals/update/${goalId}`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ sales: 20 }); // Only updating sales

        expect(res.status).toBe(200);
        expect(res.body.sales).toBe(20);
        expect(res.body.seeds).toBe(10); // Remains unchanged
      });

      it('Security: Should ignore modifications to system fields', async () => {
        const originalGoal = await prisma.temporalGoals.findUnique({ where: { id: goalId } });
        
        await request(app)
          .put(`/api/admin/goals/update/${goalId}`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ companyId: 999, id: 888 }); // Attempting to change relations/identity

        const updatedGoal = await prisma.temporalGoals.findUnique({ where: { id: goalId } });
        expect(updatedGoal?.companyId).toBe(originalGoal?.companyId);
      });
    });

    describe("DELETE /api/admin/goals/delete/:id", () => {
      let goalId: number;

      beforeEach(async () => {
        const res = await request(app).post('/api/admin/goals/create').set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Deletable Goal" });
        goalId = res.body.id;

        // Create a dummy assignation to test cascading delete
        await prisma.goalsAssignation.create({
          data: {
            companyId: (await prisma.company.findFirst())!.id,
            goalId: goalId,
            date: new Date()
          }
        });
      });

      it('Success: Should delete both goal and its linked assignations', async () => {
        const res = await request(app)
          .delete(`/api/admin/goals/delete/${goalId}`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(204);

        const goal = await prisma.temporalGoals.findUnique({ where: { id: goalId } });
        const assignation = await prisma.goalsAssignation.findFirst({ where: { goalId } });

        expect(goal).toBeNull();
        expect(assignation).toBeNull();
      });
    });
  });
});