# Test Coverage Report — Uncovered Functionality

## Source File Todo List

| # | Source File | Related Test(s) | Status |
|---|-------------|-----------------|--------|
| 1 | `db.js` | `test/db.test.js`, `test/schema.test.js` | ✅ |
| 2 | `init-db.js` | (none) | ✅ |
| 3 | `notes.js` | `test/notes.test.js`, `test/notes_api.test.js`, `test/notes_update.test.js` | ✅ |
| 4 | `public/app.js` | `test/frontend.test.js` | ✅ |
| 5 | `server.js` | `test/server.test.js`, `test/auth.test.js`, `test/api_token_auth.test.js`, `test/management.test.js`, `test/management_api.test.js`, `test/webhooks.test.js`, `test/export.test.js`, `test/tags.test.js`, `test/timecode.test.js`, `test/timestamp_logic.test.js` | ✅ |
| 6 | `sessions.js` | `test/sessions.test.js`, `test/sessions_api.test.js` | ✅ |

---

## Uncovered Functionality by File

### 1. `db.js`

**Tests:** `test/db.test.js` (raw DatabaseSync + module API), `test/schema.test.js` (imported module)

**Covered:** `getDb()` caching/auto-init, `resetDbInstance()`, `initDb()` idempotency

**Still Uncovered:**
- `getDbPath()` — path resolution from config not directly tested
- `createDbInstance()` — directory creation (`mkdirSync`) + `DatabaseSync` instantiation not tested through the module's API
- Schema columns `guest_token` and `elapsed_ms` in sessions table — `db.test.js` uses a hard-coded older schema that omits these columns, so they are never verified
- Default export (`export default getDb`) — never imported/tested
- `provider` column default `'local'` in users table — not asserted
- Foreign key constraints — not validated

### 2. `notes.js`

**Tests:** `test/notes.test.js`, `test/notes_api.test.js`, `test/notes_update.test.js`

**Covered:** `getNote()`, `deleteNote()`, `createNote()` with `user_id`, fractional timestamp rounding, empty result set, `updateNote()` on non-existent ID

**Still Uncovered:**
- `createNote()` missing optional params (no `color`, no `user_id`) — minor edge case
- `listNotesBySession()` ordering verification (`ORDER BY created_at ASC`) — not explicitly validated

### 3. `public/app.js` (1288 lines)

**Tests:** `test/frontend.test.js` — only verifies the file is served as a static asset. No unit/integration tests for actual JS logic.

**Uncovered:** (Entire file — browser-side code)
- `TagManager` class: `loadTags()`, `saveTags()`, `addTag()`, `removeTag()`, `getTags()` — no tests
- `SocketManager` class: WebSocket connect/reconnect, `send()`, `on()`, `off()`, `emit()`, message parsing — no tests
- `formatDuration()` — no tests
- `compareTimestamps()` — simple numeric comparison — no tests
- `displayTimestamp()` — clock vs timer mode display logic — no tests
- `getSecondsSinceMidnight()` — no tests
- `captureDraftTimestamp()` / `updateDraftDisplay()` — no tests
- `renderQuickTags()`, `renderSessionList()`, `renderNotes()` — no tests
- `updateRecordingState()`, `updateClock()` — no tests
- `selectSession()`, `renameSession()`, `deleteSession()` — no tests
- `toggleEditMode()`, `saveEdit()`, `deleteNote()` — no tests
- `sendNote()` (including repeat-last-note logic) — no tests
- `updateColorSelection()`, `toggleColorPicker()`, `toggleOverflow()` — no tests
- `init()` — guest mode, session mode, URL hash routing — no tests
- WebSocket event handlers: `SESSION_DATA`, `ERROR`, `SESSION_LIST_UPDATE`, `SESSION_DELETED`, `NOTE_UPDATE`, `NOTE_DELETED`, `SESSION_STATUS_UPDATE` — no tests
- Export functions (`exportFn`, `toggleExportMenu`, `toggleFpsModal`) — no tests
- Tags modal (`toggleTagsModal`, `renderModalTags`) — no tests

### 4. `sessions.js`

**Tests:** `test/sessions.test.js` (unit), `test/sessions_api.test.js` (integration via HTTP), `test/management.test.js` (notes cleanup)

**Covered:** `getSessionByGuestToken()`, `getSession()` non-existent ID, `createSession()` defaults, `updateSession()` multi-field, `updateSession()` non-existent ID, `deleteSession()` with notes, `deleteSession()` non-existent ID, `listSessions()` ordering

**Still Uncovered:** None significant — all primary paths and edge cases covered.

### 5. `server.js`

**Tests:** `test/server.test.js`, `test/auth.test.js`, `test/api_token_auth.test.js`, `test/management.test.js`, `test/management_api.test.js`, `test/webhooks.test.js`, `test/export.test.js`, `test/tags.test.js`, `test/timecode.test.js`, `test/timestamp_logic.test.js`, `test/timer_api.test.js`, `test/guest_token.test.js`, `test/triggers.test.js`, `test/websocket.test.js`

**Covered — Endpoints:** Timer start/stop/reset, guest-token, logout, note PATCH/DELETE edge cases, session PATCH/DELETE/POST edge cases, export edge cases, triggers start/stop/invalid/404, WebSocket full lifecycle

**Covered — Broadcast Functions:** `broadcastToAll()`, `broadcastToRoom()`, `broadcastSessionList()`, `broadcastNoteUpdate()` — all exercised via WebSocket tests

**Covered — SquadCast Webhook Edge Cases:** Duplicate session, unknown event, 404 paths

**Covered — Triggers Edge Cases:** Start, stop, invalid action, missing params, 404

