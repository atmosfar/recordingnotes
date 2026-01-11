import express from 'express';
import { WebSocketServer } from 'ws';
import { getDb, initDb } from './db.js';
import * as sessions from './sessions.js';
import * as notes from './notes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
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
        broadcastToAll({ type: 'SESSION_LIST_UPDATE' });
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
      broadcastToAll({ type: 'SESSION_LIST_UPDATE' });
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
    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('DELETE /api/sessions/:session_id/notes/:note_id error:', error);
    res.status(500).json({ error: error.message });
  }
});

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
    
    let csv = '#,Name,Start,End,Length,Color\n';
    list.forEach((note, index) => {
      const name = `"${note.content.replace(/"/g, '""')}"`;
      const marker = `M${index + 1}`;
      const color = note.color ? note.color.replace('#', '').toUpperCase() : '';
      const timestamp = formatDuration(note.timestamp);
      // Format: #,Name,Start,End,Length,Color
      csv += `${marker},${name},${timestamp},,,${color}\n`;
    });

    const sanitizedName = session.name.trim().replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/gi, '') || `session-${req.params.id}`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedName}.csv"`);
    res.send(csv);
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
          broadcastToAll({ type: 'SESSION_LIST_UPDATE' });
        } else if (data.type === 'UPDATE_SESSION') {
          initDb();
          const db = getDb();
          const { sessionId, name } = data;
          sessions.updateSession(db, sessionId, { name });
          broadcastToAll({ type: 'SESSION_LIST_UPDATE' });
        } else if (data.type === 'DELETE_SESSION') {
          initDb();
          const db = getDb();
          const { sessionId } = data;
          sessions.deleteSession(db, sessionId);
          broadcastToAll({ type: 'SESSION_DELETED', sessionId });
          broadcastToAll({ type: 'SESSION_LIST_UPDATE' });
        } else if (data.type === 'CREATE_NOTE') {
          initDb();
          const db = getDb();
          const { payload } = data;
          if (ws.currentSessionId) {
            notes.createNote(db, { ...payload, session_id: ws.currentSessionId });
            broadcastToRoom(ws.currentSessionId, { type: 'NOTE_UPDATE', sessionId: ws.currentSessionId });
          }
        } else if (data.type === 'UPDATE_NOTE') {
          initDb();
          const db = getDb();
          const { noteId, content } = data;
          notes.updateNote(db, noteId, content);
          if (ws.currentSessionId) {
            broadcastToRoom(ws.currentSessionId, { type: 'NOTE_UPDATE', sessionId: ws.currentSessionId });
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

export { app, wss, broadcastToAll, broadcastToRoom };
export default app;
