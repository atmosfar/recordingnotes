import express from 'express';
import session from 'express-session';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { getConfig } from './config.js';
import { getDb, initDb } from './db.js';
import * as sessions from './sessions.js';
import * as notes from './notes.js';

const app = express();

// Lazy config accessors – read fresh on each call so env var changes are picked up
function getPort() {
  return Number(getConfig().RECNOTES_PORT) || 3000;
}

function getApiToken() {
  const config = getConfig();
  let token = config.RECNOTES_AUTH_API_TOKEN;
  if (!token) {
    const username = config.RECNOTES_AUTH_USERNAME;
    const password = config.RECNOTES_AUTH_PASSWORD;
    if (username && password) {
      token = crypto
        .createHash('sha256')
        .update(`${username}:${password}`)
        .digest('hex');
    }
  }
  return token;
}

function wasApiTokenExplicitlySet() {
  return !!getConfig().RECNOTES_AUTH_API_TOKEN;
}

function getAuthCredentials() {
  const config = getConfig();
  return {
    username: config.RECNOTES_AUTH_USERNAME,
    password: config.RECNOTES_AUTH_PASSWORD,
  };
}

function authIsRequired() {
  const config = getConfig();
  return !!(config.RECNOTES_AUTH_USERNAME && config.RECNOTES_AUTH_PASSWORD);
}

function getSessionSecret() {
  return getConfig().RECNOTES_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
}

function getExportTimezone() {
  return getConfig().RECNOTES_EXPORT_TIMEZONE || 'UTC';
}

app.use(express.json());

// Trust the reverse proxy's X-Forwarded-Proto header so Express knows when HTTPS is in use.
// This enables secure: 'auto' on session cookies to work correctly behind nginx/cloudflare/etc.
app.set('trust proxy', 1);

// Rate limiting to prevent brute-force attacks
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Auth is only required if both env vars are explicitly set.
// Otherwise the app runs in open/public mode (no login needed).
// Checked dynamically per-request so env changes are picked up.
function authRequired() {
  return authIsRequired();
}

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

/**
 * Middleware to check user authentication
 */
function checkAuth(req, res, next) {
  // If auth is not configured, run in open/public mode — everyone is "authenticated"
  if (!authRequired()) {
    req.session.authenticated = true;
    return next();
  }

  // Allow access to login page and its related API
  if (req.path === '/login' || req.path === '/api/login') {
    return next();
  }

  // Exempt integrations from session auth (they use token auth)
  if (req.path.startsWith('/api/webhooks/') || req.path.startsWith('/api/triggers')) {
    return next();
  }

  // If a token is provided in query, try to verify and "login" as guest
  if (req.query.token) {
    const db = getDb();
    const session = sessions.getSessionByGuestToken(db, req.query.token);
    if (session) {
      req.session.guestToken = req.query.token;
      return next();
    }
  }

  if ((req.session && req.session.authenticated) || (req.session && req.session.guestToken)) {
    return next();
  }

  // If it's an API call, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Otherwise redirect to login
  res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
}

/**
 * Middleware to check API token
 */
function checkApiTokenAuth(req, res, next) {
  const validToken = getApiToken();

  // If no API token is configured, endpoints are public
  if (!validToken) {
    return next();
  }

  const token = req.params.token || req.query.token || req.headers['x-auth-token'];

  if (token && token.length === validToken.length && crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(validToken)
  )) {
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
}

