import express from 'express';
import session from 'express-session';
import { WebSocketServer } from 'ws';
import { getDb, initDb } from './db.js';
import * as sessions from './sessions.js';
import * as notes from './notes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret_for_dev_only',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

/**
 * Middleware to check user authentication
 */
function checkAuth(req, res, next) {
  // Allow access to login page and its related API
  if (req.path === '/login' || req.path === '/api/login') {
    return next();
  }

  if (req.session && req.session.authenticated) {
    return next();
  }

  // If it's an API call, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Otherwise redirect to login
  res.redirect('/login');
}

// Auth Routes
app.get('/login', (req, res) => {
  // We'll serve login.html from the public folder, but it needs to be accessible
  // So we don't apply checkAuth to the static middleware if we want to serve it simply,
  // or we handle it explicitly.
  res.sendFile(process.cwd() + '/public/login.html');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.AUTH_USERNAME || 'admin';
  const validPass = process.env.AUTH_PASSWORD || 'password123';

  if (username === validUser && password === validPass) {
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

app.use(express.static('public'));

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
  initDb();
  const db = getDb();
  const list = sessions.listSessions(db);
  broadcastToAll({ type: 'SESSION_LIST_UPDATE', sessions: list });
}

function broadcastNoteUpdate(sessionId) {
  initDb();
  const db = getDb();
  const list = notes.listNotesBySession(db, sessionId);
  broadcastToRoom(sessionId, { type: 'NOTE_UPDATE', sessionId, notes: list });
}

// Health check or API status
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', database: process.env.DB_PATH || 'dev.db' });
});

