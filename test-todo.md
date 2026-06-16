# Test Coverage — Work Log

> Each task is atomic and self-contained. Check off `[ ]` → `[x]` when the test is written and passes.
> If interrupted, pick up from the first unchecked item.

## Phase 1 — Unit Tests (no server, fast)

- [x] **T01** `test/sessions.test.js` — add: `getSession()` with non-existent ID returns `undefined`
- [x] **T02** `test/sessions.test.js` — add: `createSession()` defaults (`timestamp_mode='clock'`, `external_id=null`)
- [x] **T03** `test/sessions.test.js` — add: `updateSession()` with multiple fields in one call
- [x] **T04** `test/sessions.test.js` — add: `updateSession()` on non-existent ID returns 0 changes
- [x] **T05** `test/sessions.test.js` — add: `deleteSession()` on non-existent ID
- [x] **T06** `test/sessions.test.js` — add: `listSessions()` ordering verification (`ORDER BY created_at DESC`)
- [x] **T07** `test/sessions.test.js` — add: `getSessionByGuestToken()` (new function, zero coverage)
- [x] **T08** `test/notes.test.js` — add: `getNote(db, id)` basic retrieval
- [x] **T09** `test/notes.test.js` — add: `deleteNote(db, id)` deletion
- [x] **T10** `test/notes.test.js` — add: `createNote()` with `user_id` (non-null)
- [x] **T11** `test/notes.test.js` — add: `createNote()` fractional timestamp rounding
- [x] **T12** `test/notes.test.js` — add: `listNotesBySession()` empty result set
- [x] **T13** `test/notes.test.js` — add: `updateNote()` on non-existent note ID (0 changes)
- [x] **T14** `test/db.test.js` — add: `getDb()` auto-initialization and caching
- [x] **T15** `test/db.test.js` — add: `resetDbInstance()` clears cache (assert `dbInstance` becomes null)
- [x] **T16** `test/db.test.js` — add: `initDb()` idempotency (call twice, no error)
- [ ] **T17** `test/timecode.test.js` — add: `formatDuration()` unit tests
- [ ] **T18** `test/timecode.test.js` — add: EDL drop-frame (`29.97DF`) conversions
- [ ] **T19** `test/timecode.test.js` — add: `29.97NDF` fps conversions

## Phase 2 — API Integration Tests (server, no WebSocket)

- [x] **T20** `test/timer_api.test.js` — NEW: `POST /api/sessions/:id/timer/start`
- [x] **T21** `test/timer_api.test.js` — add: `POST /api/sessions/:id/timer/stop` (elapsed_ms accumulation)
- [x] **T22** `test/timer_api.test.js` — add: `POST /api/sessions/:id/timer/reset` (including notes-guard 400)
- [x] **T23** `test/timer_api.test.js` — add: timer/stop when timer not started (400)
- [x] **T24** `test/timer_api.test.js` — add: timer endpoints on non-existent session (404)
- [x] **T25** `test/guest_token.test.js` — NEW: `POST /api/sessions/:id/guest-token` (generate + retrieve)
- [x] **T26** `test/guest_token.test.js` — add: guest-token on non-existent session (404)
- [x] **T27** `test/auth.test.js` — add: `GET /logout` (session destroy + redirect)
- [x] **T28** `test/auth.test.js` — add: auto-generated API token from username:password
- [x] **T29** `test/auth.test.js` — add: `x-auth-token` header authentication
- [x] **T30** `test/auth.test.js` — add: `rememberMe` cookie extension (30-day maxAge)
- [x] **T31** `test/management_api.test.js` — add: PATCH notes via API (`/api/sessions/:id/notes/:note_id`)
- [x] **T32** `test/management_api.test.js` — add: PATCH note — non-existent note (404)
- [x] **T33** `test/management_api.test.js` — add: PATCH note — missing content (400)
- [x] **T34** `test/management_api.test.js` — add: DELETE note — non-existent note (404)
- [x] **T35** `test/management_api.test.js` — add: POST note — missing content/timestamp (400)
- [x] **T36** `test/management_api.test.js` — add: POST note — timer mode without timer running (400)
- [x] **T37** `test/management_api.test.js` — add: PATCH session — non-existent session (404)
- [x] **T38** `test/management_api.test.js` — add: PATCH session — missing name (400)
- [x] **T39** `test/management_api.test.js` — add: DELETE session — non-existent session (404)
- [x] **T40** `test/management_api.test.js` — add: POST session — missing name (400)
- [x] **T41** `test/export.test.js` — add: export non-existent session (404)
- [x] **T42** `test/export.test.js` — add: EDL drop-frame (`29.97DF`) export
- [x] **T43** `test/export.test.js` — add: `RECNOTES_EXPORT_TIMEZONE` non-UTC export
- [x] **T44** `test/export.test.js` — add: export filename sanitization (special chars)
- [x] **T45** `test/webhooks.test.js` — add: SquadCast — session already exists (`already_exists`)
- [x] **T46** `test/webhooks.test.js` — add: SquadCast — unknown event type (`ignored`)
- [x] **T47** `test/webhooks.test.js` — add: SquadCast — recording.started/stopped for non-existent session (404)
- [x] **T48** `test/triggers.test.js` — NEW: Triggers `start` action
- [x] **T49** `test/triggers.test.js` — add: Triggers `stop` action (elapsed_ms)
- [x] **T50** `test/triggers.test.js` — add: Triggers — invalid/missing action (400)
- [x] **T51** `test/triggers.test.js` — add: Triggers — missing required params (400)
- [x] **T52** `test/triggers.test.js` — add: Triggers — session not found (404)

