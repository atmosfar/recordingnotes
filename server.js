import express from 'express';
import { getDb, initDb } from './db.js';
import * as sessions from './sessions.js';
import * as notes from './notes.js';

const app = express();
const port = process.env.PORT || 3000;

// Initialize database
initDb();
const db = getDb();

app.use(express.json());
app.use(express.static('public'));

// Health check or API status
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', database: process.env.DB_PATH || 'dev.db' });
});

// Sessions API
app.post('/api/sessions', (req, res) => {
  try {
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
  try {
    const { name, sessionID, sessionTitle } = req.body;
    
    if (name === 'recording_session.created') {
      const id = sessions.createSession(db, { 
        name: sessionTitle || 'Untitled SquadCast Session', 
        external_id: sessionID 
      });
      return res.status(201).json({ id });
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

    res.status(400).json({ error: 'Unsupported event' });
  } catch (error) {
    console.error('SquadCast Webhook Error:', error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/sessions', (req, res) => {
  try {
    const list = sessions.listSessions(db);
    res.json(list);
  } catch (error) {
    console.error('GET /api/sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id', (req, res) => {
  try {
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
    const list = notes.listNotesBySession(db, req.params.id);
    res.json(list);
  } catch (error) {
    console.error('GET /api/sessions/:id/notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions/:id/export', (req, res) => {
  try {
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
      // Format: #,Name,Start,End,Length,Color
      csv += `${marker},${name},${note.timestamp},,,${color}\n`;
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

export { app, db };
export default app;
