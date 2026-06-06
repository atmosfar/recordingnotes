# Debugging Plan: Guest Token Link Sticking Bug

## Problem Statement

After visiting a "Share Guest Link" URL (`/?token=xxx#/guest/xxx`), the WebSocket server **always pushes data for the token-linked session**, regardless of which session the authenticated user clicks in the sidebar. The correct session name briefly appears in the header before being overwritten by the stale session data pushed over WebSocket.

## Root Cause Analysis

### The Bug Flow (Step-by-Step)

1. **Authenticated user is on normal dashboard** (`/#/session/89`)
   - `req.session.authenticated = true`
   - `req.session.guestToken` is **unset/undefined**

2. **User clicks "Share Guest Link" → visits `/?token=abc123#/guest/abc123`**
   - Server's `checkAuth` middleware (line ~52 of `server.js`) sees `req.query.token`
   - Sets `req.session.guestToken = 'abc123'` ← **THIS PERSISTS IN THE SESSION**
   - Frontend sets `window.isGuestMode = true` and `window.guestToken = 'abc123'`

3. **WebSocket connects**
   - Server reads `queryToken` from URL + checks `request.session.guestToken`
   - Both resolve to the same token → user joins session 89 (the token-linked session)

4. **User navigates back to dashboard, clicks a DIFFERENT session in sidebar** (e.g., session 50)
   - Frontend's `hashchange` handler fires → calls `selectSession(50)`
   - `selectSession()` sends `JOIN_SESSION { sessionId: 50 }` over WebSocket

5. **Server receives `JOIN_SESSION { sessionId: 50 }`** — HERE IS THE BUG:

   ```javascript
   // server.js, inside wss.on('connection') → ws.on('message')
   const effectiveToken = guestToken || request.session.guestToken;

   if (effectiveToken) {                              // ← TRUE (stale token!)
     session = sessions.getSessionByGuestToken(db, effectiveToken);
     // ↑ Resolves to session 89, NOT session 50!
   } else if (request.session.authenticated && sessionId) {
     // ↑ This branch is NEVER reached because effectiveToken is truthy
     session = sessions.getSession(db, sessionId);
   }
   ```

   **`request.session.guestToken` was set in step 2 and never cleared.** It persists for the entire Express session lifetime (24 hours by default cookie maxAge). Every subsequent `JOIN_SESSION` message — even with a valid `sessionId` — is hijacked by the stale guest token, resolving to the wrong session.

6. **Server sends `SESSION_DATA` for session 89**
   - Frontend receives it in the `socket.on('SESSION_DATA')` handler
   - Overwrites `currentSession` and `currentSessionId` with session 89's data
   - Notes for session 89 are rendered, replacing whatever was shown for session 50

### The Two Defects

| # | Defect | Location | Description |
|---|--------|----------|-------------|
| A | **Server-side** | `server.js` ~line 340 (`JOIN_SESSION` handler) | `request.session.guestToken` takes priority over `sessionId` in the `effectiveToken` check. The guest token is never cleared after initial use, so it hijacks all subsequent JOIN_SESSION messages. |
| B | **Client-side** | `app.js` — `SocketManager.connect()` on open | When reconnecting after a guest-token page visit, `window.isGuestMode` remains `true`, causing the client to always send `JOIN_SESSION { guestToken: ... }` instead of `JOIN_SESSION { sessionId: ... }`. The `isGuestMode` flag is never reset when the user navigates away from the guest URL. |

### Why the Header Shows Correct Name Briefly

1. User clicks session 50 in sidebar → `selectSession(50)` runs
2. `window.location.hash = '#/session/50'` is set
3. The header title is NOT directly updated by `selectSession()` (it waits for WebSocket `SESSION_DATA`)
4. However, the `SESSION_LIST_UPDATE` handler may briefly update metadata from the session list
5. Then the `SESSION_DATA` message arrives with the WRONG session (89) → overwrites everything

## Proposed Fixes

### Fix A: Server-Side — Don't Persist Guest Token Preference Across Messages

**Option A1 (Preferred):** When an authenticated user sends a `JOIN_SESSION` with a `sessionId`, ignore `request.session.guestToken` entirely. The logic should be:

```javascript
if (request.session.authenticated && sessionId) {
  // Authenticated user explicitly requested a session by ID — respect it
  session = sessions.getSession(db, sessionId);
} else if (effectiveToken) {
  // Guest-only access via token
  session = sessions.getSessionByGuestToken(db, effectiveToken);
}
```

**Option A2:** Clear `request.session.guestToken` after the first successful join, so it doesn't persist:

```javascript
// After successful guest-token join:
if (effectiveToken && !request.session.authenticated) {
  // Only keep guestToken for pure guests, not authenticated users
}
```

### Fix B: Client-Side — Reset `isGuestMode` on Navigation Away

When the user navigates to a non-guest URL (e.g., `/#/session/50`), reset the guest mode flags:

```javascript
window.addEventListener('hashchange', () => {
  const guestMatch = window.location.hash.match(/#\/guest\/([a-zA-Z0-9-]+)/);
  const sessionMatch = window.location.hash.match(/#\/session\/(\d+)/);
  
  // If navigating away from a guest link, reset guest mode
  if (!guestMatch && !window.location.search.includes('token=')) {
    window.isGuestMode = false;
    window.guestToken = null;
  }
  
  if (sessionMatch && m[1] !== currentSessionId?.toString()) {
    selectSession(m[1]);
  }
});
```

Also reset in `SocketManager.connect()` on reconnect — don't blindly re-send guest token join.

### ~~Fix C (Rejected): Clear `req.session.guestToken` on Server~~

**Rejected.** `req.session` is per-user (keyed by cookie), so clearing it wouldn't affect other users. However, flipping the priority order in Fix A already makes the stale token irrelevant — there's no additional safety gained from clearing it, and it adds unnecessary cognitive complexity. The multi-user scenario (one guest via token, one authenticated user logged in, both viewing the same session) works correctly with just Fixes A + B: both clients end up in the same `sessionRooms` room and receive identical `broadcastNoteUpdate()` pushes regardless of how they joined.

## Verification Steps

1. Start the server, log in as authenticated user
2. Create two sessions (A and B)
3. Navigate to session A → verify notes display correctly
4. Click "Share Guest Link" for session A → copy URL
5. Paste the guest link URL in the same tab (or new tab, same browser session)
6. Verify session A displays correctly
7. Navigate back to dashboard (`/`) or directly to `/#/session/B`
8. Click session B in sidebar → verify session B's notes display (NOT session A's)
9. Verify the header shows session B's name and stays that way
10. Repeat steps 3-9 with different sessions

## Files to Modify

- `server.js` — `JOIN_SESSION` handler: flip priority so `authenticated && sessionId` is checked **before** `effectiveToken`
- `public/app.js` — `hashchange` handler: reset `window.isGuestMode = false` and `window.guestToken = null` when navigating away from a guest URL
