# Recording Notes — Agent Onboarding Guide

## Overview

Node.js web app for timestamped recording notes with real-time WebSocket collaboration. Exports to REAPER, Audition, and Resolve (CMX3600 EDL). Integrates with SquadCast webhooks and Bitfocus Companion triggers.

- **Runtime:** Node.js >= 23.9, ES modules, no build step
- **Server:** Express + `ws` (WebSocket)
- **Database:** `node:sqlite` (DatabaseSync) — single SQLite file
- **Frontend:** vanilla JS + CSS, served static by Express

## File Layout

```
server.js          # Thin orchestrator (~70 lines)
startup.js         # Server boot (port retry, WS setup)
services/          # db.js, config.js, sessions.js, notes.js
bin/               # init-db.js, reset-db.js, recordingnotes.cjs (entry point)
middleware/        # auth.js, config-accessors.js
routes/            # auth, sessions, notes, timer, export, webhooks, triggers
websocket/         # index.js (setup/broadcast), handlers.js (message dispatch)
public/            # index.html, login.html, css/ (8 files), app/ (10 modules)
test/              # 27 test files (Node.js built-in runner)
```

## Architecture

### Server
`server.js` creates Express, mounts session middleware, mounts routes, calls `initDb()`, starts via `startup.js`. Routes split into session-auth (sessions/notes/timer/export) and token-auth (webhooks/triggers). WebSocket uses `ws` with `noServer: true`; upgrade auth in `websocket/index.js`, message dispatch in `handlers.js`. Broadcasting: `broadcastToAll()`, `broadcastToRoom(sessionId)`, `broadcastSessionList()`, `broadcastNoteUpdate(sessionId)`.

### Services
Core business logic lives in `services/`: `db.js` (SQLite singleton + schema init), `config.js` (defaults → ~/.recordingnotes/settings.conf → env vars), `sessions.js` (session CRUD), `notes.js` (note CRUD). `getDb()` auto-inits schema. `resetDbInstance()` clears cache (for tests). Column names whitelisted in `sessions.js`; values always parameterized.

### Frontend
10 JS modules, 8 CSS files. No build step. Entry: `public/app/index.js`.

**Module DAG:** `utils → state → {socket, tags} → {timer, sessions, notes} → {ui, events, dom}`

Key modules: `state.js` (centralized state), `socket.js` (SocketManager with reconnect + pub-sub), `tags.js` (TagManager with localStorage), `timer.js` (clock + controls), `sessions.js` (sidebar + CRUD + hash routing), `notes.js` (rendering/editing/sending), `ui.js` (modals/theme/export), `events.js` (WS handlers), `dom.js` (event binding). Note: frontend modules are in `public/app/`; backend services are in `services/`.

CSS cascade: `vars → layout → sidebar → notes → buttons → overlays → quicktags → modals`

### Timestamp Modes
- **Clock:** notes use current time-of-day (HH:MM:SS)
- **Timer:** notes relative to timer start. Multi-run support via `elapsed_ms` (accumulated completed runs), `last_run_ms` (most recent run), `started_at` (current run start). Note `timer_position_ms` = `elapsed_ms + (now - started_at)` at creation time.

## Configuration

`~/.recordingnotes/settings.conf` (key=value) or env vars (highest priority):

| Env Var | Default | Purpose |
|---|---|---|
| `RECNOTES_PORT` | `3000` | Server port |
| `RECNOTES_DB_PATH` | `~/.recordingnotes/default.db` | SQLite path |
| `RECNOTES_AUTH_USERNAME` | — | Login username |
| `RECNOTES_AUTH_PASSWORD` | — | Login password |
| `RECNOTES_AUTH_API_TOKEN` | auto (SHA-256) | Webhook/triggers token |
| `RECNOTES_SESSION_SECRET` | random hex | Cookie signing |
| `RECNOTES_EXPORT_TIMEZONE` | `UTC` | Export timezone |

## Tests

```bash
NODE_ENV=test RECNOTES_DB_PATH=test.db node --test test/*.test.js
```

173 tests pass. Two intermittent "database is locked" failures in `test/export.test.js` and `test/export_timer.test.js` when run together (shared DB/config state).

## Active Bugs

1. **SquadCast `recording.stopped` doesn't update timer state** — `elapsed_ms`/`last_run_ms` stay 0. Fix: add elapsed calc to `routes/webhooks.js`.
2. **No guard against double-stop** via Companion trigger. Fix: add guard to `routes/triggers.js`.
3. **XSS in `renderModalTags`** — tag names from localStorage interpolated into `innerHTML`. Fix: use `textContent`.

## Conventions

- **ES modules only** (except `bin/recordingnotes.cjs`)
- **Broadcast-first** — WebSocket is primary sync; REST for initial fetches/exports
- **Guest mode** — sessions shared via token; guests can CRUD notes but not manage sessions
- **Hash routing** — `#/session/:id` and `#/guest/:token`

## Git Rules

- **Only track files already in the repo** — do NOT stage or commit untracked files without explicit user consent. Never auto-commit working artifacts like `AGENTS.md`, `PLAN-*.md`, `repro-bug.js`, `timerbug.*`, etc.
- **`dev` branch (local only):** used for incremental development and testing. Never push to remote. Only commit files already tracked plus everything under `test/`. Use `git add --force` for test files (`.gitignore` excludes `*.db` and similar patterns tests may create).
- **`main` branch (remote):** production branch. Push via squash merge from dev: `git checkout main && git merge --squash --allow-unrelated-histories dev && git commit -m "Bugfixes and UI tweaks" && git push origin main`. Only tracked files go to main. Test files are included. The `.gitignore` (`*.md` / `!README.md`) excludes dev notes — any `.md` files already tracked must be manually removed from the index before committing.
