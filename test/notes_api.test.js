import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app, { db } from '../server.js';

describe('Note API Endpoints', () => {
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
          body: JSON.stringify({ name: 'Note API Test Session' })
        });
        const created = await createRes.json();
        sessionId = created.id;
        
        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test('POST /api/sessions/:id/notes should create a note', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: 'API Test Note',
        timestamp: '00:05:00',
        color: 'blue'
      })
    });
    const data = await response.json();
    
    assert.strictEqual(response.status, 201);
    assert.ok(data.id);
  });

  test('GET /api/sessions/:id/notes should list notes', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`);
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 1);
    assert.strictEqual(data[0].content, 'API Test Note');
  });
});
