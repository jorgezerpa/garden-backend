import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import { getJWT } from '../utils/authJWT';
import { createAgent } from './helpers/helpers';
describe('Admin CRUD testing', () => {
    let JWT = '';
    beforeEach(async () => {
        const tablenames = await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`);
        const tables = tablenames
            .map(({ tablename }) => tablename)
            .filter((name) => name !== '_prisma_migrations')
            .map((name) => `"public"."${name}"`)
            .join(', ');
        if (tables.length > 0) {
            await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE;`);
        }
        await request(app).post('/api/auth/register').send({
            companyName: "Test Corp",
            admin_email: "admin@test.com",
            admin_name: "Tester",
            password: "12345"
        });
        JWT = await getJWT(app, "admin@test.com", "12345");
    });
    describe("Agent Endpoints", () => {
        describe("POST /api/admin/addAgent", () => {
            ``;
            it('successfully adds an agent', async () => {
                const response = await request(app)
                    .post('/api/admin/addAgent')
                    .auth(JWT, { type: "bearer" })
                    .send({ email: "agent@test.com", name: "John Doe", password: "12345", leadDeskId: "1" });
                expect(response.status).toBe(201);
                expect(response.body).toHaveProperty('agentId');
            });
            it('returns 400 if fields are missing', async () => {
                const response = await request(app).post('/api/admin/addAgent').auth(JWT, { type: "bearer" }).send({ name: "No Email" });
                expect(response.status).toBe(400);
            });
        });
        describe("PUT /api/admin/editAgent/:id", () => {
            it('successfully updates an agent', async () => {
                // Create one first
                const agentId = await createAgent(app, JWT);
                const response = await request(app)
                    .put(`/api/admin/editAgent/${agentId}`)
                    .auth(JWT, { type: "bearer" })
                    .send({ name: "New Name", email: "new@test.com", leadDeskId: "1" });
                expect(response.status).toBe(200);
            });
            it('returns 401 if agent does not belong to the admin`s company', async () => {
                await request(app).post('/api/auth/register').send({ companyName: "Test Corp 2", admin_email: "admin2@test.com", admin_name: "Tester2", password: "12345" });
                const newJWT = await getJWT(app, "admin2@test.com", "12345");
                const agentId = await createAgent(app, newJWT);
                const response = await request(app).put(`/api/admin/editAgent/${agentId}`).auth(JWT, { type: "bearer" }).send({ name: "Fail" });
                expect(response.status).toBe(401);
            });
            it('returns 404 if agent does not exists', async () => {
                const response = await request(app).put('/api/admin/editAgent/999').auth(JWT, { type: "bearer" }).send({ name: "Fail" });
                expect(response.status).toBe(404);
            });
        });
        describe("GET /api/admin/getAgent", () => {
            it('gets a agent by ID', async () => {
                const agentId = await createAgent(app, JWT);
                const response = await request(app).get(`/api/admin/getAgent/${agentId}`).auth(JWT, { type: "bearer" });
                expect(response.status).toBe(200);
                expect(response.body.user.email).toBe("m@test.com");
            });
            it('returns 404 if agent does not exist', async () => {
                const response = await request(app).get('/api/admin/getAgent?id=999').auth(JWT, { type: "bearer" });
                expect(response.status).toBe(404);
            });
        });
        describe("GET /api/admin/getAgentsList", () => {
            it('returns paginated list', async () => {
                await createAgent(app, JWT);
                const response = await request(app).get('/api/admin/getAgentsList?page=1&limit=5').auth(JWT, { type: "bearer" });
                expect(response.status).toBe(200);
                expect(Array.isArray(response.body.data)).toBe(true);
                expect(response.body.total).toBe(1);
            });
        });
        describe("DELETE /api/admin/removeAgent/:id", () => {
            it('deletes a agent', async () => {
                const agentId = await createAgent(app, JWT);
                const response = await request(app).delete(`/api/admin/removeAgent/${agentId}`).auth(JWT, { type: "bearer" });
                expect(response.status).toBe(204);
            });
        });
    });
});
