import { Router } from 'express';
import { getDb } from '../db.js';
import * as sessions from '../sessions.js';
import * as notes from '../notes.js';
import { broadcastToRoom, broadcastSessionList } from '../websocket/index.js';

const router = Router();

router.post('/:id/timer/start', async (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    console.log('[DEBUG timer/start] Before update:', {
      id: session.id,
      name: session.name,
      timestamp_mode: session.timestamp_mode,
      elapsed_ms: session.elapsed_ms,
      started_at: session.started_at,
      stopped_at: session.stopped_at,
      status: session.status,
    });

    const updates = {
      timestamp_mode: 'timer',
      started_at: new Date().toISOString(),
      stopped_at: null,
      status: 'active'
    };
    sessions.updateSession(db, req.params.id, updates);

    const updated = sessions.getSession(db, req.params.id);
    console.log('[DEBUG timer/start] After update:', {
      id: updated.id,
      timestamp_mode: updated.timestamp_mode,
      elapsed_ms: updated.elapsed_ms,
      started_at: updated.started_at,
      stopped_at: updated.stopped_at,
      status: updated.status,
    });
    broadcastToRoom(req.params.id, { type: 'SESSION_STATUS_UPDATE', sessionId: updated.id, status: 'active' });
    broadcastSessionList();
    broadcastToRoom(req.params.id, { type: 'SESSION_UPDATE', session: updated });
    res.json({ status: 'ok', session: updated });
  } catch (error) {
    console.error('POST /api/sessions/:id/timer/start error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/timer/stop', async (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.status !== 'active') {
      return res.status(400).json({ error: 'Session is not active' });
    }
    if (!session.started_at) {
      return res.status(400).json({ error: 'Timer not started' });
    }

    const startedAt = new Date(session.started_at).getTime();
    const stoppedAt = Date.now();
    const elapsedThisRun = stoppedAt - startedAt;
    const newElapsedMs = (session.elapsed_ms || 0) + elapsedThisRun;

    sessions.updateSession(db, req.params.id, {
      stopped_at: new Date().toISOString(),
      status: 'completed',
      elapsed_ms: newElapsedMs
    });

    const updated = sessions.getSession(db, req.params.id);
    broadcastToRoom(req.params.id, { type: 'SESSION_STATUS_UPDATE', sessionId: updated.id, status: 'completed' });
    broadcastSessionList();
    broadcastToRoom(req.params.id, { type: 'SESSION_UPDATE', session: updated });
    res.json({ status: 'ok', session: updated });
  } catch (error) {
    console.error('POST /api/sessions/:id/timer/stop error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/timer/reset', async (req, res) => {
  try {
    const db = getDb();
    const session = sessions.getSession(db, req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check for notes
    const noteList = notes.listNotesBySession(db, req.params.id);
    if (noteList.length > 0) {
      return res.status(400).json({ error: 'Cannot reset timer — this session has notes. Delete all notes first.' });
    }

    sessions.updateSession(db, req.params.id, {
      started_at: null,
      stopped_at: null,
      elapsed_ms: 0,
      status: 'active'
    });

    const updated = sessions.getSession(db, req.params.id);
    broadcastToRoom(req.params.id, { type: 'SESSION_UPDATE', session: updated });
    broadcastSessionList();
    res.json({ status: 'ok', session: updated });
  } catch (error) {
    console.error('POST /api/sessions/:id/timer/reset error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