**Covered — Auth Edge Cases:** Auto-generated API token, `x-auth-token` header, `rememberMe` cookie

**Covered — Note API Edge Cases:** Timer mode guard, missing content/timestamp, non-existent note 404

**Covered — Session API Edge Cases:** Missing name, non-existent session 404

**Covered — Export Edge Cases:** Non-existent session 404, drop-frame EDL, non-UTC timezone, filename sanitization

**Covered — WebSocket:** Full lifecycle — connection, JOIN_SESSION, GET_SESSIONS, LEAVE_SESSION, CREATE/UPDATE/DELETE session/note, upgrade auth (401), close cleanup

**Covered — Startup:** `initDb()` startup call, port-in-use retry logic

**Still Uncovered — Internal Functions:**
- `getPort()` — never directly tested; port resolution from config not asserted
- `getApiToken()` — never directly tested; auto-generation from `username:password` hash not tested
- `wasApiTokenExplicitlySet()` — never tested
- `getAuthCredentials()` — never directly tested (only exercised indirectly through login flow)
- `authIsRequired()` — never directly tested
- `getSessionSecret()` — never tested; random fallback path not tested
- `getExportTimezone()` — never directly tested; non-UTC timezone path not tested
- `formatDuration()` — never tested (used internally by export but not asserted)

**Still Uncovered — Auth Edge Cases:**
- Guest token login via `?token=` query string — not tested
- Open/public mode (no auth configured) — not tested

### 6. `sessions.js`

**Tests:** `test/sessions.test.js` (unit), `test/sessions_api.test.js` (integration via HTTP), `test/management.test.js` (notes cleanup)

**Covered:** `getSessionByGuestToken()`, `getSession()` non-existent ID, `createSession()` defaults, `updateSession()` multi-field, `updateSession()` non-existent ID, `deleteSession()` with notes, `deleteSession()` non-existent ID, `listSessions()` ordering

**Still Uncovered:** None significant — all primary paths and edge cases covered.

---

## Workplan — Closing Coverage Gaps

**Tracking file:** `test-todo.md` — each task is an atomic, self-contained unit. Check off items as tests are written and pass. Safe to interrupt between any task.

### Phase 1 — Unit Tests (no server, fast)
**19 tasks | Target files: `sessions.test.js`, `notes.test.js`, `db.test.js`, `timecode.test.js`**

Fill the gaps in pure-function/unit coverage first — these are the quickest wins and require no HTTP server or WebSocket setup.

| Tasks | File |
|-------|------|
| T01–T07 | `test/sessions.test.js` — `getSession()` 404, default params, multi-field update, non-existent ID, `deleteSession` 404, ordering, `getSessionByGuestToken` |
| T08–T13 | `test/notes.test.js` — `getNote()`, `deleteNote()`, `user_id`, fractional timestamp, empty list, non-existent update |
| T14–T16 | `test/db.test.js` — `getDb()` caching, `resetDbInstance()`, `initDb()` idempotency |
| T17–T19 | `test/timecode.test.js` — `formatDuration()`, drop-frame, 29.97NDF |

### Phase 2 — API Integration Tests (server, no WebSocket)
**33 tasks | Target files: new + existing API test files**

Cover every HTTP endpoint's error paths, edge cases, and missing endpoints. Each test starts/stops its own server with a unique DB path.

| Tasks | File | What |
|-------|------|------|
| T20–T24 | `test/timer_api.test.js` (NEW) | Timer start/stop/reset, elapsed_ms, error paths |
| T25–T26 | `test/guest_token.test.js` (NEW) | Guest token generate/retrieve, 404 |
| T27–T30 | `test/auth.test.js` | Logout, auto-token, x-auth-token header, rememberMe |
| T31–T40 | `test/management_api.test.js` | Note PATCH/DELETE edge cases, session PATCH/DELETE/POST edge cases, timer-mode note guard |
| T41–T44 | `test/export.test.js` | Export 404, drop-frame EDL, non-UTC timezone, filename sanitization |
| T45–T47 | `test/webhooks.test.js` | SquadCast: duplicate session, unknown event, 404 paths |
| T48–T52 | `test/triggers.test.js` (NEW) | Triggers: start, stop, invalid action, missing params, 404 |

### Phase 3 — WebSocket Tests ✅ COMPLETE
**10 tasks | Target file: `test/websocket.test.js` (NEW)**

Full WebSocket lifecycle: connect, join room, send messages, leave, close. Requires the server to be running and `ws` client library.

| Tasks | What |
|-------|------|
| T53–T62 | Connection, JOIN_SESSION, GET_SESSIONS, LEAVE_SESSION, CREATE/UPDATE/DELETE session/note, upgrade auth, close cleanup |

### Phase 4 — Browser-Side (`public/app.js`)
**5 tasks | Target files: new test files with jsdom**

Lowest priority — requires a DOM test harness. Only worthwhile if `app.js` logic changes frequently enough to justify the setup cost.

| Tasks | What |
|-------|------|
| T63–T67 | TagManager, utility functions, SocketManager, render functions, init routing |

### Phase 5 — Misc / Startup
**2 tasks | Target file: `test/server.test.js`**

| Tasks | What |
|-------|------|
| T68–T69 | `initDb()` startup verification, port-in-use retry |

---

**Total: 69 tasks across 5 phases.** 58/69 complete. See `test-todo.md` for the detailed checklist with progress tracking.

| Phase | Status |
|-------|--------|
| 1 — Unit | 13/19 (T17-T19: timecode) |
| 2 — API | 33/33 ✅ |
| 3 — WebSocket | 10/10 ✅ |
| 4 — Browser | 0/5 (jsdom required) |
| 5 — Misc | 2/2 ✅ |
