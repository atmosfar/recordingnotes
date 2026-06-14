# Subagent 2 — Bug Verification Findings

## Files Reviewed
1. `/Users/botoole/shel/recordingnotes/server.js` (full, ~500 lines)
2. `/Users/botoole/shel/recordingnotes/config.js` (full, ~100 lines)
3. `/Users/botoole/shel/recordingnotes/init-db.js` (full, ~10 lines)
4. `/Users/botoole/shel/recordingnotes/sessions.js` (full, ~50 lines) — read to verify `elapsed_ms` handling
5. `/Users/botoole/shel/recordingnotes/db.js` (full, ~80 lines) — read to verify schema

---

## Bug 3 — SquadCast `recording.stopped` does NOT update `elapsed_ms`

**VERDICT: CONFIRMED — This is a real bug.**

### Evidence

**SquadCast `recording.stopped` handler** (server.js, lines ~185–196):

```js
if (name === 'recording.stopped') {
  const session = sessions.getSessionByExternalId(db, sessionID);
  if (session) {
    sessions.updateSession(db, session.id, {
      stopped_at: new Date().toISOString(),
      status: 'completed'
    });
    broadcastToRoom(session.id, { type: 'SESSION_STATUS_UPDATE', sessionId: session.id, status: 'completed' });
    broadcastSessionList();
    return res.status(200).json({ status: 'stopped' });
  }
  return res.status(404).json({ error: 'Session not found' });
}
```

This handler sets `stopped_at` and `status: 'completed'` but does **NOT** calculate or persist `elapsed_ms`.

**Companion `stop` action** (server.js, lines ~219–237):

```js
if (action === 'stop') {
  if (!id) {
    return res.status(400).json({ error: 'Session ID is required for stop action' });
  }
  const session = sessions.getSession(db, id);
  if (session) {
    const startedAt = session.started_at ? new Date(session.started_at).getTime() : 0;
    const elapsedThisRun = startedAt ? Date.now() - startedAt : 0;
    const newElapsedMs = (session.elapsed_ms || 0) + elapsedThisRun;

    sessions.updateSession(db, id, {
      timestamp_mode: 'timer',
      stopped_at: new Date().toISOString(),
      status: 'completed',
      elapsed_ms: newElapsedMs
    });
    ...
  }
}
```

**Timer stop endpoint** (server.js, lines ~280–298):

```js
const startedAt = new Date(session.started_at).getTime();
const stoppedAt = Date.now();
const elapsedThisRun = stoppedAt - startedAt;
const newElapsedMs = (session.elapsed_ms || 0) + elapsedThisRun;

sessions.updateSession(db, req.params.id, {
  stopped_at: new Date().toISOString(),
  status: 'completed',
  elapsed_ms: newElapsedMs
});
```

### Summary of the discrepancy

| Handler | `stopped_at` | `status` | `elapsed_ms` | `timestamp_mode` |
|---|---|---|---|---|
| SquadCast `recording.stopped` | ✅ | ✅ | ❌ **MISSING** | ❌ **MISSING** |
| Companion `stop` action | ✅ | ✅ | ✅ | ✅ |
| Timer stop endpoint | ✅ | ✅ | ✅ | ❌ (not needed, already set) |

The SquadCast `recording_session.created` handler (line ~163) sets `timestamp_mode: 'timer'` on session creation, so these sessions ARE in timer mode. The `recording.started` handler sets `started_at`. When `recording.stopped` fires, it sets `stopped_at` but never computes the elapsed duration. This means:

- `elapsed_ms` stays at its default of `0` (per db.js schema: `elapsed_ms INTEGER DEFAULT 0`).
- The export handler's `timestampToSeconds()` function (line ~370) computes timer-mode timestamps as `(elapsedMs + (ts - sessionStartMs)) / 1000`. With `elapsed_ms = 0`, all timestamps will be relative to the last `started_at` only — any accumulated time from prior runs is silently lost.

### Impact
For recordings started via SquadCast, the `elapsed_ms` field will never be populated. If the same session is started and stopped multiple times, only the final run's `started_at` is recorded, and `elapsed_ms` remains 0. This affects export timestamps and any UI that displays elapsed duration.

---

## Complexity — Webhook handlers use long `if-else if` chains

**VERDICT: PARTIALLY CONFIRMED — Minor code smell, not a bug.**

### Evidence

**SquadCast webhook handler** (server.js, lines ~155–200):

```js
if (name === 'recording_session.created' || name === 'participant.joined') {
  // ...
}

if (name === 'recording.started') {
  // ...
}

if (name === 'recording.stopped') {
  // ...
}

// For any other events we don't handle yet, return 200 to prevent retries
res.status(200).json({ status: 'ignored', message: `Unsupported event: ${name}` });
```

**Companion triggers handler** (server.js, lines ~203–240):

```js
if (action === 'create') {
  // ...
}

if (action === 'start') {
  // ...
}

if (action === 'stop') {
  // ...
}

res.status(400).json({ error: `Invalid or missing action: ${action}` });
```

These are 3–4 branch `if` chains (not `else if` — they use `return` to short-circuit). With only 3–4 event types each, a registry/mapping would add indirection without meaningful benefit. This is a minor style concern, not a correctness issue.

