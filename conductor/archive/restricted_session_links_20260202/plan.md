# Plan: Restricted Session Links (Guest Mode)

## Phase 1: Database & Server Logic
- [x] Task: Update `db.js` to include a `guest_token` column in the `sessions` table. [f827e9c]
- [x] Task: Update `sessions.js` to support retrieving a session by its `guest_token`. [f827e9c]
- [x] Task: Implement a server endpoint `POST /api/sessions/:id/guest-token` to generate/get a token. [f827e9c]
- [x] Task: Update `checkAuth` in `server.js` to exempt valid `/guest/:token` URLs. [f827e9c]
- [x] Task: Update `public/login.html` to not interfere with guest routes. [f827e9c]

## Phase 2: Frontend Implementation
- [x] Task: Implement route detection in `public/app.js` for `/#/guest/:token`. [be73d92]
- [x] Task: Add "Guest Mode" UI logic to hide the sidebar and session-management buttons. [be73d92]
- [x] Task: Add a "Share Guest Link" button to the session header for Admins. [be73d92]
- [x] Task: Update `socket.send('JOIN_SESSION', ...)` to include the guest token if in guest mode. [be73d92]

## Phase 3: WebSocket & Security
- [x] Task: Update WebSocket handler in `server.js` to validate `JOIN_SESSION` requests for guests. [be73d92]
- [x] Task: Ensure guests cannot trigger `GET_SESSIONS`, `DELETE_SESSION`, or other restricted events. [be73d92]
- [x] Task: Verify indicators (recording dot, user count) still work correctly in guest mode. [be73d92]

## Phase 4: Final Verification
- [x] Task: Test guest access from a private/incognito window. [be73d92]
- [x] Task: Verify that a guest cannot manually "guess" other session IDs. [be73d92]
- [x] Task: Conductor - User Manual Verification 'Phase 4: Final Verification' (Protocol in workflow.md) [be73d92]
