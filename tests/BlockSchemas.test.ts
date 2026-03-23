import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import { getJWT } from '../utils/authJWT';

interface TableNameRow { tablename: string; }

describe('Schema & Blocks Testing', () => {
  let JWT = '';
  let companyId: number;
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

    // Setup Company & Auth
    const reg = await request(app).post('/api/auth/register').send({
      companyName: "Time Corp",
      admin_email: "admin@time.com",
      admin_name: "Tim",
      password: "password123"
    });
    
    const admin = await prisma.user.findUnique({ where: { email: "admin@time.com" } });
    adminUserId = admin!.id;
    companyId = admin!.companyId;
    JWT = await getJWT(app, "admin@time.com", "password123");
  });

  describe("Schema Management", () => {

    describe("POST /api/schema/create", () => {
      it('Success: Should create a Schema and nested blocks in a transaction', async () => {
        const schemaPayload = {
          name: "Morning Shift",
          blocks: [
            { startMinutesFromMidnight: 480, endMinutesFromMidnight: 720, blockType: "WORKING", name: "Morning Work" },
            { startMinutesFromMidnight: 720, endMinutesFromMidnight: 780, blockType: "REST", name: "Lunch" }
          ]
        };

        const res = await request(app)
          .post('/api/schema/create')
          .set('Authorization', `Bearer ${JWT}`)
          .send(schemaPayload);

        expect(res.status).toBe(201);
        expect(res.body.blocks).toHaveLength(2);
        expect(res.body.blocks[0].startMinutesFromMidnight).toBe(480);
      });

      it('Validation: Should return 400 if blocks array is empty', async () => {
        const res = await request(app)
          .post('/api/schema/create')
          .set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Empty Schema", blocks: [] });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Must send at least 1 block");
      });
    });

    describe("GET /api/schema/individual/:id", () => {
      it('Success: Should return blocks ordered by startMinutesFromMidnight ASC', async () => {
        // Create schema with blocks out of order
        const setup = await request(app).post('/api/schema/create').set('Authorization', `Bearer ${JWT}`)
          .send({
            name: "Unordered",
            blocks: [
              { startMinutesFromMidnight: 1000, endMinutesFromMidnight: 1100, blockType: "WORKING" },
              { startMinutesFromMidnight: 100, endMinutesFromMidnight: 200, blockType: "WORKING" }
            ]
          });

        const res = await request(app)
          .get(`/api/schema/individual/${setup.body.id}`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(200);
        expect(res.body.blocks[0].startMinutesFromMidnight).toBe(100);
        expect(res.body.blocks[1].startMinutesFromMidnight).toBe(1000);
      });
    });

    describe("PUT /api/schema/update/:id", () => {
      let schemaId: number;

      beforeEach(async () => {
        const res = await request(app).post('/api/schema/create').set('Authorization', `Bearer ${JWT}`)
          .send({
            name: "Initial Schema",
            blocks: [{ startMinutesFromMidnight: 0, endMinutesFromMidnight: 60, blockType: "WORKING" }]
          });
        schemaId = res.body.id;
      });

      it('Success (Metadata): Should update only the name if blocks are omitted', async () => {
        const res = await request(app)
          .put(`/api/schema/update/${schemaId}`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Renamed Schema" });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe("Renamed Schema");
        expect(res.body.blocks).toHaveLength(1); // Block remains
      });

      it('Success (Full Update): Should replace old blocks with new ones', async () => {
        const newBlocks = [
          { startMinutesFromMidnight: 300, endMinutesFromMidnight: 400, blockType: "REST" },
          { startMinutesFromMidnight: 400, endMinutesFromMidnight: 500, blockType: "WORKING" }
        ];

        const res = await request(app)
          .put(`/api/schema/update/${schemaId}`)
          .set('Authorization', `Bearer ${JWT}`)
          .send({ name: "Structural Update", blocks: newBlocks });

        expect(res.status).toBe(200);
        expect(res.body.blocks).toHaveLength(2);
        expect(res.body.blocks[0].blockType).toBe("REST");
        
        // Verify old block is gone from DB
        const count = await prisma.schemaBlock.count({ where: { schemaId } });
        expect(count).toBe(2);
      });
    });

    describe("DELETE /api/schema/:id", () => {
      it('Success: Should cascading delete assignations and blocks', async () => {
        // 1. Setup a schema
        const setup = await request(app).post('/api/schema/create').set('Authorization', `Bearer ${JWT}`)
          .send({ name: "To Delete", blocks: [{ startMinutesFromMidnight: 0, endMinutesFromMidnight: 60, blockType: "WORKING" }] });
        const id = setup.body.id;

        // 2. Add an assignation (to test cascading)
        await prisma.schemaAssignation.create({
          data: {
            companyId,
            schemaId: id,
            date: new Date()
          }
        });

        const res = await request(app)
          .delete(`/api/schema/${id}`)
          .set('Authorization', `Bearer ${JWT}`);

        expect(res.status).toBe(204);

        // 3. Verify total wipeout
        const schema = await prisma.schema.findUnique({ where: { id } });
        const blocks = await prisma.schemaBlock.findMany({ where: { schemaId: id } });
        const assignations = await prisma.schemaAssignation.findMany({ where: { schemaId: id } });

        expect(schema).toBeNull();
        expect(blocks).toHaveLength(0);
        expect(assignations).toHaveLength(0);
      });
    });
  });
});