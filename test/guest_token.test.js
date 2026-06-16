// Must set BEFORE importing server.js
process.env.RECNOTES_DB_PATH = './test-guest-token.db';
process.env.RECNOTES_AUTH_USERNAME = 'testuser';
process.env.RECNOTES_AUTH_PASSWORD = 'testpassword';
process.env.RECNOTES_SESSION_SECRET = 'test_secret_key_long_enough_32_chars';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { resetDbInstance } from '../db.js';
import app from '../server.js';

describe('Guest Token API Endpoints', () => {
  let server;
  let baseUrl;
  let authCookie;

  before(async () => {
    if (existsSync('./test-guest-token.db')) {
      try { unlinkSync('./test-guest-token.db'); } catch (e) {}
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
        try { if (existsSync('./test-guest-token.db')) unlinkSync('./test-guest-token.db'); } catch (e) {}
        resolve();
      });
    });
  });

  // T25: POST /api/sessions/:id/guest-token (generate + retrieve)
  test('T25: POST /api/sessions/:id/guest-token generates a new token', async () => {
    // Create a session without a guest token
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Guest Token Test' })
    });
    const { id } = await createRes.json();

    // Generate guest token
    const res = await fetch(`${baseUrl}/api/sessions/${id}/guest-token`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);
    assert.strictEqual(typeof data.token, 'string');
    assert.ok(data.token.length > 0);

    // Verify token is retrievable via GET session
    const getRes = await fetch(`${baseUrl}/api/sessions/${id}`, {
      headers: { 'Cookie': authCookie }
    });
    const session = await getRes.json();
    assert.strictEqual(session.guest_token, data.token);
  });

  test('T25: POST /api/sessions/:id/guest-token returns existing token if already set', async () => {
    // Create a session and set a guest token manually
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Existing Token Test' })
    });
    const { id } = await createRes.json();

    // Set a guest token
    await fetch(`${baseUrl}/api/sessions/${id}/guest-token`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    // Request again — should return the same token
    const res = await fetch(`${baseUrl}/api/sessions/${id}/guest-token`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.token);

    // Verify it's the same token
    const getRes = await fetch(`${baseUrl}/api/sessions/${id}`, {
      headers: { 'Cookie': authCookie }
    });
    const session = await getRes.json();
    assert.strictEqual(session.guest_token, data.token);
  });

  // T26: guest-token on non-existent session (404)
  test('T26: POST /api/sessions/:id/guest-token returns 404 for non-existent session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/99999/guest-token`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
  });
});
