import request from 'supertest';
import type { Application } from 'express';

// Perform a request to the login endpoint and return the obtained JWT
export async function getJWT(app: Application, email:string, password:string) {
    const response = await request(app).post('/api/auth/login').send({
      email,
      password
    })

    return response.body.token 
}