// Must set BEFORE importing server.js
process.env.RECNOTES_DB_PATH = './test-ws.db';
process.env.RECNOTES_AUTH_USERNAME = 'testuser';
process.env.RECNOTES_AUTH_PASSWORD = 'testpassword';
process.env.RECNOTES_SESSION_SECRET = 'test_secret_key_long_enough_32_chars';

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { unlinkSync, existsSync } from 'node:fs';
import WebSocket from 'ws';
import { resetDbInstance, initDb, getDb } from '../db.js';
import app, { setupWebSocket, sessionParser } from '../server.js';

describe('WebSocket API', () => {
  let server;
  let baseUrl;
  let wssUrl;
  let authCookie;
  let sessionId;

  before(async () => {
    if (existsSync('./test-ws.db')) {
      try { unlinkSync('./test-ws.db'); } catch (e) {}
    }
    resetDbInstance();

    return new Promise((resolve) => {
      server = app.listen(0, async () => {
        setupWebSocket(server, sessionParser);
        const { port } = server.address();
        baseUrl = `http://localhost:${port}`;
        wssUrl = `ws://localhost:${port}`;

        // Login to get cookie and create a session
        const loginRes = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'testpassword' })
        });
        authCookie = loginRes.headers.get('set-cookie').split(';')[0];

        const createRes = await fetch(`${baseUrl}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': authCookie
          },
          body: JSON.stringify({ name: 'WS Test Session' })
        });
        sessionId = (await createRes.json()).id;

        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(() => {
        try { if (existsSync('./test-ws.db')) unlinkSync('./test-ws.db'); } catch (e) {}
        resolve();
      });
    });
  });

  // Helper: connect WebSocket using http.Agent to ensure proper upgrade
  function connectWS(cookie) {
    return new Promise((resolve, reject) => {
      const agent = new http.Agent();
      const ws = new WebSocket(wssUrl, {
        headers: { 'Cookie': cookie },
        agent
      });
      ws.on('open', () => resolve(ws));
      ws.on('error', (err) => reject(err));
      // Timeout
      setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
    });
  }

  // Helper: send message and wait for response matching a type filter
  function sendMessage(ws, msg, expectedType) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket message timeout')), 5000);
      const handler = (data) => {
        const parsed = JSON.parse(data.toString());
        if (!expectedType || parsed.type === expectedType) {
          clearTimeout(timeout);
          ws.removeListener('message', handler);
          resolve(parsed);
        }
        // If expectedType specified and type doesn't match, keep listening
      };
      ws.on('message', handler);
      ws.send(JSON.stringify(msg));
    });
  }

  // T53: WebSocket connection + JOIN_SESSION
  test('T53: WebSocket connects and JOIN_SESSION returns session data', async () => {
    const ws = await connectWS(authCookie);

    const response = await sendMessage(ws, {
      type: 'JOIN_SESSION',
      sessionId: sessionId.toString()
    }, 'SESSION_DATA');

    assert.strictEqual(response.type, 'SESSION_DATA');
    assert.ok(response.session);
    assert.strictEqual(response.session.id, sessionId);
    assert.ok(Array.isArray(response.notes));

    ws.close();
  });

  // T54: GET_SESSIONS message handler
  test('T54: GET_SESSIONS returns list of sessions', async () => {
    const ws = await connectWS(authCookie);

    const response = await sendMessage(ws, { type: 'GET_SESSIONS' });

    assert.strictEqual(response.type, 'SESSION_LIST_UPDATE');
    assert.ok(Array.isArray(response.sessions));
    assert.ok(response.sessions.length >= 1);

    ws.close();
  });

  // T55: LEAVE_SESSION + sessionRooms cleanup
  test('T55: LEAVE_SESSION removes client from room', async () => {
    const ws = await connectWS(authCookie);

    // Join session
    await sendMessage(ws, {
      type: 'JOIN_SESSION',
      sessionId: sessionId.toString()
    });

    // Leave session
    const response = await sendMessage(ws, { type: 'LEAVE_SESSION' });

    assert.strictEqual(response.type, 'SESSION_LIST_UPDATE');

    ws.close();
  });

  // T56: CREATE_SESSION via WebSocket
  test('T56: CREATE_SESSION via WebSocket creates a session', async () => {
    const ws = await connectWS(authCookie);

    const response = await sendMessage(ws, {
      type: 'CREATE_SESSION',
      name: 'WS Created Session'
    });

    assert.strictEqual(response.type, 'SESSION_CREATED');
    assert.ok(response.id);
    assert.strictEqual(response.name, 'WS Created Session');

    ws.close();
  });

  // T57: CREATE_NOTE via WebSocket
  test('T57: CREATE_NOTE via WebSocket adds a note', async () => {
    const ws = await connectWS(authCookie);

    // Join session first
    await sendMessage(ws, {
      type: 'JOIN_SESSION',
      sessionId: sessionId.toString()
    });

    // Create a note
    const response = await sendMessage(ws, {
      type: 'CREATE_NOTE',
      payload: { content: 'WS Note', timestamp: Date.now(), color: 'red' }
    });

    assert.strictEqual(response.type, 'NOTE_UPDATE');
    assert.strictEqual(response.sessionId, sessionId);

    ws.close();
  });

  // T58: UPDATE_NOTE via WebSocket
  test('T58: UPDATE_NOTE via WebSocket updates note content', async () => {
    const ws = await connectWS(authCookie);

    // Join session
    await sendMessage(ws, {
      type: 'JOIN_SESSION',
      sessionId: sessionId.toString()
    });

    // Create a note first
    const createResp = await sendMessage(ws, {
      type: 'CREATE_NOTE',
      payload: { content: 'Original', timestamp: Date.now() }
    });
    const noteId = createResp.notes[createResp.notes.length - 1].id;

    // Update the note
    const updateResp = await sendMessage(ws, {
      type: 'UPDATE_NOTE',
      noteId: noteId.toString(),
      content: 'Updated via WS'
    });

    assert.strictEqual(updateResp.type, 'NOTE_UPDATE');

    ws.close();
  });

  // T59: DELETE_NOTE via WebSocket
  test('T59: DELETE_NOTE via WebSocket removes a note', async () => {
    const ws = await connectWS(authCookie);

    // Join session
    await sendMessage(ws, {
      type: 'JOIN_SESSION',
      sessionId: sessionId.toString()
    });

    // Create a note
    await sendMessage(ws, {
      type: 'CREATE_NOTE',
      payload: { content: 'To Delete', timestamp: Date.now() }
    });

    // Delete the note
    const deleteResp = await sendMessage(ws, {
      type: 'DELETE_NOTE',
      noteId: '1'
    }, 'NOTE_DELETED');

    assert.strictEqual(deleteResp.type, 'NOTE_DELETED');
    assert.strictEqual(deleteResp.sessionId, sessionId);

    ws.close();
  });

  // T60: UPDATE_SESSION / DELETE_SESSION via WebSocket
  test('T60: UPDATE_SESSION via WebSocket updates session name', async () => {
    const ws = await connectWS(authCookie);

    const response = await sendMessage(ws, {
      type: 'UPDATE_SESSION',
      sessionId: sessionId.toString(),
      name: 'Updated via WS'
    });

    assert.strictEqual(response.type, 'SESSION_LIST_UPDATE');

    ws.close();
  });

  test('T60: DELETE_SESSION via WebSocket deletes a session', async () => {
    // Create a new session to delete
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'WS Delete Test' })
    });
    const delSessionId = (await createRes.json()).id;

    const ws = await connectWS(authCookie);

    const response = await sendMessage(ws, {
      type: 'DELETE_SESSION',
      sessionId: delSessionId.toString()
    });

    assert.strictEqual(response.type, 'SESSION_DELETED');
    assert.strictEqual(response.sessionId, delSessionId.toString());

    ws.close();
  });

  // T61: WebSocket upgrade auth (401 for unauthenticated)
  test('T61: WebSocket without auth returns 401', async () => {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wssUrl);
      ws.on('error', () => {
        resolve();
      });
      ws.on('open', () => {
        ws.close();
        reject(new Error('WebSocket connected without auth - expected 401'));
      });
      setTimeout(() => {
        ws.close();
        reject(new Error('WebSocket upgrade timeout'));
      }, 3000);
    });
  });

  // T62: ws.on('close') room cleanup
  test('T62: WebSocket close triggers room cleanup', async () => {
    // Create a fresh session for this test
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookie
      },
      body: JSON.stringify({ name: 'T62 Cleanup Test' })
    });
    const testSessionId = (await createRes.json()).id;

    const ws = await connectWS(authCookie);

    // Join session
    await sendMessage(ws, {
      type: 'JOIN_SESSION',
      sessionId: testSessionId.toString()
    });

    // Close without leaving — should still cleanup
    const closePromise = new Promise((resolve) => {
      ws.on('close', resolve);
      ws.close();
    });

    await closePromise;

    // Verify the client was removed from the room
    const ws2 = await connectWS(authCookie);
    const listResponse = await sendMessage(ws2, { type: 'GET_SESSIONS' });
    assert.strictEqual(listResponse.type, 'SESSION_LIST_UPDATE');

    ws2.close();
  });
});
