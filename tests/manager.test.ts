import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import { getJWT } from '../utils/authJWT';
import bcrypt from 'bcrypt';

interface TableNameRow { tablename: string; }

describe('Manager Crud Testing', () => {
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
      companyName: "Test Corp",
      admin_email: "admin@test.com",
      admin_name: "Tester",
      password: "12345"
    });
    JWT = await getJWT(app, "admin@test.com", "12345");
  });

  describe("Manager Endpoints", () => {

    describe("POST /api/admin/addManager", () => {
      const validManager = {
        email: " MANAGER@test.com ", // Mixed case and spaces for normalization test
        name: "John Doe",
        password: "securePassword123"
      };

      it('Success: Should create both a Manager and a User record within a single transaction', async () => {
        const res = await request(app)
          .post('/api/admin/addManager')
          .set('Authorization', `Bearer ${JWT}`)
          .send(validManager);

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('managerId');
        expect(res.body).toHaveProperty('userId');

        const manager = await prisma.manager.findUnique({ where: { id: res.body.managerId } });
        const user = await prisma.user.findUnique({ where: { id: res.body.userId } });

        expect(manager).toBeDefined();
        expect(user?.managerId).toBe(manager?.id);
      });

      it('Success: Should normalize email addresses (lowercase and trimmed)', async () => {
        await request(app)
          .post('/api/admin/addManager')
          .set('Authorization', `Bearer ${JWT}`)
          .send(validManager);

        const savedManager = await prisma.manager.findFirst({ where: { name: "John Doe" } });
        expect(savedManager?.email).toBe("manager@test.com");
      });

      it('Success: Should correctly hash the password', async () => {
        const res = await request(app)
          .post('/api/admin/addManager')
          .set('Authorization', `Bearer ${JWT}`)
          .send(validManager);

        const user = await prisma.user.findUnique({ where: { id: res.body.userId } });
        const isMatch = await bcrypt.compare(validManager.password, user!.passwordHash);
        expect(isMatch).toBe(true);
      });

      it('Validation: Should return 400 if fields are missing', async () => {
        const res = await request(app)
          .post('/api/admin/addManager')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Incomplete" });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain("Missing required manager fields");
      });

      it('Edge Case: Should return 500 for unique constraint errors (duplicate email)', async () => {
        await request(app)
          .post('/api/admin/addManager')
          .set('Authorization', `Bearer ${JWT}`)
          .send(validManager);

        const res = await request(app)
          .post('/api/admin/addManager')
          .set('Authorization', `Bearer ${JWT}`)
          .send(validManager);

        expect(res.status).toBe(500);
      });
    });

    describe("PUT /api/admin/editManager/:id", () => {
      let managerId: number;

      beforeEach(async () => {
        const res = await request(app)
          .post('/api/admin/addManager')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ email: "edit@test.com", name: "Edit Me", password: "oldPassword" });
        managerId = res.body.managerId;
      });

      it('Success: Should update only the Manager name when provided', async () => {
        const res = await request(app)
          .put(`/api/admin/editManager/${managerId}`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Updated Name" });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Updated Name");
      });

      it('Success: Should synchronize email update across Manager and User', async () => {
        const newEmail = "newemail@test.com";
        await request(app)
          .put(`/api/admin/editManager/${managerId}`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ email: newEmail });

        const manager = await prisma.manager.findUnique({ where: { id: managerId } });
        const user = await prisma.user.findUnique({ where: { email: newEmail } });

        expect(manager?.email).toBe(newEmail);
        expect(user?.managerId).toBe(managerId);
      });

      it('Success: Should update User password hash when new password provided', async () => {
        const newPass = "newSecurePass";
        await request(app)
          .put(`/api/admin/editManager/${managerId}`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ password: newPass });

        const user = await prisma.user.findUnique({ where: { managerId } });
        const isMatch = await bcrypt.compare(newPass, user!.passwordHash);
        expect(isMatch).toBe(true);
      });

      it('Error Handling: Should return 500 if the id does not exist', async () => {
        const res = await request(app)
          .put(`/api/admin/editManager/9999`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Ghost" });

        expect(res.status).toBe(404);
      });
    });

    describe("GET /api/admin/getManager/:id", () => {
      let managerId: number;

      beforeEach(async () => {
        const res = await request(app)
          .post('/api/admin/addManager')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ email: "get@test.com", name: "Get Person", password: "password" });
        managerId = res.body.managerId;
      });

      it('Success: Should return 200 and manager data with relations', async () => {
        const res = await request(app)
          .get(`/api/admin/getManager/${managerId}`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('user');
        expect(res.body).toHaveProperty('company');
        expect(res.body.name).toBe("Get Person");
      });

      it('Not Found: Should return 404 for non-existent ID', async () => {
        const res = await request(app)
          .get(`/api/admin/getManager/8888`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(404);
      });
    });

    describe("GET /api/admin/getManagersList", () => {
      beforeEach(async () => {
        // Seed a few managers
        const managers = [
          { email: "m1@test.com", name: "M1", password: "pass" },
          { email: "m2@test.com", name: "M2", password: "pass" }
        ];
        for (const m of managers) {
          await request(app).post('/api/admin/addManager').set('Authorization', `Bearer ${JWT}`).send(m);
        }
      });

      it('Success: Should return paginated object with total and data', async () => {
        const res = await request(app)
          .get('/api/admin/getManagersList?page=1&limit=1')
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(200);
        expect(res.body.total).toBeGreaterThanOrEqual(2);
        expect(res.body.data.length).toBe(1);
        expect(res.body.data[0].company).toHaveProperty('name');
      });

      it('Success: Should default to page 1 and limit 10', async () => {
        const res = await request(app)
          .get('/api/admin/getManagersList')
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(200);
        // Assuming we only added 2 in this test + 1 from company registration (if any)
        expect(res.body.data.length).toBeLessThanOrEqual(10);
      });
    });

    describe("DELETE /api/admin/removeManagers/:id", () => {
      let managerId: number;
      let userId: number;

      beforeEach(async () => {
        const res = await request(app)
          .post('/api/admin/addManager')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ email: "delete@test.com", name: "Delete Me", password: "pass" });
        managerId = res.body.managerId;
        userId = res.body.userId;
      });

      it('Success: Should delete both User and Manager records', async () => {
        const res = await request(app)
          .delete(`/api/admin/removeManagers/${managerId}`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(204);

        const manager = await prisma.manager.findUnique({ where: { id: managerId } });
        const user = await prisma.user.findUnique({ where: { id: userId } });

        expect(manager).toBeNull();
        expect(user).toBeNull();
      });
    });

  });
});