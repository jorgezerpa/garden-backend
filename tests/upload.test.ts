import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from "../lib/prisma";
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { getJWT } from '../utils/authJWT';
import path from 'node:path';

interface TableNameRow { tablename: string; }

describe('Upload Files', () => {

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

  describe("Upload profile Image", () => {
    
    it('successfully upload profile image', async () => {
      // create company
      await request(app).post('/api/auth/register').send({companyName: "test",admin_email: "admin@gmail.com",admin_name: "admin",password: "123456"}).expect(201)
      const JWT = await getJWT(app, "admin@gmail.com", "123456");
      
      // create agent
      const validAgent = {
        email: "agent@test.com",
        name: "Agent Smith",
        password: "123456",
        leadDeskId: "999"
      };
      await request(app).post('/api/admin/addAgent').set('Authorization', `Bearer ${JWT}`).send(validAgent).expect(201);
      
      // agent uploads profile img
      const JWT_AGENT = await getJWT(app, "agent@test.com", "123456");
      const filePath = path.join(__dirname, 'jiggles.png');

      const response = await request(app)
        .post('/api/upload/agent-profile')
        .set('Authorization', `Bearer ${JWT_AGENT}`) 
        /** * .attach(fieldname, file, options)
         * 'profile' must match the string in upload.single('profile') 
        */
        .attach('profile', filePath, { filename: 'test-avatar.png', contentType: 'image/png' })
        .expect(200)

    });

  });
});