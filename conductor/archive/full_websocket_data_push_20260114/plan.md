# Plan: Full WebSocket Data Push

## Phase 1: Server-Side Data Payloads [checkpoint: fca5ed7]
- [x] Task: Update `server.js` to include the updated session list in `SESSION_LIST_UPDATE` broadcasts.
- [x] Task: Update `server.js` to include the specific note object or updated notes list in `NOTE_UPDATE` broadcasts.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Server-Side Data Payloads' (Protocol in workflow.md)

## Phase 2: Client-Side Integration [checkpoint: 7b55220]
- [x] Task: Refactor `public/app.js` to update the session list from WebSocket payloads. [7b55220]
- [x] Task: Refactor `public/app.js` to update the notes stream from WebSocket payloads. [7b55220]
- [x] Task: Remove redundant `fetch` calls from WebSocket listeners. [7b55220]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Client-Side Integration' (Protocol in workflow.md) [7b55220]

## Phase 3: Cleanup & Final Verification [checkpoint: 909fd25]
- [x] Task: Verify end-to-end that no redundant `GET` requests are fired during note/session CRUD. [909fd25]
- [x] Task: Ensure initial page load still functions correctly. [909fd25]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Cleanup & Final Verification' (Protocol in workflow.md) [909fd25]
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Cleanup & Final Verification' (Protocol in workflow.md)
