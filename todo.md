# Project Hand-Off Notes — Recording Notes v0.1.0

**Date**: 2026-06-03
**Status**: Pre-publish — polish applied, ready for `npm publish`
**Branch**: `dev`
**Last commit**: `a6b1463` — Fix remaining 'Succesful' typo in README

---

## Architecture Overview

**Stack**: Node.js (vanilla, no TypeScript), Express, native `node:sqlite`, WebSocket (`ws`)
**Frontend**: Vanilla JS/CSS/HTML served as static files from `/public`
**No build step** — everything runs directly with Node.js
**Minimum Node version**: 23.9.0 (required for native `node:sqlite`)

### Key Files

| File | Purpose |
|---|---|
| `server.js` | Express app, API routes, WebSocket server, auth logic |
| `db.js` | SQLite connection management, schema initialization |
| `sessions.js` | Session CRUD operations (DB layer) |
| `notes.js` | Note CRUD operations (DB layer) |
| `init-db.js` | Standalone DB schema creation script |
| `bin/recordingnotes.cjs` | CLI entry point for npx/npm bin |
| `public/app.js` | Frontend application logic |
| `public/index.html` | Main UI template |
| `public/login.html` | Login page (hidden when auth is disabled) |
| `public/style.css` | All styling (no CSS framework) |

### Database Schema

- **sessions**: `id`, `name`, `external_id`, `created_at`, `started_at`, `stopped_at`, `status`
- **notes**: `id`, `session_id`, `content`, `timestamp` (REAL seconds), `color`, `user_id`, `created_at`

---

## What Was Just Done

### npx Compatibility Fixes (commit `a245b79`)

Two path-resolution bugs prevented the package from working via `npx`:

1. **`bin/recordingnotes.cjs`** — `node init-db.js` ran relative to `process.cwd()`, which is the user's directory under npx. Fixed by resolving via `path.join(__dirname, '..', 'init-db.js')`.

2. **`server.js`** — `express.static('public')` and `process.cwd() + '/public/login.html'` resolved from `process.cwd()`. Fixed by adding an ESM `__dirname` shim (`fileURLToPath(import.meta.url)`) and using `path.join(__dirname, 'public')`.

### Documentation

- **README.md** — Added full webhook documentation: authentication, SquadCast endpoint/events, Bitfocus Companion endpoint/actions, curl examples.

### Pre-publish Polish (commits `18afe49`, `a6b1463`)

- **`bin/recordingnotes.cjs`** — Replaced `execSync` with `spawn` for server launch; added `SIGTERM`/`SIGINT` forwarding for graceful shutdown. Updated usage text to "Live timestamped note-taking system".
- **`server.js`** — Lowercased startup message: `LOGIN REQUIRED` → `Login required`.
- **`README.md`** — Fixed typos: `Succesful` → `Successful`, extra space in `or  time-of-day`.
- **`.env.example`** — Updated to match current config vars (removed unused `DATABASE_URL`, `GOOGLE_CLIENT_*`).

### Validation

- **66 tests** — all passing (`npm test`)
- **Tarball** — 14 files, matches git-tracked list
- **Clean npx smoke test** — verified in fresh temp directory: server starts, DB auto-inits, static files serve (200), API works, full CRUD (sessions + notes), CSV export

---

## Pending / Next Steps

### Immediate (Pre-Publish)

1. **Check npm 2FA** — Ensure your npm account has two-factor authentication enabled (`npm profile enable-2fa`).
2. **`npm publish`** — Push v0.1.0 to npm registry. All gates passed; no blocking issues remain.

### Post-Publish

2. **Verify `npx recordingnotes start`** in a completely clean environment (Docker container or fresh VM) to validate out-of-the-box behavior post-publish.
3. **Consider `postinstall` script** — Friendly first-run experience (env var checklist, "visit localhost:3000").
4. **Consider CI/CD** — Test files exist on disk (`test/`, 19 files, 66 tests) but are **not tracked in git**. Re-add to tracking + GitHub Actions if automated testing is desired.

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Server listen port |
| `DB_PATH` | No | `./dev.db` | SQLite database path |
| `SESSION_SECRET` | Yes (if auth enabled) | — | Cookie signing secret |
| `AUTH_USERNAME` | No | — | Login username (leave unset for open mode) |
| `AUTH_PASSWORD` | No | — | Login password (leave unset for open mode) |
| `AUTH_API_TOKEN` | No | (auto-generated) | Token for integration API auth |

