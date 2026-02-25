import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app';

describe('API Endpoints Test', () => {

    describe("subgroup", ()=>{
        it('', async () => {
          const response = await request(app).get('/health');
          
          expect(response.status).toBe(200);
          expect(response.body).toEqual({ status: 'ok' });
        });
      
        it('should return 404 for non-existent routes', async () => {
          const response = await request(app).get('/invalid-route');
          
          expect(response.status).toBe(404);
        });
    })

});