// Auth Routes
app.get('/login', (req, res) => {
  // If auth is not configured, redirect to the main app
  if (!authRequired()) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  const { username: validUser, password: validPass } = getAuthCredentials();

  if (validUser && validPass && username === validUser && password === validPass) {
    req.session.authenticated = true;
    res.json({ status: 'ok' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// Protect all following routes
app.use(checkAuth);

app.use(express.static(path.join(__dirname, 'public')));

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

// SquadCast Webhooks
app.post('/api/webhooks/squadcast/:token', apiLimiter, checkApiTokenAuth, (req, res) => {
  console.log('--- Received SquadCast Webhook ---');
  console.log('Event Name:', req.body.name);
  console.log('Payload:', JSON.stringify(req.body, null, 2));
  
  try {
    const db = getDb();
    const { name, sessionID, sessionTitle } = req.body;
    
    if (name === 'recording_session.created' || name === 'participant.joined') {
      const existing = sessions.getSessionByExternalId(db, sessionID);
      if (!existing) {
        const id = sessions.createSession(db, {
          name: sessionTitle || 'Untitled SquadCast Session',
          external_id: sessionID,
          timestamp_mode: 'timer'
        });
        broadcastSessionList();
        return res.status(201).json({ id, status: 'created' });
      }
      return res.status(200).json({ id: existing.id, status: 'already_exists' });
    }

    if (name === 'recording.started') {
      const session = sessions.getSessionByExternalId(db, sessionID);
      if (session) {
        sessions.updateSession(db, session.id, { 
          started_at: new Date().toISOString(),
          stopped_at: null,
          status: 'active'
        });
        broadcastToRoom(session.id, { type: 'SESSION_STATUS_UPDATE', sessionId: session.id, status: 'active' });
        broadcastSessionList();
        return res.status(200).json({ status: 'started' });
      }
      return res.status(404).json({ error: 'Session not found' });
    }

    if (name === 'recording.stopped') {
      const session = sessions.getSessionByExternalId(db, sessionID);
      if (session) {
        sessions.updateSession(db, session.id, { 
          stopped_at: new Date().toISOString(),
          status: 'completed'
        });
        broadcastToRoom(session.id, { type: 'SESSION_STATUS_UPDATE', sessionId: session.id, status: 'completed' });
        broadcastSessionList();
        return res.status(200).json({ status: 'stopped' });
      }
      return res.status(404).json({ error: 'Session not found' });
    }

    // For any other events we don't handle yet, return 200 to prevent retries
    res.status(200).json({ status: 'ignored', message: `Unsupported event: ${name}` });
  } catch (error) {
    console.error('SquadCast Webhook Error:', error);
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
        sessions.updateSession(db, id, { 
          stopped_at: new Date().toISOString(),
          status: 'completed'
        });
        broadcastToRoom(id, { type: 'SESSION_STATUS_UPDATE', sessionId: id, status: 'completed' });
        broadcastSessionList();
        return res.status(200).json({ status: 'stopped', id });
      }
      return res.status(404).json({ error: 'Session not found' });
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

// Notes API
app.post('/api/sessions/:id/notes', (req, res) => {
  try {
    const db = getDb();
    const { content, timestamp, color, user_id } = req.body;
    const session_id = req.params.id;
    if (!content || !timestamp) {
      return res.status(400).json({ error: 'Content and timestamp are required' });
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

const FRAMERATES = {
  '23.976': 24000/1001,
  '24': 24,
  '25': 25,
  '29.97DF': 30000/1001,
  '29.97NDF': 30000/1001,
  '30': 30
};

/**
 * Converts seconds to SMPTE timecode (HH:MM:SS:FF or HH:MM:SS;FF)
 * @param {number} totalSeconds 
 * @param {number} frameRate 
 * @param {boolean} isDfMode 
 * @returns {string}
 */
function timeToHmsf(totalSeconds, frameRate, isDfMode) {
  const nominalFps = Math.floor(frameRate + 0.5);
  let hh, mm, ss, ff;

  if (isDfMode) {
    // SMPTE 12M Drop Frame Formula using 30 fps nominal
    let totalFrames = Math.floor(totalSeconds * nominalFps);
    // 2 frames are dropped per minute which isn't a multiple of 10
    // Ten minutes is 10 * 60 * 30 fps - (18*2) = 17982 frames
    const dropFrames = (2 * Math.floor((totalFrames % 17982) / 1798.2)) + (18 * Math.floor(totalFrames / 17982));
    totalFrames += dropFrames;
    
    ff = totalFrames % 30;
    ss = Math.floor(totalFrames / 30) % 60;
    mm = Math.floor(totalFrames / 1800) % 60;
    hh = Math.floor(totalFrames / 108000) % 24;
  } else {
    const totalFrames = Math.floor(totalSeconds * frameRate + 0.0001);
    ff = totalFrames % nominalFps;
    ss = Math.floor(totalFrames / nominalFps) % 60;
    mm = Math.floor(totalFrames / (nominalFps * 60)) % 60;
    hh = Math.floor(totalFrames / (nominalFps * 3600)) % 24;
  }

  const separator = isDfMode ? ';' : ':';
  return [
    hh.toString().padStart(2, '0'),
    mm.toString().padStart(2, '0'),
    ss.toString().padStart(2, '0')
  ].join(':') + separator + ff.toString().padStart(2, '0');
}

/**
 * Maps hex colors to Resolve-compatible color strings
 * @param {string} hex 
 * @returns {string}
 */
function mapColorToResolve(hex) {
  const colorMap = {
    '#FF4D4D': 'Red',
    '#2ECC71': 'Green',
    '#3498DB': 'Blue',
    '#F1C40F': 'Yellow'
  };
  const upperHex = (hex || '').toUpperCase();
  return colorMap[upperHex] || 'Blue';
}

/**
 * Formats duration in seconds to HH:MM:SS.mmm
 * @param {number} seconds 
 * @returns {string}
 */
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [
    hrs.toString().padStart(2, '0'),
    mins.toString().padStart(2, '0'),
    secs.toFixed(3).padStart(6, '0')
  ].join(':');
}

app.get('/api/sessions/:id/export', (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    const list = notes.listNotesBySession(db, req.params.id);
    const format = req.query.format || 'reaper';
    
    let content = '';
    let contentType = 'text/csv';
    let extension = 'csv';

    // Helper: convert timestamp_ms to seconds-since-midnight in the configured export timezone
    function timestampToSeconds(note) {
      const ts = note.timestamp_ms;
      if (session.timestamp_mode === 'timer') {
        // Timer mode: elapsed seconds from session start
        const sessionStartMs = session.started_at ? new Date(session.started_at).getTime() : 0;
        return (ts - sessionStartMs) / 1000;
      } else {
        // Clock mode: convert UTC ms to seconds-since-midnight
        // (IANA timezone from RECNOTES_EXPORT_TIMEZONE, defaults to UTC)
        const exportTimezone = getExportTimezone();
        const parts = new Intl.DateTimeFormat('en-GB', {
          timeZone: exportTimezone,
          hour: 'numeric', hour12: false,
          minute: 'numeric',
          second: 'numeric',
          fractionalSecondDigits: 3
        }).formatToParts(ts);

        const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
        const hrs = get('hour');
        const mins = get('minute');
        const secs = get('second');
        // fractionalSeconds from Intl may not be supported everywhere, fallback to ms
        const ms = Math.round(ts % 1000);
        return (hrs * 3600) + (mins * 60) + secs + ms / 1000;
      }
    }

    if (format === 'edl') {
      const fpsKey = req.query.fps || '23.976';
      const frameRate = FRAMERATES[fpsKey] || FRAMERATES['23.976'];
      const isDfMode = fpsKey.includes('DF');
      
      content = `TITLE: ${session.name.substring(0, 255)}\n`;
      content += `FCM: ${isDfMode ? 'DROP FRAME' : 'NON-DROP FRAME'}\n\n`;
      
      list.forEach((note, index) => {
        const entryNum = (index + 1).toString().padStart(3, '0');
        const color = mapColorToResolve(note.color);
        const seconds = timestampToSeconds(note);
        const startTimecode = timeToHmsf(seconds, frameRate, isDfMode);
        
        // Calculate end timecode (start + 1 frame)
        const endTimecode = timeToHmsf(seconds + (1 / frameRate), frameRate, isDfMode);
        
        // Format: EntryNum  SourceID  V  C  StartTC EndTC StartTC EndTC
        // SourceID is usually 001 for markers
        content += `${entryNum}  001      V     C        ${startTimecode} ${endTimecode} ${startTimecode} ${endTimecode}  \n`;
        content += ` |C:ResolveColor${color} |M:${note.content.replace(/[|]/g, '')} |D:1\n\n`;
      });
      
      contentType = 'text/plain';
      extension = 'edl';
    } else if (format === 'audition') {
      content = 'Name\tStart\tDuration\tTime Format\tType\tDescription\n';
      list.forEach((note) => {
        const name = note.content.replace(/"/g, '""');
        const seconds = timestampToSeconds(note);
        const start = formatDuration(seconds);
        const duration = '0:00.000';
        // Format: Name <tab> Start <tab> Duration <tab> decimal <tab> Cue <tab> Description
        content += `${name}\t${start}\t${duration}\tdecimal\tCue\t\n`;
      });
    } else {
      // Default to REAPER
      content = '#,Name,Start,End,Length,Color\n';
      list.forEach((note, index) => {
        const name = `"${note.content.replace(/"/g, '""')}"`;
        const marker = `M${index + 1}`;
        const color = note.color ? note.color.replace('#', '').toUpperCase() : '';
        const seconds = timestampToSeconds(note);
        const timestamp = formatDuration(seconds);
        // Format: #,Name,Start,End,Length,Color
        content += `${marker},${name},${timestamp},,,${color}\n`;
      });
    }

    const sanitizedName = session.name.trim().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/gi, '') || `session-${req.params.id}`;
    const filename = `${sanitizedName}_${format}.${extension}`;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('GET /api/sessions/:id/export error:', error);
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
        if (authRequired()) {
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
        wss = new WebSocketServer({ noServer: true });

        server.on('upgrade', (request, socket, head) => {
          sessionParser(request, {}, () => {
            const url = new URL(request.url, `http://${request.headers.host}`);
            const queryToken = url.searchParams.get('token');
            
            const isGuest = queryToken || (request.session && request.session.guestToken);

            // In open/public mode (no auth configured), skip the check
            if (authRequired() && !request.session.authenticated && !isGuest) {
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
              socket.destroy();
              return;
            }

            // Auto-authenticate in open mode
            if (!authRequired()) {
              request.session.authenticated = true;
            }

            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit('connection', ws, request);
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

export { app, wss, broadcastToAll, broadcastToRoom, timeToHmsf, mapColorToResolve };
export default app;