---

## Known Constraints & Preferences

- **No build step**: Project is intentionally vanilla JS with zero transpilation/bundling. Keep it that way.
- **Native sqlite only**: Uses `node:sqlite` (built into Node 23+). No external dependencies for DB.
- **WebSocket real-time sync**: Multiple users viewing same session get live updates via `sessionRooms` Map broadcasting. Don't break this.
- **Guest + authenticated multi-user**: Both can view same session simultaneously. Priority flip fix ensures authenticated users aren't hijacked by stale guest tokens.
- **Sandbox issues**: The dev machine has an OS sandbox that blocks npm cache writes and some file operations. Disable sandbox when running `npm pack`, `npm publish`, or writing certain files.
- **npm cache permissions**: Previously had root-owned files in `~/.npm`. May need `sudo chown -R 583509046:1121243572 "/Users/botoole/.npm"` if sandbox causes issues.

---

## Test Suite (on disk, untracked in git)

Test files exist in `test/` directory (19 test files, 66 tests total). They are **not tracked in git** but remain on disk. To run:

```bash
npm test
```

Key test files: `server.test.js`, `sessions.test.js`, `notes.test.js`, `export.test.js`, `frontend.test.js`, `schema.test.js`, `companion_webhooks.test.js`, etc.

---

## Webhook Integrations

- **SquadCast**: `POST /api/webhooks/squadcast/:token` — handles `recording_session.created`, `participant.joined`, `recording.started`, `recording.stopped` events.
- **Triggers**: `POST /api/triggers` — supports `create`, `start`, `stop` actions for session automation (works with Bitfocus Companion, curl, scripts, etc.).
- Both require API token auth. Token passed via URL path (SquadCast) or query/header (Triggers).

---

## Export Formats

- **CSV**: `GET /api/sessions/:id/export` — REAPER-compatible CSV with `HH:MM:SS.mmm` precision timestamps, sanitized filename from session name.
- Timestamps use REAL seconds (floating-point) in DB, formatted to 0.1s precision in UI, 0.001s precision in CSV export.

---

## Frontend Notes

- **Hash routing**: `#/session/<id>` for deep-linking to specific sessions.
- **Mobile responsive**: Hamburger menu sidebar with backdrop overlay.
- **Dark mode toggle**: Stored in localStorage.
- **Note editing**: In-stream inline editing with tap/hover detection for mobile/desktop.
- **Session management**: Rename/delete sessions via kebab menu (authenticated users only).
- **Color picker**: Popup-style color selection for notes.

---

## Package Dependencies (from `package.json`)

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "express-session": "^1.19.0",
    "ws": "^8.19.0",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "localtunnel": "^2.0.2",
    "nodemon": "^3.0.1"
  }
}
```

Tests use Node's built-in test runner (no Jest/Mocha).

---

## Git State

- **Branch**: `dev`
- **Tracked files** (14): `.env.example`, `LICENSE`, `README.md`, `bin/recordingnotes.cjs`, `db.js`, `init-db.js`, `notes.js`, `package.json`, `public/app.js`, `public/index.html`, `public/login.html`, `public/style.css`, `server.js`, `sessions.js`
- **Untracked** (on disk): `test/` (19 files), `conductor/`, `archived/`, `scripts/`, various dev artifacts
- **`.npmignore`**: Safety net alongside `"files"` whitelist in `package.json`

---

## Quick Commands Reference

```bash
npm start              # Start server
npm test               # Run all 66 tests
npm pack --dry-run     # Preview npm package contents (disable sandbox first)
node init-db.js        # Initialize/reset database
npm run db:reset       # Delete and recreate database
```
