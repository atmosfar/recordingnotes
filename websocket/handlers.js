import { getDb } from '../db.js';
import * as sessions from '../sessions.js';
import * as notes from '../notes.js';
import { authIsRequired } from '../middleware/config-accessors.js';

export function handleMessage(ws, request, data, sessionRooms, broadcastSessionList, broadcastNoteUpdate, broadcastToRoom, broadcastToAll) {
  if (data.type === 'JOIN_SESSION') {
    const { sessionId, guestToken } = data;
    let session = null;
    const db = getDb();

    const effectiveToken = guestToken || request.session.guestToken;

    if (request.session.authenticated && sessionId) {
      session = sessions.getSession(db, sessionId);
    } else if (effectiveToken) {
      session = sessions.getSessionByGuestToken(db, effectiveToken);
    }

    if (!session) {
      return ws.send(JSON.stringify({ type: 'ERROR', message: 'Session not found or unauthorized', code: 404 }));
    }

    const resolvedSessionId = session.id;

    if (ws.currentSessionId) {
      const oldRoom = sessionRooms.get(ws.currentSessionId.toString());
      if (oldRoom) oldRoom.delete(ws);
    }

    ws.currentSessionId = resolvedSessionId;
    if (!sessionRooms.has(resolvedSessionId.toString())) {
      sessionRooms.set(resolvedSessionId.toString(), new Set());
    }
    sessionRooms.get(resolvedSessionId.toString()).add(ws);
    broadcastSessionList();

    const list = notes.listNotesBySession(db, resolvedSessionId);
    ws.send(JSON.stringify({
      type: 'SESSION_DATA',
      session,
      notes: list
    }));
  } else if (data.type === 'GET_SESSIONS') {
    if (!request.session.authenticated) return;
    const db = getDb();
    const list = sessions.listSessions(db).map(session => {
      const room = sessionRooms.get(session.id.toString());
      return {
        ...session,
        active_users: room ? room.size : 0
      };
    });
    ws.send(JSON.stringify({ type: 'SESSION_LIST_UPDATE', sessions: list }));
  } else if (data.type === 'LEAVE_SESSION') {
    if (ws.currentSessionId) {
      const room = sessionRooms.get(ws.currentSessionId.toString());
      if (room) room.delete(ws);
      ws.currentSessionId = null;
      broadcastSessionList();
    }
  } else if (data.type === 'CREATE_SESSION') {
    if (!request.session.authenticated) return;
    const db = getDb();
    const { name } = data;
    const id = sessions.createSession(db, { name });
    ws.send(JSON.stringify({ type: 'SESSION_CREATED', id, name }));
    broadcastSessionList();
  } else if (data.type === 'UPDATE_SESSION') {
    if (!request.session.authenticated) return;
    const db = getDb();
    const { sessionId, name } = data;
    sessions.updateSession(db, sessionId, { name });
    broadcastSessionList();
  } else if (data.type === 'DELETE_SESSION') {
    if (!request.session.authenticated) return;
    const db = getDb();
    const { sessionId } = data;
    sessions.deleteSession(db, sessionId);
    broadcastToAll({ type: 'SESSION_DELETED', sessionId });
    broadcastSessionList();
  } else if (data.type === 'CREATE_NOTE') {
    if (!request.session.authenticated && !request.session.guestToken) return;
    const db = getDb();
    const { payload } = data;
    if (ws.currentSessionId) {
      // Block note creation if timer mode and timer not running
      const session = sessions.getSession(db, ws.currentSessionId);
      if (session && session.timestamp_mode === 'timer' && !session.started_at) {
        return ws.send(JSON.stringify({ type: 'ERROR', message: 'Timer is not running. Start the timer to add notes.' }));
      }
      notes.createNote(db, { ...payload, session_id: ws.currentSessionId });
      broadcastNoteUpdate(ws.currentSessionId);
    }
  } else if (data.type === 'UPDATE_NOTE') {
    if (!request.session.authenticated && !request.session.guestToken) return;
    const db = getDb();
    const { noteId, content } = data;
    if (ws.currentSessionId) {
      notes.updateNote(db, noteId, content);
      broadcastNoteUpdate(ws.currentSessionId);
    }
  } else if (data.type === 'DELETE_NOTE') {
    if (!request.session.authenticated && !request.session.guestToken) return;
    const db = getDb();
    const { noteId } = data;
    if (ws.currentSessionId) {
      notes.deleteNote(db, noteId);
      broadcastToRoom(ws.currentSessionId, { type: 'NOTE_DELETED', noteId, sessionId: ws.currentSessionId });
    }
  } else {
    console.error('Unknown WS message type:', data.type);
  }
}
