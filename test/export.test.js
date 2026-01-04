import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';

describe('CSV Export Endpoint', () => {
  let server;
  let baseUrl;
  let sessionId;

  before(async () => {
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
          body: JSON.stringify({ content: 'Test Note', timestamp: '00:01:00' })
        });
        
        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test('GET /api/sessions/:id/export should return REAPER compatible CSV', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/export`);
    const body = await response.text();
    
    assert.strictEqual(response.status, 200);
    assert.ok(response.headers.get('content-type').includes('text/csv'));
    assert.ok(response.headers.get('content-disposition').includes('filename="Export_Test.csv"'));
    assert.ok(body.includes('#,Name,Start,End,Length,Color'));
    assert.ok(body.includes('M1,"Test Note",00:01:00,,,'));
  });
});
