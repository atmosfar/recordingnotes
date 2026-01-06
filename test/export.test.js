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

  before(async () => {
    if (existsSync(testDbPath)) {
        try { unlinkSync(testDbPath); } catch (e) {}
    }
    process.env.DB_PATH = testDbPath;
    resetDbInstance();
    return new Promise((resolve) => {
      server = app.listen(0, async () => {
        const { port } = server.address();
        baseUrl = `http://localhost:${port}`;
        
        // Create session
        const createRes = await fetch(`${baseUrl}/api/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Export Test' })
        });
        const created = await createRes.json();
        sessionId = created.id;

        // Add a note
        await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Test Note', timestamp: 60.0 })
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
    // Add a note with specific float seconds
    await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Precise Note', timestamp: 123.456, color: '#2ecc71' })
    });

    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/export`);
    const body = await response.text();
    
    assert.strictEqual(response.status, 200);
    assert.ok(response.headers.get('content-type').includes('text/csv'));
    // 123.456s = 00:02:03.456
    assert.ok(body.includes('M2,"Precise Note",00:02:03.456,,,2ECC71'));
  });
});