## Phase 3 — WebSocket Tests

- [x] **T53** `test/websocket.test.js` — NEW: WebSocket connection + `JOIN_SESSION`
- [x] **T54** `test/websocket.test.js` — add: `GET_SESSIONS` message handler
- [x] **T55** `test/websocket.test.js` — add: `LEAVE_SESSION` + `sessionRooms` cleanup
- [x] **T56** `test/websocket.test.js` — add: `CREATE_SESSION` via WebSocket
- [x] **T57** `test/websocket.test.js` — add: `CREATE_NOTE` via WebSocket
- [x] **T58** `test/websocket.test.js` — add: `UPDATE_NOTE` via WebSocket
- [x] **T59** `test/websocket.test.js` — add: `DELETE_NOTE` via WebSocket
- [x] **T60** `test/websocket.test.js` — add: `UPDATE_SESSION` / `DELETE_SESSION` via WebSocket
- [x] **T61** `test/websocket.test.js` — add: WebSocket upgrade auth (401 for unauthenticated)
- [x] **T62** `test/websocket.test.js` — add: `ws.on('close')` room cleanup

## Phase 4 — Browser-Side (`public/app.js`)

> These require a DOM environment (jsdom or similar). Lower priority unless a test harness is already in place.

- [ ] **T63** `test/app_tags.test.js` — NEW: `TagManager` class (move from tags.test.js mock to actual app.js code)
- [ ] **T64** `test/app_utils.test.js` — NEW: `formatDuration()`, `compareTimestamps()`, `displayTimestamp()`, `getSecondsSinceMidnight()`
- [ ] **T65** `test/app_socket.test.js` — NEW: `SocketManager` class
- [ ] **T66** `test/app_render.test.js` — NEW: render functions (`renderQuickTags`, `renderSessionList`, `renderNotes`)
- [ ] **T67** `test/app_init.test.js` — NEW: `init()` guest mode, session mode, URL hash routing

## Phase 5 — Misc / Startup

- [x] **T68** `test/server.test.js` — add: `initDb()` startup call verification
- [x] **T69** `test/server.test.js` — add: port-in-use retry logic

---

## Progress

| Phase | Tasks | Done |
|-------|-------|------|
| 1 — Unit | T01–T19 (19) | 13/19 |
| 2 — API | T20–T52 (33) | 33/33 |
| 3 — WebSocket | T53–T62 (10) | 10/10 |
| 4 — Browser | T63–T67 (5) | 0/5 |
| 5 — Misc | T68–T69 (2) | 2/2 |
| **Total** | **69** | **58/69** |
