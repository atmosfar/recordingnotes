// Must set BEFORE importing server.js
process.env.RECNOTES_DB_PATH = './test-timer-api.db';
process.env.RECNOTES_AUTH_USERNAME = 'testuser';
process.env.RECNOTES_AUTH_PASSWORD = 'testpassword';
process.env.RECNOTES_SESSION_SECRET = 'test_secret_key_long_enough_32_chars';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { getDb, resetDbInstance } from '../db.js';
import app from '../server.js';

describe('Timer Control API Endpoints', () => {
  let server;
  let baseUrl;
  let authCookie;

  before(async () => {
    if (existsSync('./test-timer-api.db')) {
      try { unlinkSync('./test-timer-api.db'); } catch (e) {}
    }
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
        try { if (existsSync('./test-timer-api.db')) unlinkSync('./test-timer-api.db'); } catch (e) {}
        resolve();
      });
    });
  });

  // T20: POST /api/sessions/:id/timer/start
  test('T20: POST /api/sessions/:id/timer/start starts the timer', async () => {
    // Create a session first
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Timer Start Test' })
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/sessions/${id}/timer/start`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.session.timestamp_mode, 'timer');
    assert.strictEqual(data.session.status, 'active');
    assert.ok(data.session.started_at);
    assert.strictEqual(data.session.stopped_at, null);

    // Verify in DB
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    assert.ok(session.started_at);
    assert.strictEqual(session.status, 'active');
  });

  // T21: POST /api/sessions/:id/timer/stop (elapsed_ms accumulation)
  test('T21: POST /api/sessions/:id/timer/stop accumulates elapsed_ms', async () => {
    // Create session and start timer
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Timer Stop Test' })
    });
    const { id } = await createRes.json();

    // Start timer
    await fetch(`${baseUrl}/api/sessions/${id}/timer/start`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    // Wait a bit to accumulate elapsed time
    await new Promise(r => setTimeout(r, 50));

    const res = await fetch(`${baseUrl}/api/sessions/${id}/timer/stop`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.ok(data.session.elapsed_ms > 0);
    assert.ok(data.session.stopped_at);
    assert.strictEqual(data.session.status, 'completed');

    // Verify elapsed_ms accumulated in DB
    const db = getDb();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    assert.ok(session.elapsed_ms > 0);
  });

  // T22: POST /api/sessions/:id/timer/reset (including notes-guard 400)
  test('T22: POST /api/sessions/:id/timer/reset blocks when session has notes', async () => {
    // Create session and add a note
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Timer Reset Test' })
    });
    const { id } = await createRes.json();

    // Add a note to prevent reset
    await fetch(`${baseUrl}/api/sessions/${id}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ content: 'Block reset', timestamp: Date.now() })
    });

    // Try to reset — should fail with 400
    const res = await fetch(`${baseUrl}/api/sessions/${id}/timer/reset`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes('notes'));
  });

  test('T22: POST /api/sessions/:id/timer/reset clears timer when no notes', async () => {
    // Create session without notes
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Timer Reset Clear Test' })
    });
    const { id } = await createRes.json();

    // Start timer
    await fetch(`${baseUrl}/api/sessions/${id}/timer/start`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    // Reset should succeed
    const res = await fetch(`${baseUrl}/api/sessions/${id}/timer/reset`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.session.started_at, null);
    assert.strictEqual(data.session.stopped_at, null);
    assert.strictEqual(data.session.elapsed_ms, 0);
  });

  // T23: timer/stop when timer not started (400)
  test('T23: POST /api/sessions/:id/timer/stop returns 400 when timer not started', async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Timer Not Started Test' })
    });
    const { id } = await createRes.json();

    // Stop without starting
    const res = await fetch(`${baseUrl}/api/sessions/${id}/timer/stop`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('timer not started') || data.error.toLowerCase().includes('not started'));
  });

  // T24: timer endpoints on non-existent session (404)
  test('T24: timer/start on non-existent session returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/99999/timer/start`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
  });

  test('T24: timer/stop on non-existent session returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/99999/timer/stop`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(res.status, 404);
  });

  test('T24: timer/reset on non-existent session returns 404', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/99999/timer/reset`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(res.status, 404);
  });
});
