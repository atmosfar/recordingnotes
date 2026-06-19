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

    // Verify last_run_ms is set (elapsed_ms only rolls forward on next start)
    initDb();
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    assert.ok((session.last_run_ms || 0) > 0);
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

  // T63: Triggers add_note action (clock mode)
  test('T63: Triggers add_note creates a note in clock mode session', async () => {
    // Create a session (default: clock mode)
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Add Note Test' })
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_note', id, text: 'Trigger note' })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    assert.strictEqual(data.status, 'created');

    // Verify in DB
    initDb();
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(data.id);
    assert.ok(note);
    assert.strictEqual(note.content, 'Trigger note');
    assert.strictEqual(note.session_id, id);
    assert.ok(note.timestamp_ms);
  });

  // T64: Triggers add_note blocked when timer stopped
  test('T64: Triggers add_note returns 400 when timer is stopped', async () => {
    // Create and start a session
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Add Note Stopped' })
    });
    const { id } = await createRes.json();

    // Start timer
    await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', id })
    });

    // Stop timer
    await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'stop', id })
    });

    // Try to add note
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_note', id, text: 'Should fail' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);

    // Verify no note was created
    initDb();
    const db = getDb();
    const notes = db.prepare('SELECT COUNT(*) as count FROM notes WHERE session_id = ?').get(id);
    assert.strictEqual(notes.count, 0);
  });

  // T65: Triggers add_note returns 400 when id is missing
  test('T65: Triggers add_note returns 400 when id is missing', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_note', text: 'No id' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // T66: Triggers add_note returns 400 when text is missing
  test('T66: Triggers add_note returns 400 when text is missing', async () => {
    // Create a session
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Add Note Missing Text' })
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_note', id })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // T67: Triggers add_note returns 400 for non-existent session
  test('T67: Triggers add_note returns 404 for non-existent session', async () => {
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_note', id: 99999, text: 'Ghost session' })
    });

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
  });

  // T68: Triggers add_note trims text
  test('T68: Triggers add_note trims whitespace from text', async () => {
    // Create a session
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Trim Test' })
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_note', id, text: '  trimmed  ' })
    });

    assert.strictEqual(res.status, 201);

    // Verify text was trimmed
    initDb();
    const db = getDb();
    const note = db.prepare('SELECT content FROM notes WHERE session_id = ? ORDER BY id DESC LIMIT 1').get(id);
    assert.strictEqual(note.content, 'trimmed');
  });

  // T69: Triggers add_note returns 400 for empty text after trim
  test('T69: Triggers add_note returns 400 for whitespace-only text', async () => {
    // Create a session
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Empty Text Test' })
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_note', id, text: '   ' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // T70: Triggers add_note works with timer running
  test('T70: Triggers add_note succeeds when timer is running', async () => {
    // Create and start a session
    const createRes = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Timer Running Note' })
    });
    const { id } = await createRes.json();

    // Start timer
    await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', id })
    });

    // Add note while timer is running
    const res = await fetch(`${baseUrl}/api/triggers?token=${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_note', id, text: 'While running' })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);

    // Verify in DB
    initDb();
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(data.id);
    assert.ok(note);
    assert.strictEqual(note.content, 'While running');
  });
});
