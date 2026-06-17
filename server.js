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
import triggersRoutes from './routes/triggers.js';
import sessionsRoutes from './routes/sessions.js';
import timerRoutes from './routes/timer.js';
import notesRoutes from './routes/notes.js';

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
app.use('/api/triggers', triggersRoutes);

// Protect all following API routes
app.use(checkAuth);
app.get('/api/status', (req, res) => res.json({ status: 'ok' }));
app.use('/api/sessions', sessionsRoutes);
app.use('/api/sessions', timerRoutes);
app.use('/api/sessions', notesRoutes);
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

export { app, wss, setupWebSocket, broadcastToAll, broadcastToRoom, broadcastSessionList, broadcastNoteUpdate };
export default app;
