import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';
import { initDb, getDb } from '../services/db.js';

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
      body: JSON.stringify({ content: 'Note to del', timestamp: Date.now() })
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

  // T31: PATCH notes via API
  test('T31: PATCH /api/sessions/:id/notes/:note_id updates note content', async () => {
    const createSessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T31 Patch Test' })
    });
    const { id: sessionId } = await createSessRes.json();

    const createNoteRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ content: 'Old content', timestamp: Date.now() })
    });
    const { id: noteId } = await createNoteRes.json();

    const patchRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes/${noteId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ content: 'Updated content' })
    });

    assert.strictEqual(patchRes.status, 200);
    const patchData = await patchRes.json();
    assert.strictEqual(patchData.status, 'updated');

    // Verify in DB
    const db = getDb();
    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    assert.strictEqual(note.content, 'Updated content');
  });

  // T32: PATCH note — non-existent note (404)
  test('T32: PATCH /api/sessions/:id/notes/:note_id returns 404 for non-existent note', async () => {
    const createSessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T32 Not Found Test' })
    });
    const { id: sessionId } = await createSessRes.json();

    const patchRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes/99999`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ content: 'Ghost' })
    });

    assert.strictEqual(patchRes.status, 404);
    const data = await patchRes.json();
    assert.ok(data.error);
  });

  // T33: PATCH note — missing content (400)
  test('T33: PATCH /api/sessions/:id/notes/:note_id returns 400 when content is missing', async () => {
    const createSessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T33 Missing Content Test' })
    });
    const { id: sessionId } = await createSessRes.json();

    const createNoteRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ content: 'Original', timestamp: Date.now() })
    });
    const { id: noteId } = await createNoteRes.json();

    const patchRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes/${noteId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({})
    });

    assert.strictEqual(patchRes.status, 400);
    const data = await patchRes.json();
    assert.ok(data.error);
  });

  // T34: DELETE note — non-existent note (404)
  test('T34: DELETE /api/sessions/:id/notes/:note_id returns 404 for non-existent note', async () => {
    const createSessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T34 Delete Not Found Test' })
    });
    const { id: sessionId } = await createSessRes.json();

    const delRes = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes/99999`, {
      method: 'DELETE',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(delRes.status, 404);
    const data = await delRes.json();
    assert.ok(data.error);
  });

  // T35: POST note — missing content/timestamp (400)
  test('T35: POST /api/sessions/:id/notes returns 400 when content is missing', async () => {
    const createSessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T35 Missing Content Test' })
    });
    const { id: sessionId } = await createSessRes.json();

    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ timestamp: Date.now() })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  test('T35: POST /api/sessions/:id/notes returns 400 when timestamp is missing', async () => {
    const createSessRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T35 Missing Timestamp Test' })
    });
    const { id: sessionId } = await createSessRes.json();

    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ content: 'No timestamp' })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // T36: POST note — timer mode without timer running (400)
  test('T36: POST /api/sessions/:id/notes returns 400 when timer is not running', async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T36 Timer Not Running', timestamp_mode: 'timer' })
    });
    const { id: sessionId } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/sessions/${sessionId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ content: 'Before timer', timestamp: Date.now() })
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.toLowerCase().includes('timer'));
  });

  // T37: PATCH session — non-existent session (404)
  test('T37: PATCH /api/sessions/:id returns 404 for non-existent session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/99999`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'Ghost' })
    });

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
  });

  // T38: PATCH session — missing name (400)
  test('T38: PATCH /api/sessions/:id returns 400 when name is missing', async () => {
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T38 Test' })
    });
    const { id } = await createRes.json();

    const res = await fetch(`${baseUrl}/api/sessions/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({})
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  // T39: DELETE session — non-existent session (404)
  test('T39: DELETE /api/sessions/:id returns 404 for non-existent session', async () => {
    const res = await fetch(`${baseUrl}/api/sessions/99999`, {
      method: 'DELETE',
      headers: { 'Cookie': authCookie }
    });

    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.ok(data.error);
  });

  // T40: POST session — missing name (400)
  test('T40: POST /api/sessions returns 400 when name is missing', async () => {
    const res = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({})
    });

    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });
});
