import { buildApp } from '../app';
import type { FastifyInstance } from 'fastify';

describe('Auth', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /auth/google should redirect to Google', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/auth/google',
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toMatch(/google\.com/);
  });

  it('POST /auth/login with valid credentials should redirect to /', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'password',
      },
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/');
  });

  it('POST /auth/login with invalid credentials should redirect to /login', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: 'test@example.com',
        password: 'wrongpassword',
      },
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/login');
  });
});
