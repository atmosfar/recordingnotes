import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db.js';
import * as sessions from '../sessions.js';
import * as notes from '../notes.js';
import { checkApiTokenAuth } from '../middleware/auth.js';

const router = Router();
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Broadcast functions are imported from server.js (circular but safe -
// only called at request time, not during module evaluation).
// Will be cleaned up in Step 10 when WebSocket is extracted.
let _broadcastSessionList, _broadcastToRoom, _broadcastNoteUpdate;

async function getBroadcasts() {
  if (!_broadcastSessionList) {
    const server = await import('../server.js');
    _broadcastSessionList = server.broadcastSessionList;
    _broadcastToRoom = server.broadcastToRoom;
    _broadcastNoteUpdate = server.broadcastNoteUpdate;
  }
  return { broadcastSessionList: _broadcastSessionList, broadcastToRoom: _broadcastToRoom, broadcastNoteUpdate: _broadcastNoteUpdate };
}

router.post('/', apiLimiter, checkApiTokenAuth, async (req, res) => {
  console.log('--- Received Trigger Request ---');
  const { action, id, name } = req.body;
  console.log('Action:', action, 'ID:', id, 'Name:', name);

  try {
    const db = getDb();
    const { broadcastSessionList, broadcastToRoom, broadcastNoteUpdate } = await getBroadcasts();

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

export default router;
