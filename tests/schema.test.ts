import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import { getJWT } from '../utils/authJWT';

interface TableNameRow { tablename: string; }

describe('Block schemas testing', () => {

  let JWT = '';

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

    // This company id is 1 and admin/manager is 1 too
    await request(app).post('/api/auth/register').send({
      companyName: "Test Corp",
      admin_email: "admin@test.com",
      admin_name: "Tester",
      password: "12345"
    });

    JWT = await getJWT(app, "admin@test.com", "12345")
  });

  describe("Schema endpoints", () => {
    
    const validSchemaPayload = {
      name: "Standard Shift",
      type: "DAILY",
      companyId: 1,
      creatorId: 1,
      days: [
        {
          dayIndex: 0,
          blocks: [
            { startMinutesFromMidnight: 480, endMinutesFromMidnight: 720, blockType: "WORKING", name: "Morning" },
            { startMinutesFromMidnight: 720, endMinutesFromMidnight: 780, blockType: "REST", name: "Lunch" }
          ]
        }
      ]
    };

    describe("POST /api/schema/create", () => {
      it('successfully creates a schema with nested days and blocks', async () => {
        const response = await request(app)
          .post('/api/schema/create')
          .auth(JWT, { type: "bearer" })
          .send(validSchemaPayload);

        expect(response.status).toBe(201);
        expect(response.body.name).toBe("Standard Shift");
        expect(response.body.schemaDays).toHaveLength(1);
        expect(response.body.schemaDays[0].blocks).toHaveLength(2);
      });

      it('returns 400 if required fields are missing', async () => {
        const response = await request(app)
          .post('/api/schema/create')
          .auth(JWT, { type: "bearer" })
          .send({ name: "Incomplete Schema" });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain("Missing required schema structure");
      });

      it('returns 500 if SchemaType is invalid', async () => {
        const response = await request(app)
          .post('/api/schema/create')
          .auth(JWT, { type: "bearer" })
          .send({ ...validSchemaPayload, type: "INVALID_TYPE" });

        expect(response.status).toBe(500);
      });
    });

    describe("GET /api/schema/:id", () => {
      it('successfully fetches a schema by ID with nested blocks', async () => {
        // Create first
        const createRes = await request(app).post('/api/schema/create').auth(JWT, { type: "bearer" }).send(validSchemaPayload);
        const schemaId = createRes.body.id;

        const response = await request(app).get(`/api/schema/${schemaId}`).auth(JWT, { type: "bearer" });
        
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(schemaId);
        expect(response.body).toHaveProperty('schemaDays');
      });

      it('returns 404 for non-existent schema', async () => {
        const response = await request(app).get('/api/schema/999').auth(JWT, { type: "bearer" });
        expect(response.status).toBe(404);
      });
    });

    describe("GET /api/schema/list/:companyId", () => {
      it('returns a paginated list of schemas for a company', async () => {
        await request(app).post('/api/schema/create').auth(JWT, { type: "bearer" }).send(validSchemaPayload);
        
        const response = await request(app).get('/api/schema/list/1?page=1&limit=10').auth(JWT, { type: "bearer" });
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('total');
        expect(response.body.data).toBeInstanceOf(Array);
      });
    });

    describe("PUT /api/schema/update/:id", () => {
      it('successfully updates only metadata (name)', async () => {
        const createRes = await request(app).post('/api/schema/create').auth(JWT, { type: "bearer" }).send(validSchemaPayload);
        const schemaId = createRes.body.id;

        const response = await request(app)
          .put(`/api/schema/update/${schemaId}`)
          .auth(JWT, { type: "bearer" })
          .send({ name: "Updated Name" });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe("Updated Name");
      });

      it('successfully performs a full structural update (deletes old days)', async () => {
        const createRes = await request(app).post('/api/schema/create').auth(JWT, { type: "bearer" }).send(validSchemaPayload);
        const schemaId = createRes.body.id;

        const updatedPayload = {
          name: "New Structure",
          days: [{ dayIndex: 1, blocks: [{ startMinutesFromMidnight: 0, endMinutesFromMidnight: 60, blockType: "EXTRA_TIME" }] }]
        };

        const response = await request(app)
          .put(`/api/schema/update/${schemaId}`)
          .auth(JWT, { type: "bearer" })
          .send(updatedPayload);

        expect(response.status).toBe(200);
        expect(response.body.schemaDays).toHaveLength(1);
        expect(response.body.schemaDays[0].dayIndex).toBe(1); // Old dayIndex 0 should be gone
      });
    });

    describe("DELETE /api/schema/:id", () => {
      it('successfully deletes a schema and its child records', async () => {
        const createRes = await request(app).post('/api/schema/create').auth(JWT, { type: "bearer" }).send(validSchemaPayload);
        const schemaId = createRes.body.id;

        const response = await request(app).delete(`/api/schema/${schemaId}`).auth(JWT, { type: "bearer" });
        expect(response.status).toBe(204);

        // Verify it's gone
        const verify = await request(app).get(`/api/schema/${schemaId}`).auth(JWT, { type: "bearer" });
        expect(verify.status).toBe(404);
      });

      it('returns 500 when deleting non-existent schema', async () => {
        const response = await request(app).delete('/api/schema/999').auth(JWT, { type: "bearer" });
        expect(response.status).toBe(500);
      });
    });
  
  });
  
});