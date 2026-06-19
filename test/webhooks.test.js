import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { getDb, resetDbInstance, initDb } from '../services/db.js';

const testDbPath = 'test-webhooks.db';
const apiToken = 'test_api_token';

describe('SquadCast Webhook Endpoints', () => {
  let server;
  let baseUrl;
  let app;

  before(async () => {
    process.env.RECNOTES_AUTH_API_TOKEN = apiToken;
    if (existsSync(testDbPath)) {
        try { unlinkSync(testDbPath); } catch (e) {}
    }
    process.env.RECNOTES_DB_PATH = testDbPath;
    resetDbInstance();
    
    // Dynamic import to ensure process.env is set BEFORE app initializes middleware
    const module = await import('../server.js');
    app = module.default;

    // Create base session for started/stopped tests
    initDb();
    const db = getDb();
    db.prepare('INSERT INTO sessions (name, external_id) VALUES (?, ?)').run('SquadCast Session 123', 'sq_session_123');

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
        try { if (existsSync(testDbPath)) unlinkSync(testDbPath); } catch (e) {}
        resolve();
      });
    });
  });

  test('POST /api/webhooks/squadcast - recording_session.created', async () => {
    const payload = {
      "name": "recording_session.created",
      "sessionID": "sq_session_new_created",
      "sessionTitle": "New SquadCast Session",
      "orgID": "org_abc",
      "showID": "show_789",
      "showName": "My Amazing Show"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 201);
    
    // Verify session was created in DB
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE external_id = ?').get('sq_session_new_created');
    assert.ok(session);
    assert.strictEqual(session.name, 'New SquadCast Session');
    assert.strictEqual(session.timestamp_mode, 'timer');
  });

  test('POST /api/webhooks/squadcast - participant.joined (workaround)', async () => {
    const uniqueId = `${Date.now()}`;
    const payload = {
      "name": "participant.joined",
      "sessionID": uniqueId,
      "sessionTitle": "Workaround Session",
      "orgID": "org_abc"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 201);
    
    // Verify session was created in DB
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE external_id = ?').get(uniqueId);
    assert.ok(session);
    assert.strictEqual(session.name, 'Workaround Session');
    assert.strictEqual(session.timestamp_mode, 'timer');
  });

  test('POST /api/webhooks/squadcast - recording.started', async () => {
    const payload = {
      "name": "recording.started",
      "sessionID": "sq_session_123",
      "sessionTitle": "SquadCast Session 123",
      "orgID": "org_abc"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 200);
    
    // Verify started_at was updated
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE external_id = ?').get('sq_session_123');
    assert.ok(session.started_at);
  });

  test('POST /api/webhooks/squadcast - recording.stopped', async () => {
    const payload = {
      "name": "recording.stopped",
      "sessionID": "sq_session_123",
      "sessionTitle": "SquadCast Session 123",
      "orgID": "org_abc"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 200);
    
    // Verify stopped_at was updated
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE external_id = ?').get('sq_session_123');
    assert.ok(session.stopped_at);
  });

  // T45: SquadCast — session already exists (already_exists)
  test('T45: SquadCast webhook returns already_exists for duplicate external_id', async () => {
    const payload = {
      "name": "recording_session.created",
      "sessionID": "sq_session_123",
      "sessionTitle": "Duplicate Session",
      "orgID": "org_abc"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.status, 'already_exists');
    assert.ok(data.id);

    // Verify the original session name was NOT changed
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE external_id = ?').get('sq_session_123');
    assert.strictEqual(session.name, 'SquadCast Session 123');
  });

  // T46: SquadCast — unknown event type (ignored)
  test('T46: SquadCast webhook returns ignored for unknown event type', async () => {
    const payload = {
      "name": "some.unknown.event",
      "sessionID": "sq_session_999",
      "sessionTitle": "Unknown Event",
      "orgID": "org_abc"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.status, 'ignored');
    assert.ok(data.message);
    assert.ok(data.message.includes('Unsupported event'));
  });

  // T47: SquadCast — recording.started/stopped for non-existent session (404)
  test('T47: SquadCast recording.started returns 404 for non-existent session', async () => {
    const payload = {
      "name": "recording.started",
      "sessionID": "sq_session_nonexistent",
      "sessionTitle": "Non-existent",
      "orgID": "org_abc"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 404);
    const data = await response.json();
    assert.ok(data.error);
  });

  test('T47: SquadCast recording.stopped returns 404 for non-existent session', async () => {
    const payload = {
      "name": "recording.stopped",
      "sessionID": "sq_session_nonexistent",
      "sessionTitle": "Non-existent",
      "orgID": "org_abc"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/${apiToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 404);
    const data = await response.json();
    assert.ok(data.error);
  });
});
