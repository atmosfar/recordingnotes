import express from 'express';
import session from 'express-session';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { getPort, getApiToken, wasApiTokenExplicitlySet, getAuthCredentials, authIsRequired, getSessionSecret, getExportTimezone } from './middleware/config-accessors.js';
import { checkAuth, checkApiTokenAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import { getDb, initDb } from './db.js';
import * as sessions from './sessions.js';
import * as notes from './notes.js';
import exportRoutes from './routes/export.js';
import webhooksRoutes from './routes/webhooks.js';

const app = express();


app.use(express.json());

// Trust the reverse proxy's X-Forwarded-Proto header so Express knows when HTTPS is in use.
// This enables secure: 'auto' on session cookies to work correctly behind nginx/cloudflare/etc.
app.set('trust proxy', 1);

// Rate limiting to prevent brute-force attacks
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Auth is only required if both env vars are explicitly set.
// Otherwise the app runs in open/public mode (no login needed).
// Checked dynamically per-request so env changes are picked up.
// Session configuration
const sessionParser = session({
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: 'auto',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

app.use(sessionParser);

// Public routes
app.use(authRoutes);

// Root route requires auth
app.get('/', (req, res) => {
  if (authIsRequired() && !req.session?.authenticated) {
    return res.redirect('/login?returnTo=/');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files (publicly accessible, including from login page)
app.use(express.static(path.join(__dirname, 'public')));

// Webhook routes (before auth — they use token auth)
app.use('/api/webhooks', webhooksRoutes);

// Protect all following API routes
app.use(checkAuth);
app.get('/api/status', (req, res) => res.json({ status: 'ok' }));
app.use('/api/sessions', exportRoutes);

// WebSocket Server Initialization
let wss;
const sessionRooms = new Map(); // sessionId -> Set<ws>

function broadcastToAll(message) {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  });
}

function broadcastToRoom(sessionId, message) {
  const room = sessionRooms.get(sessionId.toString());
  if (!room) return;
  const data = JSON.stringify(message);
  room.forEach(client => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

function broadcastSessionList() {
  const db = getDb();
  const list = sessions.listSessions(db).map(session => {
    const room = sessionRooms.get(session.id.toString());
    return {
      ...session,
      active_users: room ? room.size : 0
    };
  });
  broadcastToAll({ type: 'SESSION_LIST_UPDATE', sessions: list });
}

function broadcastNoteUpdate(sessionId) {
  const db = getDb();
  const list = notes.listNotesBySession(db, sessionId);
  broadcastToRoom(sessionId, { type: 'NOTE_UPDATE', sessionId, notes: list });
}

function setupWebSocket(httpServer) {
  wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    sessionParser(request, {}, () => {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const queryToken = url.searchParams.get('token');

      const isGuest = queryToken || (request.session && request.session.guestToken);

      // In open/public mode (no auth configured), skip the check
      if (authIsRequired() && !request.session.authenticated && !isGuest) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Auto-authenticate in open mode
      if (!authIsRequired()) {
        request.session.authenticated = true;
      }

      // Ensure session is saved before upgrade
      request.session.save(() => {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      });
    });
  });

  wss.on('connection', (ws, request) => {
    ws.currentSessionId = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        if (data.type === 'JOIN_SESSION') {
          const { sessionId, guestToken } = data;
          let session = null;
          const db = getDb();

          const effectiveToken = guestToken || request.session.guestToken;

          if (request.session.authenticated && sessionId) {
            session = sessions.getSession(db, sessionId);
          } else if (effectiveToken) {
            session = sessions.getSessionByGuestToken(db, effectiveToken);
          }

          if (!session) {
            return ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found or unauthorized', code: 404 }));
          }

          const resolvedSessionId = session.id;

          if (ws.currentSessionId) {
            const oldRoom = sessionRooms.get(ws.currentSessionId.toString());
            if (oldRoom) oldRoom.delete(ws);
          }

          ws.currentSessionId = resolvedSessionId;
          if (!sessionRooms.has(resolvedSessionId.toString())) {
            sessionRooms.set(resolvedSessionId.toString(), new Set());
          }
          sessionRooms.get(resolvedSessionId.toString()).add(ws);
          broadcastSessionList();

          const list = notes.listNotesBySession(db, resolvedSessionId);
          ws.send(JSON.stringify({
            type: 'SESSION_DATA',
            session,
            notes: list
          }));
        } else if (data.type === 'GET_SESSIONS') {
          if (!request.session.authenticated) return;
          const db = getDb();
          const list = sessions.listSessions(db).map(session => {
            const room = sessionRooms.get(session.id.toString());
            return {
              ...session,
              active_users: room ? room.size : 0
            };
          });
          ws.send(JSON.stringify({ type: 'SESSION_LIST_UPDATE', sessions: list }));
        } else if (data.type === 'LEAVE_SESSION') {
          if (ws.currentSessionId) {
            const room = sessionRooms.get(ws.currentSessionId.toString());
            if (room) room.delete(ws);
            ws.currentSessionId = null;
            broadcastSessionList();
          }
        } else if (data.type === 'CREATE_SESSION') {
          if (!request.session.authenticated) return;
          const db = getDb();
          const { name } = data;
          const id = sessions.createSession(db, { name });
          ws.send(JSON.stringify({ type: 'SESSION_CREATED', id, name }));
          broadcastSessionList();
        } else if (data.type === 'UPDATE_SESSION') {
          if (!request.session.authenticated) return;
          const db = getDb();
          const { sessionId, name } = data;
          sessions.updateSession(db, sessionId, { name });
          broadcastSessionList();
        } else if (data.type === 'DELETE_SESSION') {
          if (!request.session.authenticated) return;
          const db = getDb();
          const { sessionId } = data;
          sessions.deleteSession(db, sessionId);
          broadcastToAll({ type: 'SESSION_DELETED', sessionId });
          broadcastSessionList();
        } else if (data.type === 'CREATE_NOTE') {
          if (!request.session.authenticated && !request.session.guestToken) return;
          const db = getDb();
          const { payload } = data;
          if (ws.currentSessionId) {
            // Block note creation if timer mode and timer not running
            const session = sessions.getSession(db, ws.currentSessionId);
            if (session && session.timestamp_mode === 'timer' && !session.started_at) {
              return ws.send(JSON.stringify({ type: 'ERROR', message: 'Timer is not running. Start the timer to add notes.' }));
            }
            notes.createNote(db, { ...payload, session_id: ws.currentSessionId });
            broadcastNoteUpdate(ws.currentSessionId);
          }
        } else if (data.type === 'UPDATE_NOTE') {
          if (!request.session.authenticated && !request.session.guestToken) return;
          const db = getDb();
          const { noteId, content } = data;
          if (ws.currentSessionId) {
            notes.updateNote(db, noteId, content);
            broadcastNoteUpdate(ws.currentSessionId);
          }
        } else if (data.type === 'DELETE_NOTE') {
          if (!request.session.authenticated && !request.session.guestToken) return;
          const db = getDb();
          const { noteId } = data;
          if (ws.currentSessionId) {
            notes.deleteNote(db, noteId);
            broadcastToRoom(ws.currentSessionId, { type: 'NOTE_DELETED', noteId, sessionId: ws.currentSessionId });
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (ws.currentSessionId) {
        const room = sessionRooms.get(ws.currentSessionId.toString());
        if (room) {
          room.delete(ws);
          if (room.size === 0) sessionRooms.delete(ws.currentSessionId.toString());
        }
        broadcastSessionList();
      }
    });
  });
}

// Health check
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

// Sessions API
app.post('/api/sessions', (req, res) => {
  try {
    const db = getDb();
    const { name, timestamp_mode, external_id } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Session name is required' });
    }
    const id = sessions.createSession(db, { name, timestamp_mode, external_id });
    broadcastSessionList();
    res.status(201).json({ id });
  } catch (error) {
    console.error('POST /api/sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bitfocus Companion Webhooks
app.post('/api/triggers', apiLimiter, checkApiTokenAuth, (req, res) => {
  console.log('--- Received Trigger Request ---');
  const { action, id, name } = req.body;
  console.log('Action:', action, 'ID:', id, 'Name:', name);

  try {
    const db = getDb();

    if (action === 'create') {
      if (!name) {
        return res.status(400).json({ error: 'Session name is required for create action' });
      }
      const newId = sessions.createSession(db, { name });
      broadcastSessionList();
      return res.status(201).json({ id: newId });
    }

    if (action === 'start') {
      if (!id) {
        return res.status(400).json({ error: 'Session ID is required for start action' });
      }
      const session = sessions.getSession(db, id);
      if (session) {
        sessions.updateSession(db, id, { 
          timestamp_mode: 'timer',
          started_at: new Date().toISOString(),
          stopped_at: null,
          status: 'active'
        });
        broadcastToRoom(id, { type: 'SESSION_STATUS_UPDATE', sessionId: id, status: 'active' });
        broadcastSessionList();
        return res.status(200).json({ status: 'started', id });
      }
      return res.status(404).json({ error: 'Session not found' });
    }

    if (action === 'stop') {
      if (!id) {
        return res.status(400).json({ error: 'Session ID is required for stop action' });
      }
      const session = sessions.getSession(db, id);
      if (session) {
        if (session.status !== 'active') {
          return res.status(400).json({ error: 'Session is not in active status' });
        }
        const startedAt = session.started_at ? new Date(session.started_at).getTime() : 0;
        const elapsedThisRun = startedAt ? Date.now() - startedAt : 0;
        const newElapsedMs = (session.elapsed_ms || 0) + elapsedThisRun;

        sessions.updateSession(db, id, { 
          timestamp_mode: 'timer',
          stopped_at: new Date().toISOString(),
          status: 'completed',
          elapsed_ms: newElapsedMs
        });
        broadcastToRoom(id, { type: 'SESSION_STATUS_UPDATE', sessionId: id, status: 'completed' });
        broadcastSessionList();
        return res.status(200).json({ status: 'stopped', id });
      }
      return res.status(404).json({ error: 'Session not found' });
    }

    if (action === 'add_note') {
      if (!id) {
        return res.status(400).json({ error: 'Session ID is required for add_note action' });
      }
      const { text } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Text is required for add_note action' });
      }
      const session = sessions.getSession(db, id);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      // Block note creation if timer mode and timer not running
      if (session.timestamp_mode === 'timer' && (!session.started_at || session.stopped_at)) {
        return res.status(400).json({ error: 'Timer is not running. Start the timer to add notes.' });
      }
      // Sanitize: trim whitespace
      const content = String(text).trim();
      if (!content) {
        return res.status(400).json({ error: 'Text cannot be empty after trimming' });
      }
      // Use current time as timestamp (UTC ms)
      const timestamp = Date.now();
      const noteId = notes.createNote(db, { content, timestamp, session_id: id });
      broadcastNoteUpdate(id);
      return res.status(201).json({ id: noteId, status: 'created' });
    }

    res.status(400).json({ error: `Invalid or missing action: ${action}` });
  } catch (error) {
    console.error('Companion Webhook Error:', error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/sessions', (req, res) => {
  try {
    const db = getDb();
    const list = sessions.listSessions(db);
    res.json(list);
  } catch (error) {
    console.error('GET /api/sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    res.json(session);
  } catch (error) {
    console.error('GET /api/sessions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/sessions/:id', (req, res) => {
  try {
    const db = getDb();
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Session name is required' });
    }
    const result = sessions.updateSession(db, req.params.id, { name });
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    broadcastSessionList();
    res.json({ status: 'updated' });
  } catch (error) {
    console.error('PATCH /api/sessions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sessions/:id', (req, res) => {
  try {
    const db = getDb();
    const result = sessions.deleteSession(db, req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }
    broadcastSessionList();
    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('DELETE /api/sessions/:id error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/guest-token', (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    let token = session.guest_token;
    if (!token) {
      token = crypto.randomUUID();
      sessions.updateSession(db, req.params.id, { guest_token: token });
    }
    res.json({ token });
  } catch (error) {
    console.error('POST /api/sessions/:id/guest-token error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Timer Control Endpoints
app.post('/api/sessions/:id/timer/start', (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const updates = {
      timestamp_mode: 'timer',
      started_at: new Date().toISOString(),
      stopped_at: null,
      elapsed_ms: 0,
      status: 'active'
    };
    sessions.updateSession(db, req.params.id, updates);

    const updated = sessions.getSession(db, req.params.id);
    broadcastToRoom(req.params.id, { type: 'SESSION_STATUS_UPDATE', sessionId: updated.id, status: 'active' });
    broadcastSessionList();
    broadcastToRoom(req.params.id, { type: 'SESSION_UPDATE', session: updated });
    res.json({ status: 'ok', session: updated });
  } catch (error) {
    console.error('POST /api/sessions/:id/timer/start error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/timer/stop', (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }
    if (!session.started_at) {
      return res.status(400).json({ error: 'Timer not started' });
    }

    const startedAt = new Date(session.started_at).getTime();
    const stoppedAt = Date.now();
    const elapsedThisRun = stoppedAt - startedAt;
    const newElapsedMs = (session.elapsed_ms || 0) + elapsedThisRun;

    sessions.updateSession(db, req.params.id, {
      stopped_at: new Date().toISOString(),
      status: 'completed',
      elapsed_ms: newElapsedMs
    });

    const updated = sessions.getSession(db, req.params.id);
    broadcastToRoom(req.params.id, { type: 'SESSION_STATUS_UPDATE', sessionId: updated.id, status: 'completed' });
    broadcastSessionList();
    broadcastToRoom(req.params.id, { type: 'SESSION_UPDATE', session: updated });
    res.json({ status: 'ok', session: updated });
  } catch (error) {
    console.error('POST /api/sessions/:id/timer/stop error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:id/timer/reset', (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check for notes
    const noteList = notes.listNotesBySession(db, req.params.id);
    if (noteList.length > 0) {
      return res.status(400).json({ error: 'Cannot reset timer — this session has notes. Delete all notes first.' });
    }

    sessions.updateSession(db, req.params.id, {
      started_at: null,
      stopped_at: null,
      elapsed_ms: 0,
      status: 'active'
    });

    const updated = sessions.getSession(db, req.params.id);
    broadcastToRoom(req.params.id, { type: 'SESSION_UPDATE', session: updated });
    broadcastSessionList();
    res.json({ status: 'ok', session: updated });
  } catch (error) {
    console.error('POST /api/sessions/:id/timer/reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Notes API
app.post('/api/sessions/:id/notes', (req, res) => {
  try {
    const db = getDb();
    const { content, timestamp, color, user_id } = req.body;
    const session_id = req.params.id;
    if (!content || !timestamp) {
      return res.status(400).json({ error: 'Content and timestamp are required' });
    }

    // Block note creation if timer mode and timer not running
    const session = sessions.getSession(db, session_id);
    if (session && session.timestamp_mode === 'timer' && !session.started_at) {
      return res.status(400).json({ error: 'Timer is not running. Start the timer to add notes.' });
    }

    const id = notes.createNote(db, { 
      content, 
      timestamp, 
      color, 
      user_id, 
      session_id 
    });
    broadcastNoteUpdate(session_id);
    res.status(201).json({ id });
  } catch (error) {
    console.error('POST /api/sessions/:id/notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/notes', (req, res) => {
  try {
    const db = getDb();
    const list = notes.listNotesBySession(db, req.params.id);
    res.json(list);
  } catch (error) {
    console.error('GET /api/sessions/:id/notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/sessions/:session_id/notes/:note_id', (req, res) => {
  try {
    const db = getDb();
    const { content } = req.body;
    const { note_id } = req.params;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const result = notes.updateNote(db, note_id, content);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    broadcastNoteUpdate(req.params.session_id);
    res.json({ status: 'updated' });
  } catch (error) {
    console.error('PATCH /api/sessions/:session_id/notes/:note_id error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sessions/:session_id/notes/:note_id', (req, res) => {
  try {
    const db = getDb();
    const result = notes.deleteNote(db, req.params.note_id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }
    broadcastNoteUpdate(req.params.session_id);
    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('DELETE /api/sessions/:session_id/notes/:note_id error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize the database immediately on startup so it's ready for first use

// Initialize the database immediately on startup so it's ready for first use
initDb();

if (process.env.NODE_ENV !== 'test') {
  const desiredPort = getPort();
  let server = null;

  function startServer(port) {
    return new Promise((resolve, reject) => {
      const s = app.listen(port, () => resolve(s));
      s.on('error', (err) => reject(err));
    });
  }

  (async () => {
    let port = desiredPort;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        server = await startServer(port);
        console.log(`\n✓ Recording Notes running at http://localhost:${port}`);
        if (authIsRequired()) {
          console.log('  Auth mode: Login required (RECNOTES_AUTH_USERNAME & RECNOTES_AUTH_PASSWORD set)');
        } else {
          console.warn('  Warning: No authorization configured. Do not use this setup in untrusted environments. See .env.example for details.');
        }
        const token = getApiToken();
        if (token) {
          if (wasApiTokenExplicitlySet()) {
            console.log(`  API token: ****${token.slice(-4)}`);
          } else {
            console.log(`  API token (auto-generated): ${token}`);
          }
        }
        // WebSocket setup (only after server is listening)
        setupWebSocket(server);

        // Store server reference for external access (e.g., tests)
        globalThis.__RECNOTES_SERVER_READY__ = true;

        break;
      } catch (err) {
        if (err.code === 'EADDRINUSE' && attempts < maxAttempts - 1) {
          console.warn(`  Port ${port} is in use, trying ${port + 1}...`);
          port++;
          attempts++;
        } else {
          console.error(`  Failed to start server on port ${port}: ${err.message}`);
          console.error('  Set RECNOTES_PORT to a different port and try again.');
          process.exit(1);
        }
      }
    }
  })();
}

export { app, wss, setupWebSocket, broadcastToAll, broadcastToRoom, broadcastSessionList };
export default app;
