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

  // T48: Triggers start action
  test('T48: Triggers start action sets started_at and status to active', async () => {
    // Create a session first
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'T48 Start Test' })
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', id })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'started');
    assert.strictEqual(data.id, id);

    // Verify timestamp_mode was set to timer
    initDb();
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    assert.strictEqual(session.timestamp_mode, 'timer');
    assert.strictEqual(session.status, 'active');
    assert.ok(session.started_at);
    assert.strictEqual(session.stopped_at, null);
  });

  // T49: Triggers stop action (elapsed_ms)
  test('T49: Triggers stop action accumulates elapsed_ms', async () => {
    // Create and start a session
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'T49 Stop Test' })
    });
    const { id } = await createRes.json();

    // Start timer
    await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', id })
    });

    // Wait a bit for elapsed time
    await new Promise(r => setTimeout(r, 50));

    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', id })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'stopped');
    assert.strictEqual(data.id, id);

    // Verify elapsed_ms accumulated
    initDb();
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    assert.ok(session.elapsed_ms > 0);
    assert.ok(session.stopped_at);
    assert.strictEqual(session.status, 'completed');
  });

  // T50: Triggers — invalid/missing action (400)
  test('T50: Triggers returns 400 for invalid action', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'nonexistent' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
    assert.ok(data.error.toLowerCase().includes('invalid') || data.error.toLowerCase().includes('missing'));
  });

  // T51: Triggers — missing required params (400)
  test('T51: Triggers start action returns 400 when id is missing', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  test('T51: Triggers stop action returns 400 when id is missing', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  test('T51: Triggers create action returns 400 when name is missing', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // T52: Triggers — session not found (404)
  test('T52: Triggers start returns 404 for non-existent session', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', id: 99999 })
    });

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
  });

  test('T52: Triggers stop returns 404 for non-existent session', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', id: 99999 })
    });

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
  });
});
