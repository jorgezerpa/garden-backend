import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import { getJWT } from '../utils/authJWT';
import { createManager } from './helpers/helpers';

interface TableNameRow { tablename: string; }

describe('Main administration system testing', () => {

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

    await request(app).post('/api/auth/register').send({
      companyName: "Test Corp",
      admin_email: "admin@test.com",
      admin_name: "Tester",
      password: "12345"
    });

    JWT = await getJWT(app, "admin@test.com", "12345")
  });

  describe("Manager Endpoints", () => {
    
    describe("POST /api/admin/addManager", () => {``
      it('successfully adds a manager', async () => {
        const response = await request(app)
          .post('/api/admin/addManager')
          .auth(JWT, { type: "bearer" })
          .send({ email: "manager@test.com", name: "John Doe", password: "12345" });

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('managerId');
      });

      it('returns 400 if fields are missing', async () => {
        const response = await request(app).post('/api/admin/addManager').auth(JWT, { type: "bearer" }).send({ name: "No Email" });
        expect(response.status).toBe(400);
      });
    });

    describe("PUT /api/admin/editManager/:id", () => {
      it('successfully updates a manager', async () => {
        // Create one first
        const managerId = await createManager(app, JWT)

        const response = await request(app)
          .put(`/api/admin/editManager/${managerId}`)
          .auth(JWT, { type: "bearer" })
          .send({ name: "New Name", email: "new@test.com" });

        expect(response.status).toBe(200);
      });

      it('returns 401 if manager does not belong to the admin`s company', async () => {
        await request(app).post('/api/auth/register').send({companyName: "Test Corp 2",admin_email: "admin2@test.com",admin_name: "Tester2",password: "12345"});
        const newJWT = await getJWT(app, "admin2@test.com", "12345")
        
        const managerId = await createManager(app, newJWT)

        const response = await request(app).put(`/api/admin/editManager/${managerId}`).auth(JWT, { type: "bearer" }).send({ name: "Fail" });
        expect(response.status).toBe(401);
      });

      it('returns 404 if manager does not exists', async () => {
        const response = await request(app).put('/api/admin/editManager/999').auth(JWT, { type: "bearer" }).send({ name: "Fail" });
        expect(response.status).toBe(404);
      });
    });

    describe("GET /api/admin/getManager", () => {
      it('gets a manager by ID', async () => {
        const managerId = await createManager(app, JWT)

        const response = await request(app).get(`/api/admin/getManager/${managerId}`).auth(JWT, { type: "bearer" });
        expect(response.status).toBe(200);
        expect(response.body.email).toBe("m@test.com");
      });

      it('returns 404 if manager does not exist', async () => {
        const response = await request(app).get('/api/admin/getManager?id=999').auth(JWT, { type: "bearer" });
        expect(response.status).toBe(404);
      });
    });

    describe("GET /api/admin/getManagersList", () => {
      it('returns paginated list', async () => {
        const response = await request(app).get('/api/admin/getManagersList?page=1&limit=5').auth(JWT, { type: "bearer" });
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.total).toBe(1);
      });
    });

    describe("DELETE /api/admin/removeManagers/:id", () => {
      it('deletes a manager', async () => {
        const managerId = await createManager(app, JWT)

        const response = await request(app).delete(`/api/admin/removeManagers/${managerId}`).auth(JWT, { type: "bearer" });
        expect(response.status).toBe(204);
      });
    });
  });

  describe("Goals Endpoints", () => {

    describe("POST /api/admin/goals/create", () => {
      it('successfully creates a goal', async () => {
        const response = await request(app)
          .post('/api/admin/goals/create')
          .auth(JWT, { type: "bearer" })
          .send({
            name: "Goal 1",
            sales: 10
          });

        expect(response.status).toBe(201);
        expect(response.body.sales).toBe(10);
      });
    });

    describe("GET /api/admin/goals/company/", () => {
      it('fetches goals for a specific company', async () => {
        const response = await request(app).get('/api/admin/goals/company').auth(JWT, { type: "bearer" });
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
      });
    });

    describe("PUT /api/admin/goals/update/:id", () => {
      it('updates goal metrics', async () => {
        // Create a goal
        const goal = await request(app)
          .post('/api/admin/goals/create')
          .auth(JWT, { type: "bearer" })
          .send({
            name: "Goal 1",
            sales: 10
        });

        const response = await request(app)
          .put(`/api/admin/goals/update/${goal.body.id}`)
          .auth(JWT, { type: "bearer" })
          .send({ sales: 50 });

        expect(response.status).toBe(200);
        expect(response.body.sales).toBe(50);
      });
    });

    describe("DELETE /api/admin/goals/delete/:id", () => {
      it('removes a goal', async () => {
        const goal = await request(app)
          .post('/api/admin/goals/create')
          .auth(JWT, { type: "bearer" })
          .send({
            name: "Goal 1",
            sales: 10
        });

        const response = await request(app).delete(`/api/admin/goals/delete/${goal.body.id}`).auth(JWT, { type: "bearer" });
        expect(response.status).toBe(204);
      });

      it('returns 500 if goal id does not exist', async () => {
        const response = await request(app).delete('/api/admin/goals/delete/999').auth(JWT, { type: "bearer" });
        expect(response.status).toBe(404);
      });
    });
  });



  describe("Goal Assignation Endpoints", () => {
    let createdGoalId: number;

    beforeEach(async () => {
      // Create a goal to use for assignation tests
      const goalResponse = await request(app)
        .post('/api/admin/goals/create')
        .auth(JWT, { type: "bearer" })
        .send({
          name: "Assignation Test Goal",
          sales: 5
        });
      createdGoalId = goalResponse.body.id;
    });

    describe("POST /api/admin/upsert-assignation", () => {
      it('successfully creates a new assignation', async () => {
        const response = await request(app)
          .post('/api/admin/upsert-assignation')
          .auth(JWT, { type: "bearer" })
          .send({
            date: "2026-05-20",
            goalId: createdGoalId
          });

        expect(response.status).toBe(200);
        expect(response.body.goalId).toBe(createdGoalId);
        // Ensure date was normalized to midnight
        expect(new Date(response.body.date).getUTCHours()).toBe(0);
      });

      it('updates an existing assignation for the same date (upsert logic)', async () => {
        // First creation
        await request(app).post('/api/admin/upsert-assignation').auth(JWT, { type: "bearer" }).send({
          date: "2026-05-20", goalId: createdGoalId
        });

        // Update to same date with (hypothetically) different goal or same goal
        const response = await request(app)
          .post('/api/admin/upsert-assignation')
          .auth(JWT, { type: "bearer" })
          .send({
            date: "2026-05-20",
            goalId: createdGoalId
          });

        expect(response.status).toBe(200);
      });

      it('returns 400 if parameters are missing', async () => {
        const response = await request(app)
          .post('/api/admin/upsert-assignation')
          .auth(JWT, { type: "bearer" })
          .send({ date: "2026-05-20" }); // missing date and goalId
        expect(response.status).toBe(400);
      });
    });

    describe("GET /api/admin/assignation", () => {
      it('fetches assignations within a date range', async () => {
        // Create an assignation
        await request(app).post('/api/admin/upsert-assignation').auth(JWT, { type: "bearer" }).send({
          date: "2026-01-15", goalId: createdGoalId
        });

        const response = await request(app)
          .get('/api/admin/assignation?from=2026-01-01&to=2026-01-31').auth(JWT, { type: "bearer" });

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toHaveProperty('goal'); // Checks the 'include' logic in controller
      });

      it('returns 400 if range params are missing', async () => {
        const response = await request(app).get('/api/admin/assignation').auth(JWT, { type: "bearer" });
        expect(response.status).toBe(400);
      });
    });

    describe("DELETE /api/admin/delete-assignation/:id", () => {
      it('deletes by ID', async () => {
        const assignation = await request(app)
          .post('/api/admin/upsert-assignation')
          .auth(JWT, { type: "bearer" })
          .send({ date: "2026-12-01", goalId: createdGoalId });

        const response = await request(app) 
          .delete(`/api/admin/delete-assignation-by-id/${assignation.body.id}`).auth(JWT, { type: "bearer" });
        
        expect(response.status).toBe(200);
      });

      it('deletes by companyId and date via query', async () => {
        await request(app)
          .post('/api/admin/upsert-assignation')
          .auth(JWT, { type: "bearer" })
          .send({ date: "2026-12-05", goalId: createdGoalId });

        const response = await request(app)
          .delete('/api/admin/delete-assignation-by-date') // ID 0 is ignored if query params exist based on your router logic
          .auth(JWT, { type: "bearer" })
          .query({ date: "2026-12-05" });

        expect(response.status).toBe(200);
      });

      it('returns 401 if trying to delete non-existent assignation (by id)', async () => {
        const response = await request(app).delete('/api/admin/delete-assignation-by-id/9999').auth(JWT, { type: "bearer" });
        expect(response.status).toBe(401);
      });

      it('returns 401 if trying to delete non-existent assignation (by date)', async () => {
        const response = await request(app).delete('/api/admin/delete-assignation-by-date').auth(JWT, { type: "bearer" }).query({ date: "2026-12-01" });
        expect(response.status).toBe(401);
      });

    });
  });

});