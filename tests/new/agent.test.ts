import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from "../../lib/prisma";
import { getJWT } from '../../utils/authJWT';
import bcrypt from 'bcrypt';

interface TableNameRow { tablename: string; }

describe('Agent Crud Testing', () => {
  let JWT = '';

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
    await request(app).post('/api/auth/register').send({
      companyName: "Agent Corp",
      admin_email: "admin@agentcorp.com",
      admin_name: "Admin",
      password: "password123"
    });
    JWT = await getJWT(app, "admin@agentcorp.com", "password123");
  });

  describe("Agent Endpoints", () => {

    describe("POST /api/admin/addAgent", () => {
      const validAgent = {
        email: " AGENT@test.com ",
        name: "Agent Smith",
        password: "agentPassword123",
        leadDeskId: "LD-999"
      };

      it('Success: Should create an Agent, User (role AGENT), and LEADDESK link', async () => {
        const res = await request(app)
          .post('/api/admin/addAgent')
          .set('Authorization', `Bearer ${JWT}`)
          .send(validAgent);

        expect(res.status).toBe(201);
        
        const agent = await prisma.agent.findUnique({
          where: { id: res.body.agentId },
          include: { user: true, agentToThird: true }
        });

        expect(agent?.user?.role).toBe('AGENT');
        expect(agent?.user?.email).toBe('agent@test.com'); // Lowercase check
        expect(agent?.agentToThird[0].agentServiceIdentifier).toBe("LD-999");
        
        const isMatch = await bcrypt.compare(validAgent.password, agent!.user!.passwordHash);
        expect(isMatch).toBe(true);
      });

      it('Validation: Should return 400 if leadDeskId is missing or empty', async () => {
        const res = await request(app)
          .post('/api/admin/addAgent')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ ...validAgent, leadDeskId: "   " });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Missing required agent fields");
      });
    });

    describe("PUT /api/admin/editAgent/:id", () => {
      let agentId: number;

      beforeEach(async () => {
        const res = await request(app)
          .post('/api/admin/addAgent')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ email: "edit-agent@test.com", name: "Initial Agent", password: "pass", leadDeskId: "LD-1" });
        agentId = res.body.agentId;
      });

      it('Success: Should update agentServiceIdentifier using upsert logic', async () => {
        const res = await request(app)
          .put(`/api/admin/editAgent/${agentId}`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ leadDeskId: "LD-UPDATED" });

        expect(res.status).toBe(200);
        
        const agentLink = await prisma.agentToThird.findFirst({ where: { agentId } });
        expect(agentLink?.agentServiceIdentifier).toBe("LD-UPDATED");
      });

      it('Integrity: Should propagate email change to the User table', async () => {
        const newEmail = "new-agent-email@test.com";
        await request(app)
          .put(`/api/admin/editAgent/${agentId}`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ email: newEmail });

        const user = await prisma.user.findUnique({ where: { email: newEmail } });
        expect(user?.agentId).toBe(agentId);
      });
    });

    describe("GET /api/admin/getAgent/:id", () => {
      let agentId: number;

      beforeEach(async () => {
        const res = await request(app)
          .post('/api/admin/addAgent')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ email: "active@test.com", name: "Active Agent", password: "pass", leadDeskId: "LD-A" });
        agentId = res.body.agentId;
      });

      it('Status Filter: Should return 200 if ACTIVE and 404 if NOT ACTIVE', async () => {
        // Test Active
        const resActive = await request(app)
          .get(`/api/admin/getAgent/${agentId}`)
          .set('Authorization', `Bearer ${JWT}`);
        expect(resActive.status).toBe(200);

        // Manually set to PAUSED/REMOVED to test filter logic
        await prisma.user.update({
          where: { agentId: agentId },
          data: { status: "REMOVED" }
        });

        const resInactive = await request(app)
          .get(`/api/admin/getAgent/${agentId}`)
          .set('Authorization', `Bearer ${JWT}`);
        expect(resInactive.status).toBe(404);
      });
    });

    describe("GET /api/admin/getAgentsList", () => {
      it('Security: Should verify passwordHash is omitted from the response', async () => {
        await request(app)
          .post('/api/admin/addAgent')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ email: "security@test.com", name: "Sec", password: "pass", leadDeskId: "LD-S" });

        const res = await request(app)
          .get('/api/admin/getAgentsList')
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.body.data[0].user).not.toHaveProperty('passwordHash');
      });

      it('Filtering: Should strictly exclude agents with status NOT ACTIVE', async () => {
        // Add one active
        await request(app).post('/api/admin/addAgent').set('Authorization', `Bearer ${JWT}`)
          .send({ email: "active-list@test.com", name: "Act", password: "pass", leadDeskId: "LD-1" });
        
        // Add one then soft-delete it
        const res2 = await request(app).post('/api/admin/addAgent').set('Authorization', `Bearer ${JWT}`)
          .send({ email: "removed-list@test.com", name: "Rem", password: "pass", leadDeskId: "LD-2" });
        
        await request(app).delete(`/api/admin/removeAgent/${res2.body.agentId}`).set('Authorization', `Bearer ${JWT}`);

        const res = await request(app)
          .get('/api/admin/getAgentsList')
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.body.total).toBe(1);
        expect(res.body.data.every((a: any) => a.user.status === "ACTIVE")).toBe(true);
      });
    });

    describe("DELETE /api/admin/removeAgent/:id (Soft Delete)", () => {
      let agentId: number;

      beforeEach(async () => {
        const res = await request(app)
          .post('/api/admin/addAgent')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ email: "historical@test.com", name: "Hist", password: "pass", leadDeskId: "LD-H" });
        agentId = res.body.agentId;
      });

      it('Success: Should soft delete (status=REMOVED) and preserve DB records', async () => {
        const res = await request(app)
          .delete(`/api/admin/removeAgent/${agentId}`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(204);

        // Check DB directly
        const user = await prisma.user.findFirst({ where: { agentId } });
        const agent = await prisma.agent.findUnique({ where: { id: agentId } });
        
        expect(user?.status).toBe("REMOVED");
        expect(agent).not.toBeNull(); // Record is preserved
      });
    });
  });
});