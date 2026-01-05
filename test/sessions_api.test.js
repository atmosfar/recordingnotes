import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import app from '../server.js';
import { getDb, resetDbInstance } from '../db.js';

const testDbPath = 'test-sessions-api.db';

describe('Session API Endpoints', () => {
  let server;
  let baseUrl;

  before(() => {
    if (existsSync(testDbPath)) {
        try { unlinkSync(testDbPath); } catch (e) {}
    }
    process.env.DB_PATH = testDbPath;
    resetDbInstance();
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'API Test Session', timestamp_mode: 'timer' })
    });
    const data = await response.json();
    
    assert.strictEqual(response.status, 201);
    assert.ok(data.id);
  });

  test('GET /api/sessions should list sessions', async () => {
    const response = await fetch(`${baseUrl}/api/sessions`);
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 1);
  });

  test('GET /api/sessions/:id should return a session', async () => {
    // Create one first
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Specific Session' })
    });
    const created = await createRes.json();

    const response = await fetch(`${baseUrl}/api/sessions/${created.id}`);
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.name, 'Specific Session');
  });
});
