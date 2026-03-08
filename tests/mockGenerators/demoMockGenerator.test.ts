import { describe, it, expect, beforeEach, vi, Mocked } from 'vitest';
import request from 'supertest';
import app from '../../app';
import axios from 'axios';
import { getJWT } from '../../utils/authJWT';
import { prisma } from '../../lib/prisma';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('Basic Mock Generator', () => {

  it('Generate', async () => {
    // 0. Reset Database
    const tablenames = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
      `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public'`
    );
    for (const { tablename } of tablenames) {
      if (tablename !== '_prisma_migrations') {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" RESTART IDENTITY CASCADE;`);
      }
    }

    // 1. Register company and user
    await request(app).post('/api/auth/register').send({
      companyName: "Test Corp",
      admin_email: "admin@test.com",
      admin_name: "Tester",
      password: "123456"
    });

    // 2. get the JWT
    const token = await getJWT(app, "admin@test.com", "123456");

    // 2. Use the token for Key Generation and Schema
    const responseKeysGeneration = await request(app)
        .post('/api/auth/generate-key-pair')
        .auth(token, { type: "bearer" });

    // create block schemas
    await request(app)
        .post('/api/schema/create')
        .auth(token, { type: "bearer" })
        .send({
          name: "Standard Week Day",
          blocks: [
            {
              startMinutesFromMidnight: 7*60,
              endMinutesFromMidnight: 12*60,
              blockType: "WORKING",
              name: "Morning block 1"
            },
            {
              startMinutesFromMidnight: 12*60,
              endMinutesFromMidnight: 13*60,
              blockType: "REST",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 13*60,
              endMinutesFromMidnight: 17*60,
              blockType: "WORKING",
              name: "Afternoon block 1"
            },
          ] 
        }); 
    
        await request(app)
        .post('/api/schema/create')
        .auth(token, { type: "bearer" })
        .send({
          name: "Half Day Schema Morning",
          blocks: [
            {
              startMinutesFromMidnight: 7*60,
              endMinutesFromMidnight: 9*60,
              blockType: "WORKING",
              name: "Morning block 1"
            },
            {
              startMinutesFromMidnight: 9*60,
              endMinutesFromMidnight: 10*60,
              blockType: "REST",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 10*60,
              endMinutesFromMidnight: 12*60,
              blockType: "WORKING",
              name: "Afternoon block 1"
            },
          ] 
        }); 

        await request(app)
        .post('/api/schema/create')
        .auth(token, { type: "bearer" })
        .send({
          name: "Alternating Hours",
          blocks: [
            {
              startMinutesFromMidnight: 7*60,
              endMinutesFromMidnight: 8*60,
              blockType: "WORKING",
              name: "Morning block 1"
            },
            {
              startMinutesFromMidnight: 8*60,
              endMinutesFromMidnight: 9*60,
              blockType: "REST",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 9*60,
              endMinutesFromMidnight: 10*60,
              blockType: "WORKING",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 10*60,
              endMinutesFromMidnight: 11*60,
              blockType: "REST",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 11*60,
              endMinutesFromMidnight: 12*60,
              blockType: "WORKING",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 12*60,
              endMinutesFromMidnight: 13*60,
              blockType: "REST",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 13*60,
              endMinutesFromMidnight: 14*60,
              blockType: "WORKING",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 14*60,
              endMinutesFromMidnight: 15*60,
              blockType: "REST",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 15*60,
              endMinutesFromMidnight: 16*60,
              blockType: "WORKING",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 16*60,
              endMinutesFromMidnight: 17*60,
              blockType: "REST",
              name: "Lunch break"
            },
            {
              startMinutesFromMidnight: 17*60,
              endMinutesFromMidnight: 18*60,
              blockType: "WORKING",
              name: "Lunch break"
            },
          ] 
        }); 

    // Create goals 
    await request(app)
        .post('/api/admin/goals/create')
        .auth(token, { type: "bearer" })
        .send({
          name: "Daily Goals Week Day - Per User",
          sales: 10,
          talkTime: 10,
          seeds: 5,
          callbacks: 12,
          leads:4,
          numberOfCalls:20,
          numberOfLongCalls: 4,      
        });
    await request(app)
        .post('/api/admin/goals/create')
        .auth(token, { type: "bearer" })
        .send({
          name: "Daily Goals Week Day - Team",
          sales: 100,
          talkTime: 100,
          seeds: 50,
          callbacks: 200,
          leads:30,
          numberOfCalls:100,
          numberOfLongCalls: 40,      
        });
    await request(app)
        .post('/api/admin/goals/create')
        .auth(token, { type: "bearer" })
        .send({
          name: "Daily Goals Week End - Per user",
          sales: 5,
          talkTime: 20,
          seeds: 3,
          callbacks: 10,
          leads: 1,
          numberOfCalls:7,
          numberOfLongCalls: 2,
        });
    await request(app)
        .post('/api/admin/goals/create')
        .auth(token, { type: "bearer" })
        .send({
          name: "Daily Goals Week End - Team",
          sales: 503,
          talkTime: 220,
          seeds: 34,
          callbacks: 140,
          leads: 61,
          numberOfCalls:27,
          numberOfLongCalls: 52,
        });

    // 3. Create agents in smaller chunks to avoid DB deadlocks
    const agentData = Array.from({ length: 100 }, (_, i) => ({
        email: `agent${i+1}@test.com`,
        name: `John-${i+1} Due`,
        password: "123456",
        leadDeskId: String(i+1)
    }));

    // USE THIS TO GENERATE USERS IN NO ORDER -> so leaddesk id does not match with id -> is useful and real life simulating. But, for debuggin, I prefer keep them sync
    // for (let i = 0; i < agentData.length; i += 10) {
    //     const chunk = agentData.slice(i, i + 10);
    //     await Promise.all(chunk.map(agent => 
    //         request(app)
    //             .post('/api/admin/addAgent')
    //             .auth(token, { type: "bearer" })
    //             .send(agent)
    //             .expect(201)
    //     ));
    //     // console.log(`Created agents up to ${i + 10}`);
    // }

    for (const agent of agentData) {
      await request(app)
          .post('/api/admin/addAgent')
          .auth(token, { type: 'bearer' })
          .send(agent)
          .expect(201);
    }

    // 4. Simulate webhook calls
    const totalCalls = 1000;
    const chunkSize = 10;
    const startDate = new Date("2026-01-01T00:00:00Z");
    const authHeader = `Basic ${Buffer.from(`${responseKeysGeneration.body.publicKey}:${responseKeysGeneration.body.secretKey}`).toString('base64')}`;

    // console.log(`Starting webhook simulation for ${totalCalls} calls...`);
    for (let i = 0; i < totalCalls; i += chunkSize) {
        const currentChunkSize = Math.min(chunkSize, totalCalls - i);
        const chunkPromises = [];

        for (let j = 0; j < currentChunkSize; j++) {
            const callIndex = i + j;
            const callDate = new Date(startDate.getTime() + callIndex * (7 * 60 * 60 * 1000));
            const talkTime = (Math.random() * 500);

            // 1. Prepare the Mock for this specific call
            mockedAxios.get.mockResolvedValueOnce({
                data: {
                    id: `${callIndex}`,
                    agent_id: Math.floor(Math.random() * 100) + 1, 
                    agent_username: "Agent_X",
                    talk_time: talkTime.toString(),
                    talk_start: callDate.toISOString().replace('T', ' ').split('.')[0],
                    talk_end: new Date(callDate.getTime() + (talkTime * 1000)).toISOString().replace('T', ' ').split('.')[0],
                    number: `+3580000${Math.floor(Math.random() * 100) + 1}`, // pool of 100 possible callees
                    order_ids: callIndex % 10 === 0 ? [1] : []
                }
            });

            // 2. Add the request promise to our chunk array
            chunkPromises.push(
                request(app)
                    .get('/api/leaddesk/webhook')
                    .set('Authorization', authHeader)
                    .query({ last_call_id: `LD-${callIndex}` })
            );
        }

        // 3. Execute the chunk in parallel
        await Promise.all(chunkPromises);
        // console.log(`Processed webhooks ${i + currentChunkSize}/${totalCalls}`);
    }

    // randomly repeat calls to count as "callbacks" (Skipping every other index: 1, 3, 5...)
    // We keep chunkSize for parallel execution but adjust the callIndex logic
    for (let i = 0; i < totalCalls; i += chunkSize) {
        const currentChunkSize = Math.min(chunkSize, totalCalls - i);
        const chunkPromises = [];

        for (let j = 0; j < currentChunkSize; j++) {
            const callIndex = i + j;

            // Skip even indexes (0, 2, 4...) to only process 1, 3, 5, 7...
            if (callIndex % 2 === 0) continue;

            const callDate = new Date(startDate.getTime() + callIndex * (7 * 60 * 60 * 1000));
            const talkTime = (Math.random() * 500);

            // 1. Prepare the Mock for this specific odd-indexed call
            mockedAxios.get.mockResolvedValueOnce({
                data: {
                    id: `${callIndex}`,
                    agent_id: Math.floor(Math.random() * 100) + 1, 
                    agent_username: "Agent_X",
                    talk_time: talkTime.toString(),
                    talk_start: callDate.toISOString().replace('T', ' ').split('.')[0],
                    talk_end: new Date(callDate.getTime() + (talkTime * 1000)).toISOString().replace('T', ' ').split('.')[0],
                    number: `+3580000${callIndex}`,
                    order_ids: callIndex % 10 === 0 ? [1] : []
                }
            });

            // 2. Add the request promise
            chunkPromises.push(
                request(app)
                    .get('/api/leaddesk/webhook')
                    .set('Authorization', authHeader)
                    .query({ last_call_id: `LD-${callIndex}` })
            );
        }

        // 3. Execute the odd-indexed chunk in parallel
        if (chunkPromises.length > 0) {
            await Promise.all(chunkPromises);
        }
    }

}, 60000); // <--- INCREASED TIMEOUT

  
});






