import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import * as sessions from '../sessions.js';
import { broadcastSessionList } from '../websocket/index.js';

const router = Router();

router.post('/', async (req, res) => {
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

router.get('/', (req, res) => {
  try {
    const db = getDb();
    const list = sessions.listSessions(db);
    res.json(list);
  } catch (error) {
    console.error('GET /api/sessions error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', (req, res) => {
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

router.patch('/:id', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
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

router.post('/:id/guest-token', async (req, res) => {
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

export default router;
