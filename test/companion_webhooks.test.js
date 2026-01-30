import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';
import { getDb, initDb } from '../db.js';

const webhookToken = 'test_companion_token';

describe('Companion Webhooks', () => {
  let server;
  let baseUrl;

  before(() => {
    process.env.AUTH_WEBHOOK_TOKEN = webhookToken;
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

  test('POST /api/webhooks/companion - create action', async () => {
    const res = await fetch(`${baseUrl}/api/webhooks/companion?token=${webhookToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Companion Test Session' })
    });
    
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.ok(data.id);
  });

  test('POST /api/webhooks/companion - start action', async () => {
    // First create a session
    const createRes = await fetch(`${baseUrl}/api/webhooks/companion?token=${webhookToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Start Test' })
    });
    const createData = await createRes.json();
    const sessionId = createData.id;

    const res = await fetch(`${baseUrl}/api/webhooks/companion?token=${webhookToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', id: sessionId })
    });
    
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'started');
    assert.strictEqual(data.id, sessionId);

    // Verify in DB
    initDb();
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    assert.ok(session.started_at);
    assert.strictEqual(session.status, 'active');
  });

  test('POST /api/webhooks/companion - stop action', async () => {
    // First create a session
    const createRes = await fetch(`${baseUrl}/api/webhooks/companion?token=${webhookToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Stop Test' })
    });
    const createData = await createRes.json();
    const sessionId = createData.id;

    const res = await fetch(`${baseUrl}/api/webhooks/companion?token=${webhookToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', id: sessionId })
    });
    
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.status, 'stopped');
    assert.strictEqual(data.id, sessionId);

    // Verify in DB
    initDb();
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
    assert.ok(session.stopped_at);
    assert.strictEqual(session.status, 'completed');
  });

  test('POST /api/webhooks/companion - invalid action', async () => {
    const res = await fetch(`${baseUrl}/api/webhooks/companion?token=${webhookToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid' })
    });
    
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.ok(data.error);
  });
});