# Specification: WebSocket Migration

## 1. Overview
This track involves migrating the application's communication layer from HTTP polling/fetch to a full WebSocket architecture using the `ws` library. This will enable real-time updates for both the session list and the note stream, as well as handle data submission (creating/editing/deleting notes and sessions) via WebSocket messages.

## 2. Technical Architecture
- **Library:** `ws` (Node.js WebSocket library).
- **Protocol:** JSON-based message passing.
- **Connection Lifecycle:**
    - **Global Channel:** All clients automatically receive updates about the session list (create/delete/rename).
    - **Session Rooms:** Clients "join" a specific session room to receive live note updates and recording status changes for that session.

## 3. WebSocket API Design
### Client -> Server (Actions)
- `JOIN_SESSION`: `{ type: 'JOIN_SESSION', sessionId: <id> }` - Subscribe to updates for a specific session.
- `LEAVE_SESSION`: `{ type: 'LEAVE_SESSION' }` - Unsubscribe from current session updates.
- `CREATE_NOTE`: `{ type: 'CREATE_NOTE', payload: { content, timestamp, color } }`
- `UPDATE_NOTE`: `{ type: 'UPDATE_NOTE', noteId, content }`
- `DELETE_NOTE`: `{ type: 'DELETE_NOTE', noteId }`
- `CREATE_SESSION`: `{ type: 'CREATE_SESSION', name }`
- `UPDATE_SESSION`: `{ type: 'UPDATE_SESSION', sessionId, name }`
- `DELETE_SESSION`: `{ type: 'DELETE_SESSION', sessionId }`

### Server -> Client (Broadcasts)
- `SESSION_LIST_UPDATE`: Broadcast to **all** connected clients when a session is added/removed/renamed.
- `NOTE_UPDATE`: Broadcast to **room** when a note is added/edited/deleted.
- `SESSION_STATUS_UPDATE`: Broadcast to **room** when recording starts/stops.

## 4. Implementation Steps
1.  Install `ws`.
2.  Set up the WebSocket server in `server.js` alongside the Express app.
3.  Refactor `public/app.js` to replace `fetch` calls and polling intervals with a `WebSocket` client class or manager.
4.  Implement the room management logic on the server.
5.  Maintain existing HTTP endpoints for webhooks (SquadCast/Companion) but have them trigger WebSocket broadcasts.

## 5. Acceptance Criteria
- [ ] Session list updates in real-time on all clients without refreshing.
- [ ] Note stream updates in real-time for all users in the same session.
- [ ] Creating, editing, and deleting notes works via WebSockets.
- [ ] Webhook triggers (e.g., from Companion) correctly broadcast updates to connected WebSocket clients.
- [ ] Polling (`setInterval`) is completely removed from the frontend.
