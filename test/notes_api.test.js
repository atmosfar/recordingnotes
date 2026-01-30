import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import app from '../server.js';
import { getDb, resetDbInstance } from '../db.js';

const testDbPath = 'test-notes-api.db';

describe('Note API Endpoints', () => {
  let server;
  let baseUrl;
  let sessionId;
  let authCookie;

  before(async () => {
    process.env.AUTH_USERNAME = 'testuser';
    process.env.AUTH_PASSWORD = 'testpassword';
    process.env.SESSION_SECRET = 'test_secret_key_long_enough_32_chars';

    if (existsSync(testDbPath)) {
        try { unlinkSync(testDbPath); } catch (e) {}
    }
    process.env.DB_PATH = testDbPath;
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

  test('POST /api/sessions/:id/notes should create a note', async () => {
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
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
    const response = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      headers: { 'Cookie': authCookie }
    });
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 1);
    assert.strictEqual(data[0].content, 'API Test Note');
  });

  test('PATCH /api/sessions/:session_id/notes/:note_id should update a note', async () => {
    // Create a note first
    const createRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({
        content: 'Note to be edited',
        timestamp: 456.789,
        color: 'red'
      })
    });
    const { id: noteId } = await createRes.json();

    // Update it
    const updateRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({
        content: 'Successfully edited note'
      })
    });
    const updateData = await updateRes.json();

    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateData.status, 'updated');

    // Verify change
    const getRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      headers: { 'Cookie': authCookie }
    });
    const notes = await getRes.json();
    const updatedNote = notes.find(n => n.id === noteId);
    assert.strictEqual(updatedNote.content, 'Successfully edited note');
  });
});
