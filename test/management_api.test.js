import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';
import { initDb, getDb } from '../db.js';

describe('Management API Endpoints', () => {
  let server;
  let baseUrl;
  let authCookie;

  before(async () => {
    process.env.RECNOTES_AUTH_USERNAME = 'testuser';
    process.env.RECNOTES_AUTH_PASSWORD = 'testpassword';
    process.env.RECNOTES_SESSION_SECRET = 'test_secret_key_long_enough_32_chars';
    process.env.RECNOTES_DB_PATH = 'test-mgmt-api.db';
    initDb();
    
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
      server.close(resolve);
    });
  });

  test('PATCH /api/sessions/:id should update session name', async () => {
    // Create a session
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Old Name' })
    });
    const { id } = await createRes.json();

    const patchRes = await fetch(`${baseUrl}/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'New Name' })
    });
    assert.strictEqual(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.strictEqual(patchData.status, 'updated');

    const getRes = await fetch(`${baseUrl}/api/sessions/${id}`, {
      headers: { 'Cookie': authCookie }
    });
    const session = await getRes.json();
    assert.strictEqual(session.name, 'New Name');
  });

  test('DELETE /api/sessions/:id should delete session', async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'To Be Deleted' })
    });
    const { id } = await createRes.json();

    const delRes = await fetch(`${baseUrl}/api/sessions/${id}`, {
      method: 'DELETE',
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(delRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/sessions/${id}`, {
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(getRes.status, 404);
  });

  test('DELETE /api/sessions/:session_id/notes/:note_id should delete note', async () => {
    const createSessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Note Del Test' })
    });
    const { id: sessionId } = await createSessRes.json();

    const createNoteRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ content: 'Note to del', timestamp: 10 })
    });
    const { id: noteId } = await createNoteRes.json();

    const delRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes/${noteId}`, {
      method: 'DELETE',
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(delRes.status, 200);

    const getNotesRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      headers: { 'Cookie': authCookie }
    });
    const notes = await getNotesRes.json();
    assert.ok(!notes.find(n => n.id === noteId));
  });
});
