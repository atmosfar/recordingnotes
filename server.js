import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import * as sessions from './sessions.js';
import * as notes from './notes.js';

const app = express();
const port = process.env.PORT || 3000;
const dbPath = join(process.cwd(), 'dev.db');
const db = new DatabaseSync(dbPath);

app.use(express.json());
app.use(express.static('public'));

// Sessions API
app.post('/api/sessions', (req, res) => {
  try {
    const { name, timestamp_mode } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Session name is required' });
    }
    const id = sessions.createSession(db, { name, timestamp_mode });
    res.status(201).json({ id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sessions', (req, res) => {
  try {
    const list = sessions.listSessions(db);
    res.json(list);
  } catch (error) {
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
      // Format: #,Name,Start,End,Length,Color
      csv += `${marker},${name},${note.timestamp},,,${note.color || ''}\n`;
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

// Health check or API status
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', database: dbPath });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

export { app, db };
export default app;
