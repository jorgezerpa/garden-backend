import { describe, vi, Mocked, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = axios as Mocked<typeof axios>;

describe('Datavis', () => {

  beforeAll(async () => {
    const PUBLIC_KEY = 'pk_f7015549-c48e-4748-a821-ad2c8c4a5a32'
    const SECRET_KEY = '367acbb4261dee10f99276eddb99bbab89f3faf6be8ed9b87a203b7227a54bfa'
    
    const startDate = new Date("2026-01-01T00:00:00Z");
    const authHeader = `Basic ${Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64')}`;

    setInterval(()=>{
      const mockCall = {
        id: `1`,
        agent_id: 2, 
        agent_username: "not used",
        talk_time: 1,
        talk_start: startDate.toISOString().replace('T', ' ').split('.')[0],
        talk_end: new Date(startDate.getTime() + 1 * 1000).toISOString().replace('T', ' ').split('.')[0],
        number: `+35800002334198475`,
        order_ids: [],
        call_ending_reason: String(1), // 1,2,3 seed -- 4,5,6 sale 
      }

      mockedAxios.get.mockResolvedValueOnce({
        data: mockCall
      });

      request(app)
        .get('/api/leaddesk/webhook')
        .set('Authorization', authHeader)
        .query({ last_call_id: `1` })
        .expect(200)

    }, 10000)


  }, 60000);


  


 

  
});






