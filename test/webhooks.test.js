import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';
import { getDb } from '../db.js';

describe('SquadCast Webhook Endpoints', () => {
  let server;
  let baseUrl;

  before(() => {
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

  test('POST /api/webhooks/squadcast - recording_session.created', async () => {
    const payload = {
      "name": "recording_session.created",
      "sessionID": "sq_session_123",
      "sessionTitle": "SquadCast Session 123",
      "orgID": "org_abc",
      "showID": "show_789",
      "showName": "My Amazing Show"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(response.status, 201);
    
    // Verify session was created in DB
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE external_id = ?').get('sq_session_123');
    assert.ok(session);
    assert.strictEqual(session.name, 'SquadCast Session 123');
  });

  test('POST /api/webhooks/squadcast - recording.started', async () => {
    const payload = {
      "name": "recording.started",
      "sessionID": "sq_session_123",
      "sessionTitle": "SquadCast Session 123",
      "orgID": "org_abc"
    };

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast`, {
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

    const response = await fetch(`${baseUrl}/api/webhooks/squadcast`, {
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
});
