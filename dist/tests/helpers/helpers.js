import request from 'supertest';
export async function createManager(app, JWT) {
    const creationResponse = await request(app).post('/api/admin/addManager').auth(JWT, { type: "bearer" }).send({
        email: "m@test.com", name: "Old Name", password: "123"
    });
    const { managerId } = creationResponse.body;
    return managerId;
}
export async function createAgent(app, JWT) {
    const creationResponse = await request(app).post('/api/admin/addAgent').auth(JWT, { type: "bearer" }).send({
        email: "m@test.com", name: "Old Name", password: "123", leadDeskId: "1"
    });
    const { agentId } = creationResponse.body;
    return agentId;
}
export async function createManagerWithParams(app, JWT, name, email, password) {
    const creationResponse = await request(app).post('/api/admin/addManager').auth(JWT, { type: "bearer" }).send({
        email, name, password
    });
    const { managerId } = creationResponse.body;
    return managerId;
}
