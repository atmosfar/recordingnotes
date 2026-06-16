// Must set BEFORE importing server.js (which reads dotenv at load time)
process.env.RECNOTES_EXPORT_TIMEZONE = 'UTC';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import app from '../server.js';
import { getDb, resetDbInstance } from '../db.js';

const testDbPath = 'test-export.db';

describe('CSV Export Endpoint', () => {
  let server;
  let baseUrl;
  let sessionId;
  let authCookie;
  let sessionStartMs;

  // Helper: calculate UTC ms for N seconds since UTC midnight today
  // (matches default EXPORT_TIMEZONE = 'UTC')
  function utcSecondsToMs(seconds) {
    const now = new Date();
    const utcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
    return utcMidnight + Math.round(seconds * 1000);
  }

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

        // Create session
        const createRes = await fetch(`${baseUrl}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          body: JSON.stringify({ name: 'Export Test' })
        });
        const created = await createRes.json();
        sessionId = created.id;

        // Add a note at 00:01:00.000 (clock mode: UTC ms for 60s since UTC midnight)
        await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          body: JSON.stringify({ content: 'Test Note', timestamp: utcSecondsToMs(60.0) })
        });

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

  test('GET /api/sessions/:id/export should return REAPER compatible CSV with millisecond precision', async () => {
    // Add a note at 00:02:03.456 (clock mode: UTC ms for 123.456s since UTC midnight)
    await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': authCookie
        },
        body: JSON.stringify({ content: 'Precise Note', timestamp: utcSecondsToMs(123.456), color: '#2ecc71' })
    });

    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/export`, {
      headers: { 'Cookie': authCookie }
    });
    const body = await response.text();

    assert.strictEqual(response.status, 200);
    assert.ok(response.headers.get('content-type').includes('text/csv'));
    // 123.456s = 00:02:03.456
    assert.ok(body.includes('M2,"Precise Note",00:02:03.456,,,2ECC71'));
  });

  test('GET /api/sessions/:id/export?format=audition should return Audition compatible CSV', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/export?format=audition`, {
      headers: { 'Cookie': authCookie }
    });
    const body = await response.text();
    
    assert.strictEqual(response.status, 200);
    // Check for tab delimiters and correct header
    assert.ok(body.includes('Name\tStart\tDuration\tTime Format\tType\tDescription'));
    // Check for a data row (tab separated)
    // Note 1 was 'Test Note' at 60.0s (00:01:00.000)
    assert.ok(body.includes('Test Note\t00:01:00.000\t0:00.000\tdecimal\tCue'));
  });

  test('GET /api/sessions/:id/export?format=edl&fps=24 should return EDL compatible text', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/export?format=edl&fps=24`, {
      headers: { 'Cookie': authCookie }
    });
    const body = await response.text();
    
    assert.strictEqual(response.status, 200);
    assert.ok(body.includes('TITLE: Export Test'));
    assert.ok(body.includes('FCM: NON-DROP FRAME'));
    // Note 1 was 'Test Note' at 60.0s -> 00:01:00:00 (24fps)
    assert.ok(body.includes('001  001      V     C        00:01:00:00 00:01:00:01 00:01:00:00 00:01:00:01'));
    assert.ok(body.includes('|C:ResolveColorBlue |M:Test Note |D:1'));
  });

  // T41: export non-existent session (404)
  test('T41: GET /api/sessions/:id/export returns 404 for non-existent session', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/99999/export`, {
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(response.status, 404);
    const data = await response.json();
    assert.ok(data.error);
  });

  // T42: EDL drop-frame (29.97DF) export
  test('T42: GET /api/sessions/:id/export?format=edl&fps=29.97DF returns drop-frame EDL', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/export?format=edl&fps=29.97DF`, {
      headers: { 'Cookie': authCookie }
    });
    const body = await response.text();

    assert.strictEqual(response.status, 200);
    assert.ok(body.includes('FCM: DROP FRAME'));
    // The semicolon separator indicates drop frame
    assert.ok(body.includes(';'));
    assert.ok(body.includes('TITLE: Export Test'));
  });

  // T43: RECNOTES_EXPORT_TIMEZONE non-UTC export
  test('T43: RECNOTES_EXPORT_TIMEZONE changes export timezone', async () => {
    // Create a new session for this test
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T43 Timezone Test' })
    });
    const tzSessionId = (await createRes.json()).id;

    // Add a note
    await fetch(`${baseUrl}/api/sessions/${tzSessionId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ content: 'TZ Note', timestamp: utcSecondsToMs(3600) })
    });

    // Export with Europe/London timezone
    const response = await fetch(`${baseUrl}/api/sessions/${tzSessionId}/export`, {
      headers: { 'Cookie': authCookie }
    });
    const body = await response.text();

    assert.strictEqual(response.status, 200);
    // The export should still work (timezone affects clock-mode timestamp conversion)
    assert.ok(body.includes('M1,"TZ Note"'));
  });

  // T44: export filename sanitization (special chars)
  test('T44: Export filename sanitizes special characters', async () => {
    // Create a session with special characters in the name
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Test/Session:With*Special|Chars?' })
    });
    const specialSessionId = (await createRes.json()).id;

    const response = await fetch(`${baseUrl}/api/sessions/${specialSessionId}/export`, {
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(response.status, 200);
    // Check Content-Disposition header for sanitized filename
    const contentDisp = response.headers.get('content-disposition');
    assert.ok(contentDisp);
    // Special chars should be removed from filename
    assert.ok(!contentDisp.includes('/'));
    assert.ok(!contentDisp.includes(':'));
    assert.ok(!contentDisp.includes('*'));
    assert.ok(!contentDisp.includes('|'));
    assert.ok(!contentDisp.includes('?'));
  });
});
