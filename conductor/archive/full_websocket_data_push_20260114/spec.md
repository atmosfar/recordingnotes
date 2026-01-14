# Specification: Full WebSocket Data Push

## 1. Overview
The current system uses WebSockets for signaling updates (e.g., `NOTE_UPDATE`), but the client still relies on HTTP `GET` requests to fetch the actual data (e.g., the list of notes). This track will refactor the server to include the modified data in the WebSocket broadcasts and update the client to integrate these pushes without additional HTTP requests.

## 2. Functional Requirements
- **Data Pushing:**
    - `NOTE_UPDATE` must now include the specific note object or the updated list.
    - `SESSION_LIST_UPDATE` must now include the updated list of sessions.
- **Eliminate Redundant GETs:**
    - Remove `fetchNotes()` calls triggered by WebSocket events.
    - Remove `fetchSessions()` calls triggered by WebSocket events.
- **Real-time UI Sync:**
    - The UI must update immediately upon receiving the data push.

## 3. Technical Architecture
- **Server-side (`server.js`):**
    - Update `broadcastToRoom` and `broadcastToAll` calls to include data payloads.
    - Ensure note creation/update handlers return the new state to be broadcast.
- **Client-side (`public/app.js`):**
    - Refactor `NOTE_UPDATE` listener to handle incoming note data.
    - Refactor `SESSION_LIST_UPDATE` listener to handle incoming session data.
    - Update local UI state (e.g., `window.lastSessions`) directly from WS messages.

## 4. Acceptance Criteria
- [ ] No `GET /api/sessions/:id/notes` requests are observed in logs when a note is added/updated.
- [ ] No `GET /api/sessions` requests are observed in logs when a session is added/updated.
- [ ] All clients stay in sync with the latest data in real-time.
- [ ] Initial page load still uses `fetch` for baseline data, but all subsequent updates are pushed.