// Sessions API
app.post('/api/sessions', (req, res) => {
  try {
    initDb();
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
app.post('/api/webhooks/squadcast', (req, res) => {
  console.log('--- Received SquadCast Webhook ---');
  console.log('Event Name:', req.body.name);
  console.log('Payload:', JSON.stringify(req.body, null, 2));
  
  try {
    initDb();
    const db = getDb();
    const { name, sessionID, sessionTitle } = req.body;
    
    if (name === 'recording_session.created' || name === 'participant.joined') {
      const existing = sessions.getSessionByExternalId(db, sessionID);
      if (!existing) {
        const id = sessions.createSession(db, { 
          name: sessionTitle || 'Untitled SquadCast Session', 
          external_id: sessionID 
        });
        broadcastSessionList();
        return res.status(201).json({ id, status: 'created_via_workaround' });
      }
      return res.status(200).json({ id: existing.id, status: 'already_exists' });
    }

    if (name === 'recording.started') {
      const session = sessions.getSessionByExternalId(db, sessionID);
      if (session) {
        sessions.updateSession(db, session.id, { 
          started_at: new Date().toISOString(),
          status: 'active'
        });
        broadcastToRoom(session.id, { type: 'SESSION_STATUS_UPDATE', sessionId: session.id, status: 'active' });
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
app.post('/api/webhooks/companion', (req, res) => {
  console.log('--- Received Companion Webhook ---');
  const { action, id, name } = req.body;
  console.log('Action:', action, 'ID:', id, 'Name:', name);

  try {
    initDb();
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
          status: 'active'
        });
        broadcastToRoom(id, { type: 'SESSION_STATUS_UPDATE', sessionId: id, status: 'active' });
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
    initDb();
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
    initDb();
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
    initDb();
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
    initDb();
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

// Notes API
app.post('/api/sessions/:id/notes', (req, res) => {
  try {
    initDb();
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
    initDb();
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
    initDb();
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
    initDb();
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
    initDb();
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

    if (format === 'edl') {
      const fpsKey = req.query.fps || '23.976';
      const frameRate = FRAMERATES[fpsKey] || FRAMERATES['23.976'];
      const isDfMode = fpsKey.includes('DF');
      
      content = `TITLE: ${session.name.substring(0, 255)}\n`;
      content += `FCM: ${isDfMode ? 'DROP FRAME' : 'NON-DROP FRAME'}\n\n`;
      
      list.forEach((note, index) => {
        const entryNum = (index + 1).toString().padStart(3, '0');
        const color = mapColorToResolve(note.color);
        const startTimecode = timeToHmsf(note.timestamp, frameRate, isDfMode);
        
        // Calculate end timecode (start + 1 frame)
        const endTimecode = timeToHmsf(note.timestamp + (1 / frameRate), frameRate, isDfMode);
        
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
        const start = formatDuration(note.timestamp);
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
        const timestamp = formatDuration(note.timestamp);
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

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });

  wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    ws.currentSessionId = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'JOIN_SESSION') {
          const { sessionId } = data;
          if (ws.currentSessionId) {
            // Leave previous room
            const oldRoom = sessionRooms.get(ws.currentSessionId.toString());
            if (oldRoom) oldRoom.delete(ws);
          }
          
          ws.currentSessionId = sessionId;
          if (!sessionRooms.has(sessionId.toString())) {
            sessionRooms.set(sessionId.toString(), new Set());
          }
          sessionRooms.get(sessionId.toString()).add(ws);

          // PUSH: Send current session and notes to the joining client
          initDb();
          const db = getDb();
          const session = sessions.getSession(db, sessionId);
          if (session) {
            const list = notes.listNotesBySession(db, sessionId);
            ws.send(JSON.stringify({ 
              type: 'SESSION_DATA', 
              session, 
              notes: list 
            }));
          } else {
            ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found', code: 404 }));
          }
        } else if (data.type === 'GET_SESSIONS') {
          initDb();
          const db = getDb();
          const list = sessions.listSessions(db);
          ws.send(JSON.stringify({ type: 'SESSION_LIST_UPDATE', sessions: list }));
        } else if (data.type === 'LEAVE_SESSION') {
          if (ws.currentSessionId) {
            const room = sessionRooms.get(ws.currentSessionId.toString());
            if (room) room.delete(ws);
            ws.currentSessionId = null;
          }
        } else if (data.type === 'CREATE_SESSION') {
          initDb();
          const db = getDb();
          const { name } = data;
          const id = sessions.createSession(db, { name });
          ws.send(JSON.stringify({ type: 'SESSION_CREATED', id, name }));
          broadcastSessionList();
        } else if (data.type === 'UPDATE_SESSION') {
          initDb();
          const db = getDb();
          const { sessionId, name } = data;
          sessions.updateSession(db, sessionId, { name });
          broadcastSessionList();
        } else if (data.type === 'DELETE_SESSION') {
          initDb();
          const db = getDb();
          const { sessionId } = data;
          sessions.deleteSession(db, sessionId);
          broadcastToAll({ type: 'SESSION_DELETED', sessionId });
          broadcastSessionList();
        } else if (data.type === 'CREATE_NOTE') {
          initDb();
          const db = getDb();
          const { payload } = data;
          if (ws.currentSessionId) {
            notes.createNote(db, { ...payload, session_id: ws.currentSessionId });
            broadcastNoteUpdate(ws.currentSessionId);
          }
        } else if (data.type === 'UPDATE_NOTE') {
          initDb();
          const db = getDb();
          const { noteId, content } = data;
          notes.updateNote(db, noteId, content);
          if (ws.currentSessionId) {
            broadcastNoteUpdate(ws.currentSessionId);
          }
        } else if (data.type === 'DELETE_NOTE') {
          initDb();
          const db = getDb();
          const { noteId } = data;
          notes.deleteNote(db, noteId);
          if (ws.currentSessionId) {
            broadcastToRoom(ws.currentSessionId, { type: 'NOTE_DELETED', noteId });
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
      }
    });
  });
}

export { app, wss, broadcastToAll, broadcastToRoom, timeToHmsf, mapColorToResolve };
export default app;
