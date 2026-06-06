import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { getDb, initDb } from '../db.js';

const apiToken = 'test_triggers_token';

describe('Triggers API', () => {
  let server;
  let baseUrl;
  let app;

  before(async () => {
    process.env.RECNOTES_AUTH_API_TOKEN = apiToken;
    
    // Dynamic import to ensure process.env is set BEFORE app initializes middleware
    const module = await import('../server.js');
    app = module.default;

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

  test('POST /api/triggers - create action', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Trigger Test Session' })
    });
    
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.ok(data.id);
  });

  test('POST /api/triggers - start action', async () => {
    // First create a session
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Start Test' })
    });
    const createData = await createRes.json();
    const sessionId = createData.id;

    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
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

  test('POST /api/triggers - stop action', async () => {
    // First create a session
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Stop Test' })
    });
    const createData = await createRes.json();
    const sessionId = createData.id;

    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
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

  test('POST /api/triggers - invalid action', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid' })
    });
    
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.ok(data.error);
  });
});
