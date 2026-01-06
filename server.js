import express from 'express';
import { getDb, initDb } from './db.js';
import * as sessions from './sessions.js';
import * as notes from './notes.js';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));

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
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

export { app };
export default app;
