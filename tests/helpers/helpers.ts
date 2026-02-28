import request from 'supertest';
import { Application } from "express";

export async function createManager(app: Application, JWT: string):Promise<number>  {
    const creationResponse = await request(app).post('/api/admin/addManager').auth(JWT, { type: "bearer" }).send({ 
      email: "m@test.com", name: "Old Name", password: "123"
    });
    const { managerId } = creationResponse.body

    return managerId
}

export async function createManagerWithParams(app: Application, JWT: string, name: string, email: string, password: string):Promise<number>  {
    const creationResponse = await request(app).post('/api/admin/addManager').auth(JWT, { type: "bearer" }).send({ 
      email, name, password
    });
    const { managerId } = creationResponse.body

    return managerId
}