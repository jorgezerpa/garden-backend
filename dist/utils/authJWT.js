import request from 'supertest';
// Perform a request to the login endpoint and return the obtained JWT
export async function getJWT(app, email, password) {
    const response = await request(app).post('/api/auth/login').send({
        email,
        password
    });
    return response.body.token;
}
