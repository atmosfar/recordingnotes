import { Router } from 'express';
import { getDb } from '../db.js';
import * as sessions from '../sessions.js';
import * as notes from '../notes.js';
import { broadcastNoteUpdate } from '../websocket/index.js';

const router = Router();

router.post('/:id/notes', async (req, res) => {
  try {
    const db = getDb();
    const { content, timestamp, color, user_id } = req.body;
    const session_id = req.params.id;
    if (!content || !timestamp) {
      return res.status(400).json({ error: 'Content and timestamp are required' });
    }

    // Block note creation if timer mode and timer not running
    const session = sessions.getSession(db, session_id);
    if (session && session.timestamp_mode === 'timer' && !session.started_at) {
      return res.status(400).json({ error: 'Timer is not running. Start the timer to add notes.' });
    }

    // Use client-provided timer_position_ms if available (frozen at draft capture time).
    // Fall back to server-side calculation for non-draft notes (e.g. API calls).
    let timerPositionMs = req.body.timer_position_ms ?? null;
    if (timerPositionMs == null && session && session.timestamp_mode === 'timer' && session.started_at) {
      const sessionStartMs = new Date(session.started_at).getTime();
      const elapsedMs = session.elapsed_ms || 0;
      timerPositionMs = elapsedMs + (timestamp - sessionStartMs);
    }
    const id = notes.createNote(db, {
      content,
      timestamp,
      color,
      user_id,
      session_id,
      timer_position_ms: timerPositionMs
    });
    broadcastNoteUpdate(session_id);
    res.status(201).json({ id });
  } catch (error) {
    console.error('POST /api/sessions/:id/notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/notes', (req, res) => {
  try {
    const db = getDb();
    const list = notes.listNotesBySession(db, req.params.id);
    res.json(list);
  } catch (error) {
    console.error('GET /api/sessions/:id/notes error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.patch('/:session_id/notes/:note_id', async (req, res) => {
  try {
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

router.delete('/:session_id/notes/:note_id', async (req, res) => {
  try {
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

export default router;
