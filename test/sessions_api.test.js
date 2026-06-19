import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import app from '../server.js';
import { getDb, resetDbInstance } from '../services/db.js';

const testDbPath = 'test-sessions-api.db';

describe('Session API Endpoints', () => {
  let server;
  let baseUrl;
  let authCookie;

  before(async () => {
    process.env.RECNOTES_AUTH_USERNAME = 'testuser';
    process.env.RECNOTES_AUTH_PASSWORD = 'testpassword';
    process.env.RECNOTES_SESSION_SECRET = 'test_secret_key_long_enough_32_chars';

    if (existsSync(testDbPath)) {
        try { unlinkSync(testDbPath); } catch (e) {}
    }
    process.env.RECNOTES_DB_PATH = testDbPath;
    resetDbInstance();
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
      server.close(() => {
        if (existsSync(testDbPath)) {
            try { unlinkSync(testDbPath); } catch (e) {}
        }
        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test('POST /api/sessions should create a session', async () => {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'API Test Session', timestamp_mode: 'timer' })
    });
    const data = await response.json();
    
    assert.strictEqual(response.status, 201);
    assert.ok(data.id);
  });

  test('GET /api/sessions should list sessions', async () => {
    const response = await fetch(`${baseUrl}/api/sessions`, {
      headers: { 'Cookie': authCookie }
    });
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 1);
  });

  test('GET /api/sessions/:id should return a session', async () => {
    // Create one first
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Specific Session' })
    });
    const created = await createRes.json();

    const response = await fetch(`${baseUrl}/api/sessions/${created.id}`, {
      headers: { 'Cookie': authCookie }
    });
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.name, 'Specific Session');
  });

  test('GET /api/sessions/:id should return 404 for non-existent session', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/99999`, {
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(response.status, 404);
    const data = await response.json();
    assert.strictEqual(data.error, 'Session not found');
  });
});
