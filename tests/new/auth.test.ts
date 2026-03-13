import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app';
import { prisma } from "../../lib/prisma";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

interface TableNameRow { tablename: string; }

describe('Auth & API Key Management Testing', () => {
  const adminEmail = "ceo@garden.com";
  const password = "securePassword123";

  beforeEach(async () => {
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
  });

  describe("Group 1: Authentication Flow", () => {
    
    it('POST /register: Success - Should create Company, Manager, and User atomically', async () => {
      const res = await request(app).post('/api/auth/register').send({
        companyName: "Sales Garden LLC",
        admin_email: adminEmail,
        admin_name: "The Boss",
        password: password
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('companyId');
      
      const user = await prisma.user.findUnique({ where: { email: adminEmail } });
      expect(user?.role).toBe("MAIN_ADMIN");
      // Verify bcrypt hashing
      const isMatch = await bcrypt.compare(password, user!.passwordHash);
      expect(isMatch).toBe(true);
    });

    it('POST /register: Conflict - Should return 409 if email already exists', async () => {
      await request(app).post('/api/auth/register').send({
        companyName: "First Corp", admin_email: adminEmail, admin_name: "A", password: "1"
      });

      const res = await request(app).post('/api/auth/register').send({
        companyName: "Second Corp", admin_email: adminEmail, admin_name: "B", password: "2"
      });

      expect(res.status).toBe(409);
    });

    it('POST /login: Success - Should return valid JWT with claims', async () => {
      await request(app).post('/api/auth/register').send({
        companyName: "Login Corp", admin_email: adminEmail, admin_name: "Admin", password: password
      });

      const res = await request(app).post('/api/auth/login').send({
        email: adminEmail.toUpperCase(), // Test normalization (trim/lowercase)
        password: password
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');

      const decoded: any = jwt.verify(res.body.token, process.env.JWT_SECRET as string);
      expect(decoded.role).toBe("MAIN_ADMIN");
      expect(decoded).toHaveProperty('companyId');
    });
  });

  describe("Group 2: API Key Management (MAIN_ADMIN Only)", () => {
    let JWT = '';

    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        companyName: "API Corp", admin_email: adminEmail, admin_name: "Dev", password: password
      });
      const login = await request(app).post('/api/auth/login').send({ email: adminEmail, password });
      JWT = login.body.token;
    });

    it('POST /generate-key-pair: Success - Should return raw secret only once', async () => {
      const res = await request(app)
        .post('/api/auth/generate-key-pair')
        .set('Authorization', `Bearer ${JWT}`);

      expect(res.status).toBe(201);
      expect(res.body.publicKey).toMatch(/^pk_/);
      expect(res.body.secretKey).toHaveLength(64); // Hex string of 32 bytes

      // Verify it's hashed in DB
      const keyRecord = await prisma.aPIKeysAuth.findFirst();
      expect(keyRecord?.secretKeyHash).not.toBe(res.body.secretKey); 
    });

    it('Conflict: Should not allow generating keys if they already exist', async () => {
      await request(app).post('/api/auth/generate-key-pair').set('Authorization', `Bearer ${JWT}`);
      
      const res = await request(app)
        .post('/api/auth/generate-key-pair')
        .set('Authorization', `Bearer ${JWT}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain("Delete it first");
    });

    it('DELETE /delete-key-pair: Success - Should remove keys from database', async () => {
      await request(app).post('/api/auth/generate-key-pair').set('Authorization', `Bearer ${JWT}`);
      
      const del = await request(app)
        .delete('/api/auth/delete-key-pair')
        .set('Authorization', `Bearer ${JWT}`);

      expect(del.status).toBe(203);
      
      const get = await request(app)
        .get('/api/auth/get-public-key')
        .set('Authorization', `Bearer ${JWT}`);
      
      expect(get.status).toBe(400); // Controller returns 400 if no public key found
    });
  });

  describe("Group 3: Middleware & Security", () => {
    it('Role Enforcement: Should reject AGENT from managing API keys', async () => {
      // 1. Create a MAIN_ADMIN to register the company
      await request(app).post('/api/auth/register').send({
        companyName: "Security Corp", admin_email: "admin@sec.com", admin_name: "Admin", password: "p"
      });
      
      // 2. Create an AGENT user manually in DB
      const admin = await prisma.user.findUnique({ where: { email: "admin@sec.com" } });
      const agentUser = await prisma.user.create({
        data: {
          email: "agent@sec.com",
          passwordHash: "hashed",
          role: "AGENT",
          companyId: admin!.companyId
        }
      });

      const agentToken = jwt.sign({ sub: agentUser.id, companyId: admin!.companyId, role: "AGENT" }, process.env.JWT_SECRET as string);

      const res = await request(app)
        .post('/api/auth/generate-key-pair')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.status).toBe(403); // Forbidden by allowedRoles middleware
    });
  });
});