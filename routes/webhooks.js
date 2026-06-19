import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { getDb } from '../services/db.js';
import * as sessions from '../services/sessions.js';
import { checkApiTokenAuth } from '../middleware/auth.js';
import { broadcastSessionList, broadcastToRoom } from '../websocket/index.js';

const router = Router();
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

router.post('/squadcast/:token', apiLimiter, checkApiTokenAuth, (req, res) => {
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
        const startedAt = session.started_at ? new Date(session.started_at).getTime() : 0;
        const elapsedThisRun = startedAt ? Date.now() - startedAt : 0;
        const newElapsedMs = (session.elapsed_ms || 0) + elapsedThisRun;

        sessions.updateSession(db, session.id, { 
          stopped_at: new Date().toISOString(),
          status: 'completed',
          elapsed_ms: newElapsedMs
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

export default router;
