import { WebSocketServer } from 'ws';
import { getDb } from '../services/db.js';
import * as sessions from '../services/sessions.js';
import * as notes from '../services/notes.js';
import { handleMessage } from './handlers.js';
import { authIsRequired } from '../middleware/config-accessors.js';

export let wss;
export const sessionRooms = new Map();

export function broadcastToAll(message) {
  if (!wss) return;
  const data = JSON.stringify(message);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(data);
    }
  });
}

export function broadcastToRoom(sessionId, message) {
  const room = sessionRooms.get(sessionId.toString());
  if (!room) return;
  const data = JSON.stringify(message);
  room.forEach(client => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

export function broadcastSessionList() {
  const db = getDb();
  const list = sessions.listSessions(db).map(session => {
    const room = sessionRooms.get(session.id.toString());
    return {
      ...session,
      active_users: room ? room.size : 0
    };
  });
  broadcastToAll({ type: 'SESSION_LIST_UPDATE', sessions: list });
}

export function broadcastNoteUpdate(sessionId) {
  const db = getDb();
  const list = notes.listNotesBySession(db, sessionId);
  broadcastToRoom(sessionId, { type: 'NOTE_UPDATE', sessionId, notes: list });
}

export function setupWebSocket(httpServer, sessionParser) {
  wss = new WebSocketServer({ noServer: true });

  // Heartbeat: ping all clients every 30s, close those that don't respond (skip in tests)
  let heartbeatInterval;
  if (process.env.NODE_ENV !== 'test') {
    heartbeatInterval = setInterval(() => {
      wss.clients.forEach(ws => {
        if (ws.isAlive === false) {
          // Client didn't respond to ping — treat as close
          if (ws.currentSessionId) {
            const room = sessionRooms.get(ws.currentSessionId.toString());
            if (room) {
              room.delete(ws);
              if (room.size === 0) sessionRooms.delete(ws.currentSessionId.toString());
            }
            broadcastSessionList();
          }
          ws.terminate();
          return;
        }
        ws.isAlive = true;
        ws.ping();
      });
    }, 30000);
  }

  wss.on('connection', (ws, request) => {
    ws.currentSessionId = null;
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        handleMessage(ws, request, data, sessionRooms, broadcastSessionList, broadcastNoteUpdate, broadcastToRoom, broadcastToAll);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      if (ws.currentSessionId) {
        const room = sessionRooms.get(ws.currentSessionId.toString());
        if (room) {
          room.delete(ws);
          if (room.size === 0) sessionRooms.delete(ws.currentSessionId.toString());
        }
        broadcastSessionList();
      }
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    if (sessionParser) {
      sessionParser(request, {}, () => {
        handleUpgrade(request, socket, head);
      });
    } else {
      handleUpgrade(request, socket, head);
    }
  });
}

function handleUpgrade(request, socket, head) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const queryToken = url.searchParams.get('token');

  const isGuest = queryToken || (request.session?.guestToken);

  // In open/public mode (no auth configured), skip the check
  if (authIsRequired() && !(request.session?.authenticated) && !isGuest) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  // Auto-authenticate in open mode
  if (!authIsRequired()) {
    request.session = request.session || {};
    request.session.authenticated = true;
  }

  // Ensure session is saved before upgrade
  if (request.session && request.session.save) {
    request.session.save(() => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    });
  } else {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
}
