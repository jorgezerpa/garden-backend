import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";

interface TableNameRow { tablename: string; }

describe('AUTH system testing', () => {

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

  describe("POST /api/auth/register", () => {
    // --- HAPPY PATH ---
    it('successfully registers a new company', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ companyName: "Company 1", admin_email: "admin@gmail.com", admin_name: "admin", password: "12345" });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ companyId: 1, userId: 1 });
    });

    // --- ERROR PATHS ---
    it('returns 400 if required fields are missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ companyName: "No Email" }); // missing admin_email and password

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('returns 409 if user already exists', async () => {
      // First registration
      const payload = { companyName: "Company 1", admin_email: "duplicate@gmail.com", admin_name: "admin", password: "123" };
      await request(app).post('/api/auth/register').send(payload);

      // Second registration with same email
      const response = await request(app).post('/api/auth/register').send(payload);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'User already exists');
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      // Seed a user for login tests
      await request(app).post('/api/auth/register').send({
        companyName: "Test Corp",
        admin_email: "login@test.com",
        admin_name: "Tester",
        password: "securepassword"
      });
    });

    // --- HAPPY PATH ---
    it('successfully logs in with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: "login@test.com", password: "securepassword" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: "Login successful", role: "MAIN_ADMIN" });
    });

    // --- ERROR PATHS ---
    it('returns 400 if email or password missing', async () => {
      const response = await request(app).post('/api/auth/login').send({ email: "only@email.com" });
      expect(response.status).toBe(400);
    });

    it('returns 401 if user does not exist', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: "nonexistent@test.com", password: "any" });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('returns 401 if password is incorrect', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: "login@test.com", password: "wrongpassword" });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('returns 401 for incorrect casing/extra spaces (if not handled properly)', async () => {
      // The controller handles lowercase and trim, so this SHOULD work:
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: " LOGIN@TEST.COM ", password: "securepassword" });

      expect(response.status).toBe(200);
    });
  });
});