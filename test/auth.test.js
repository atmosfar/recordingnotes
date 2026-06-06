import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';

describe('Authentication System', () => {
  let server;
  let baseUrl;

  before(() => {
    // Set test credentials
    process.env.RECNOTES_AUTH_USERNAME = 'testuser';
    process.env.RECNOTES_AUTH_PASSWORD = 'testpassword';
    process.env.RECNOTES_SESSION_SECRET = 'test_secret_key_long_enough_32_chars';

    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test('should redirect unauthorized user from root to /login', async () => {
    const response = await fetch(`${baseUrl}/`, { redirect: 'manual' });
    assert.strictEqual(response.status, 302);
    assert.ok(response.headers.get('location').includes('/login'));
  });

  test('should return 401 for unauthorized API call', async () => {
    const response = await fetch(`${baseUrl}/api/status`);
    assert.strictEqual(response.status, 401);
  });

  test('should fail login with incorrect credentials', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'wrong', password: 'wrong' })
    });
    assert.strictEqual(response.status, 401);
  });

  test('should succeed login with correct credentials and set cookie', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'testpassword' })
    });
    assert.strictEqual(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes('connect.sid'));
  });

  test('should allow access to protected route after login', async () => {
    // 1. Login to get cookie
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'testpassword' })
    });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // 2. Access protected route with cookie
    const response = await fetch(`${baseUrl}/`, {
      headers: { 'Cookie': cookie }
    });
    assert.strictEqual(response.status, 200);
    const body = await response.text();
    assert.ok(body.includes('<title>Recording Notes</title>'));
  });
});
