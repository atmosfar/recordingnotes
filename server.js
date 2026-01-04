import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import * as sessions from './sessions.js';

const app = express();
const port = process.env.PORT || 3000;
const dbPath = join(process.cwd(), 'dev.db');
const db = new DatabaseSync(dbPath);

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Recording Notes API - Barebones Prototype');
});

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