**Assessment:** Acceptable as-is. Would only warrant refactoring if the number of event types grows significantly (e.g., 8+).

---

## Complexity — Repetitive logic in Timer Start/Stop/Reset and Session Update endpoints

**VERDICT: CONFIRMED — Repetition exists but is not a bug.**

### Evidence

The timer endpoints share a common pattern:

1. **Timer start** (lines ~260–278): fetch session → check existence → build `updates` object → call `updateSession` → fetch updated → broadcast status + session update + session list.

2. **Timer stop** (lines ~280–304): fetch session → check existence → check `started_at` → calculate elapsed → call `updateSession` → fetch updated → broadcast status + session update + session list.

3. **Timer reset** (lines ~306–331): fetch session → check existence → check for notes → call `updateSession` → fetch updated → broadcast session update + session list.

The broadcast pattern (`broadcastToRoom` + `broadcastSessionList` + `broadcastToRoom` with `SESSION_UPDATE`) is repeated verbatim in start and stop. The fetch-then-fetch-again pattern (fetch before update, then fetch after update to get the full record) is also repeated.

**Assessment:** This is code duplication that could be reduced with a helper function, but it is not a correctness issue. Each endpoint is short enough (15–25 lines) that the repetition does not create maintainability risk.

---

## Complexity — Redundant `authIsRequired()` and `authRequired()` checks

**VERDICT: PARTIALLY CONFIRMED — Minor redundancy, not a bug.**

### Evidence

**`authIsRequired()`** (server.js, line ~40):

```js
function authIsRequired() {
  const config = getConfig();
  return !!(config.RECNOTES_AUTH_USERNAME && config.RECNOTES_AUTH_PASSWORD);
}
```

**`authRequired()` — first definition** (server.js, lines ~75–77):

```js
function authRequired() {
  return authIsRequired();
}
```

**`authRequired()` — second definition** (server.js, lines ~75–77, redefined):

The function is declared twice in the file. The first definition at line ~75-77 is:
```js
function authRequired() {
  return authIsRequired();
}
```

Due to function hoisting, the second declaration overrides the first. The net effect is that `authRequired()` is simply an alias for `authIsRequired()`.

**Usage pattern:**
- `authIsRequired()` is called in `checkAuth()` middleware (line ~82) and in the login route (line ~127).
- `authRequired()` is called in the WebSocket upgrade handler and in the server startup logging.

**Assessment:** The two functions are functionally identical. Having both is redundant — one could be eliminated. However, the naming is arguably intentional: `authIsRequired()` is the low-level check, and `authRequired()` is the higher-level alias used in different contexts. This is a minor code smell, not a correctness issue.

---

## Additional Bugs Found

### Bug A — Double `initDb()` call at startup

**server.js, lines ~462–463:**

```js
// Initialize the database immediately on startup so it's ready for first use

// Initialize the database immediately on startup so it's ready for first use
initDb();
```

The comment is duplicated (copy-paste artifact). The `initDb()` call itself is safe because `db.js` guards against re-initialization via `initializedPaths.has(dbPath)`. This is harmless but messy.

### Bug B — No guard against double-stop

In the Companion `stop` action (line ~219) and timer stop endpoint (line ~280), there is no check that the session is actually in `status: 'active'` before stopping. If `stop` is called twice:

- **Timer stop endpoint** (line ~287): checks `if (!session.started_at)` — but after the first stop, `started_at` is still set (it's not cleared). So a second stop would re-calculate elapsed from the same `started_at`, effectively double-counting the duration.

- **Companion `stop`** (line ~219): has no guard at all against double-stop. It would re-calculate elapsed from `started_at` and add it again to `elapsed_ms`.

The SquadCast `recording.stopped` handler has no such guard either, but since it doesn't calculate `elapsed_ms`, the double-stop issue manifests differently (just redundant `stopped_at` updates).

**Impact:** If a stop endpoint is called twice (e.g., due to a webhook retry), `elapsed_ms` will be inflated. This is a real bug, though it requires a specific race/retry scenario.

### Bug C — `recording.started` doesn't reset `elapsed_ms` on re-start

The SquadCast `recording.started` handler (line ~172) sets `started_at`, `stopped_at: null`, and `status: 'active'` but does not touch `elapsed_ms`. If a session is stopped (via any handler that does set `elapsed_ms`) and then started again via SquadCast, the accumulated `elapsed_ms` is preserved — which is actually correct behavior for a cumulative timer. However, the Companion `start` action (line ~206) also doesn't reset `elapsed_ms`, so this is consistent. No bug here, just noting for completeness.

---

## Summary Table

| Claim | Verdict | Severity |
|---|---|---|
| Bug 3: SquadCast `recording.stopped` misses `elapsed_ms` | **CONFIRMED** | **High** — Data loss for timer-mode sessions |
| Complexity: if-else chains in webhooks | **PARTIAL** — Minor code smell | Low |
| Complexity: Repetitive timer endpoint logic | **CONFIRMED** — Duplication exists | Low |
| Complexity: Redundant auth functions | **PARTIAL** — Minor redundancy | Low |
| Bug A: Double `initDb()` comment | **CONFIRMED** — Cosmetic | Negligible |
| Bug B: No guard against double-stop | **CONFIRMED** — `elapsed_ms` inflation risk | Medium |
