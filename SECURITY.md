# Security Vulnerability Report — Recording Notes v0.1.0

**Date:** 2026-06-06  
**Last Updated:** 2026-06-06  
**Scope:** Full codebase review (server.js, db.js, sessions.js, notes.js, bin/recordingnotes.cjs, public/app.js, public/login.html)

---

## Summary

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| **Critical** | 1 | 1 | 0 |
| **High** | 3 | 2 | 1 |
| **Medium** | 5 | 4 | 1 |
| **Low** | 2 | 0 | 2 |

---

## Fixed Issues

### C1: Default credentials in `.env.example` — ✅ FIXED

**File:** `.env.example`  
Default `AUTH_PASSWORD="password123"` and `AUTH_API_TOKEN="a_secret_api_token"` replaced with clear placeholder text. API token commented out with note that it's optional (auto-generated from SHA-256 of username:password).

### H1: Application runs with no authentication by default — ✅ FIXED

**File:** `server.js`  
Added prominent `console.warn` on startup when auth is disabled:
```
Warning: No authorization configured. Do not use this setup in untrusted environments. See .env.example for details.
```

### H3: Insecure session cookie configuration — ✅ FIXED

**File:** `server.js`  
- Hardcoded fallback secret `'fallback_secret_for_dev_only'` replaced with `crypto.randomBytes(32).toString('hex')`
- Added `httpOnly: true` (prevents JavaScript access to session cookie)
- Added `sameSite: 'strict'` (blocks CSRF)
- Changed `secure: false` to `secure: 'auto'` (HTTPS-aware via reverse proxy)
- Added `app.set('trust proxy', 1)` for proper HTTPS detection behind reverse proxies

### M1: Timing attack on API token comparison — ✅ FIXED

**File:** `server.js`  
Replaced `token === validToken` with `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(validToken))` in `checkApiTokenAuth`. Length check added before comparison to avoid `timingSafeEqual` throwing on mismatched lengths.

### M2: No rate limiting on authentication endpoints — ✅ FIXED

**File:** `server.js`  
Added `express-rate-limit` middleware:
- `POST /login`: 20 attempts per 15 minutes
- `POST /api/triggers`: 60 requests per minute
- `POST /api/webhooks/squadcast/:token`: 60 requests per minute

### M3: No CSRF protection on state-changing operations — ✅ FIXED (via H3)

Resolved by adding `sameSite: 'strict'` to session cookies (H3 fix).

### M4: Information leakage — ✅ FIXED

**File:** `server.js`
- API token in startup log now masked as `****xxxx` when user-provided; full token printed only when auto-generated (needed for `npx recordingnotes` local dev UX)
- `/api/status` no longer exposes database file path — returns only `{ status: 'ok' }`
- Open-mode API bug fixed: webhooks/triggers now work when auth is disabled (skip token check in `checkApiTokenAuth`)

### M5: Unprefixed environment variables — ✅ FIXED

All environment variables renamed with `RECNOTES_` prefix across all source files, config files, tests, and documentation to prevent collisions with other services:
- `PORT` → `RECNOTES_PORT`
- `DB_PATH` → `RECNOTES_DB_PATH`
- `SESSION_SECRET` → `RECNOTES_SESSION_SECRET`
- `AUTH_USERNAME` → `RECNOTES_AUTH_USERNAME`
- `AUTH_PASSWORD` → `RECNOTES_AUTH_PASSWORD`
- `AUTH_API_TOKEN` → `RECNOTES_AUTH_API_TOKEN`

---

## Remaining Issues

### H2: Guest tokens are permanent and non-revocable

**File:** `server.js`  
Guest tokens are stored in the `sessions` table and **never expire**. Once generated:
- They cannot be revoked independently (only by deleting the session)
- The same token is returned every time the endpoint is called (no rotation)
- There's no audit trail of who accessed via guest link

**Impact:** A leaked guest link provides permanent read/write access to that session.

**Fix:** Add an `expires_at` column to sessions, validate on use, and provide a revoke endpoint.

**Effort:** ~30 min (database schema migration + API changes)

---

### L1: Potential stored XSS via note content

**File:** `public/app.js`  
**Line:** ~439

```js
div.innerHTML = `
    <span class="timestamp">${formatDuration(note.timestamp, 1)}</span>
    <span class="content">${note.content}</span>
    ...
`;
```

Note content is injected via `innerHTML` without escaping. If a note contains `<script>` tags or event handlers (`<img onerror=...>`), they'll execute when rendered.

**Impact:** A malicious user in a shared session (or via guest link) could inject scripts that run for all viewers.

**Fix:** Use `textContent` instead of `innerHTML` for dynamic content, or escape HTML:
```js
const escaped = note.content.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
```

**Effort:** ~10 min

---

### L2: Command injection in CLI script

**File:** `bin/recordingnotes.cjs`  
**Line:** ~30

```js
execSync(`node ${initDbPath}`, { stdio: 'inherit' });
```

`initDbPath` is constructed via `path.join(__dirname, '..', 'init-db.js')`. While `__dirname` is controlled by Node, if the package is installed in a directory with special shell characters in its path (e.g., spaces, quotes), the unquoted string interpolation could cause issues.

**Fix:** Use `spawnSync` instead of `execSync` with string interpolation:
```js
spawnSync('node', [initDbPath], { stdio: 'inherit' });
```

**Effort:** ~5 min

---

## Additional Observations

### SQL Injection: **Not vulnerable**
All database queries in `sessions.js`, `notes.js`, and `db.js` use parameterized statements (`?` placeholders). No string concatenation into SQL. ✅

### Path Traversal: **Low risk**
Static file serving uses `express.static(__dirname + '/public')` which is confined to the public directory. The export filename sanitization removes path separators. ✅ (with minor hardening possible)

### WebSocket Auth: **Adequate**
WebSocket connections go through `sessionParser` and check authentication status before allowing operations. Guest tokens are validated server-side. ✅

---

## Remaining Priority Order

1. **H2** — Add guest token expiration (schema change, ~30 min)
2. **L1** — Escape note content in `innerHTML` (~10 min)
3. **L2** — Switch `execSync` → `spawnSync` (~5 min)
