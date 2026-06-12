import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';

describe('Server Basic Functionality', () => {
  let server;
  let baseUrl;
  let authCookie;

  before(async () => {
    process.env.RECNOTES_AUTH_USERNAME = 'testuser';
    process.env.RECNOTES_AUTH_PASSWORD = 'testpassword';
    process.env.RECNOTES_SESSION_SECRET = 'test_secret_key_long_enough_32_chars';

    return new Promise((resolve) => {
      server = app.listen(0, async () => {
        const { port } = server.address();
        baseUrl = `http://localhost:${port}`;
        
        // Login to get cookie
        const loginRes = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'testpassword' })
        });
        authCookie = loginRes.headers.get('set-cookie').split(';')[0];
        
        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test('should serve index.html at root', async () => {
    const response = await fetch(`${baseUrl}/`, {
      headers: { 'Cookie': authCookie }
    });
    const body = await response.text();
    
    assert.strictEqual(response.status, 200);
    assert.ok(body.includes('<title>Recording Notes</title>'));
  });

  test('should respond to GET /api/status', async () => {
    const response = await fetch(`${baseUrl}/api/status`, {
      headers: { 'Cookie': authCookie }
    });
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
  });
});
