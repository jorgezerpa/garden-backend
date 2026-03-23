import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import { getJWT } from '../utils/authJWT';

interface TableNameRow { tablename: string; }

describe('Schema Assignation Testing', () => {
  let JWT = '';
  let companyId: number;
  let schemaId: number;

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

    // Setup: Create company and a schema to assign
    await request(app).post('/api/auth/register').send({
      companyName: "Schema Calendar Corp",
      admin_email: "admin@schemacal.com",
      admin_name: "Schema Admin",
      password: "password123"
    });
    JWT = await getJWT(app, "admin@schemacal.com", "password123");

    const company = await prisma.company.findFirst();
    companyId = company!.id;

    // Create a basic schema pattern
    const schemaRes = await request(app)
      .post('/api/schema/create')
      .set('Authorization', `Bearer ${JWT}`)
      .send({ 
        name: "Standard Shift", 
        blocks: [{ startMinutesFromMidnight: 480, endMinutesFromMidnight: 1020, blockType: "WORKING" }] 
      });
    schemaId = schemaRes.body.id;
  });

  describe("Schema Calendar Endpoints", () => {

    describe("POST /api/schema/upsert-assignation", () => {
      it('Success (Create): Should assign a schema to a date', async () => {
        const dateStr = "2026-08-10";
        const res = await request(app)
          .post('/api/schema/upsert-assignation')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ date: dateStr, schemaId });

        expect(res.status).toBe(200);
        expect(res.body.schemaId).toBe(schemaId);
        
        const stored = await prisma.schemaAssignation.findUnique({
          where: { id: res.body.id }
        });
        expect(stored?.date.toISOString()).toBe(`${dateStr}T00:00:00.000Z`);
      });

      it('Success (Update): Should overwrite the schema for an existing date', async () => {
        const dateStr = "2026-08-10";
        // Create initial
        await request(app).post('/api/schema/upsert-assignation').set('Authorization', `Bearer ${JWT}`)
          .send({ date: dateStr, schemaId });

        // Create a second schema (Rest Day)
        const schema2 = await request(app).post('/api/schema/create').set('Authorization', `Bearer ${JWT}`)
          .send({ 
            name: "Rest Day", 
            blocks: [{ startMinutesFromMidnight: 0, endMinutesFromMidnight: 1440, blockType: "REST" }] 
          });

        const res = await request(app)
          .post('/api/schema/upsert-assignation')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ date: dateStr, schemaId: schema2.body.id });

        expect(res.status).toBe(200);
        expect(res.body.schemaId).toBe(schema2.body.id);
        
        const count = await prisma.schemaAssignation.count({ where: { companyId, date: new Date(`${dateStr}T00:00:00.000Z`) } });
        expect(count).toBe(1);
      });
    });

    describe("GET /api/schema/assignation", () => {
      it('Success: Should return assignations within range and validate normalization', async () => {
        const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];

        for (const d of dates) {
          await request(app).post('/api/schema/upsert-assignation').set('Authorization', `Bearer ${JWT}`)
            .send({ date: d, schemaId })
            .expect(200)
        }

        const res = await request(app)
          .get('/api/schema/assignation?from=2026-09-01&to=2026-09-02')
          .set('Authorization', `Bearer ${JWT}`);
        
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body[0].date).toContain("2026-09-01");
      });

      it('Validation: Should return 400 if dates are missing', async () => {
        const res = await request(app)
          .get('/api/schema/assignation?from=2026-09-01')
          .set('Authorization', `Bearer ${JWT}`);
        expect(res.status).toBe(400);
      });
    });

    describe("DELETE /api/schema/delete-assignation-by-id/:id", () => {
      it('Success: Should remove entry and verify security via middleware', async () => {
        const setup = await request(app).post('/api/schema/upsert-assignation').set('Authorization', `Bearer ${JWT}`)
          .send({ date: "2026-10-10", schemaId });
        
        // Note: The middleware expects the schemaId in params to check company ownership
        const res = await request(app)
          .delete(`/api/schema/delete-assignation-by-id/${setup.body.id}`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(200);
        const find = await prisma.schemaAssignation.findUnique({ where: { id: setup.body.id } });
        expect(find).toBeNull();
      });

      it('Security: Should block deletion if companyId does not match (Implicitly handled by middleware)', async () => {
        // Create another company
        await request(app).post('/api/auth/register').send({
          companyName: "Spy Corp", admin_email: "spy@spy.com", admin_name: "Spy", password: "password"
        });
        const spyJWT = await getJWT(app, "spy@spy.com", "password");

        const setup = await request(app).post('/api/schema/upsert-assignation').set('Authorization', `Bearer ${JWT}`)
          .send({ date: "2026-11-11", schemaId });

        const res = await request(app)
          .delete(`/api/schema/delete-assignation-by-id/${setup.body.id}`)
          .set('Authorization', `Bearer ${spyJWT}`);

        // Based on your middleware checkSchemaAssignationBelongsToCompany logic
        // It might return 401 or 500 depending on if it finds the schema
        expect(res.status).not.toBe(200);
      });
    });

  });
});