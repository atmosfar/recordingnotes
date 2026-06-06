# Timestamp Refactor Plan — Multi-Timezone Support

**Date:** 2026-06-06
**Branch:** `dev` (commit `3694e82`)
**Priority:** High — required for distributed collaboration

---

## Problem

The current timestamp model stores **"seconds since midnight"** as a `REAL` number. This is inherently timezone-dependent and breaks for multi-timezone collaboration:

1. **DST bug:** `getSecondsSinceMidnight()` uses UTC methods (`getUTCHours()`, etc.), so European users during BST see timestamps 1 hour behind their wall clock.
2. **Multi-timezone sorting:** If London (14:00 BST) and New York (09:00 EDT) take notes at the same instant, their timestamps differ by 5 hours in local mode, causing incorrect sort order. In UTC mode they sort correctly but display wrong times.
3. **No absolute reference:** "Seconds since midnight" is a relative offset that loses the actual moment in time. It can't be converted between timezones.

## Goal

Store timestamps as **absolute UTC milliseconds** (`Date.now()`), display them in **each user's local timezone**. This gives:
- ✅ Correct wall-clock display for every user, regardless of timezone
- ✅ Correct sort order across timezones (same instant = same stored value)
- ✅ DST-aware (automatic, no manual handling needed)
- ✅ Backward compatible with existing exports (HH:MM:SS format preserved)

---

## Current Architecture

### Data Flow (Clock Mode)
```
Client: getSecondsSinceMidnight() → UTC seconds since midnight
  ↓ (WebSocket/REST)
Server: stores as REAL in notes.timestamp
  ↓ (export)
CSV/EDL: formatDuration(seconds) → "HH:MM:SS.mmm"
```

### Data Flow (Timer Mode)
```
Client: (Date.now() - started_at) / 1000 → elapsed seconds
  ↓ (WebSocket/REST)
Server: stores as REAL in notes.timestamp
  ↓ (export)
CSV/EDL: formatDuration(seconds) → "HH:MM:SS.mmm"
```

### Key Files
| File | Role |
|------|------|
| `db.js` | Schema definition (`notes.timestamp REAL`) |
| `public/app.js` | `getSecondsSinceMidnight()`, `formatDuration()`, note creation, display |
| `server.js` | REST API, WebSocket handling, export endpoints (`formatDuration()`, `timeToHmsf()`) |
| `notes.js` | DB CRUD (passes timestamp through unchanged) |
| `sessions.js` | Session management (`started_at`, `stopped_at` already ISO strings) |
| `test/*.test.js` | Timestamp-related tests |

---

## Design

### New Data Model

```
notes.timestamp: INTEGER (UTC milliseconds, i.e., Date.now())
```

**Timer mode** remains conceptually the same (elapsed seconds from session start), but stored as UTC ms from a reference point. We need to distinguish the two modes at display time.

### Display Logic

On the client, when rendering a note's timestamp:

```js
function displayTimestamp(note, session) {
  if (session.timestamp_mode === 'timer') {
    // Elapsed seconds from session start
    const elapsedMs = note.timestamp - sessionStartMs;
    return formatDuration(elapsedMs / 1000);
  } else {
    // Clock mode: convert UTC ms to local HH:MM:SS
    const localDate = new Date(note.timestamp);
    return formatLocalTime(localDate);
  }
}
```

### Export Logic

Exports (CSV, EDL, Audition) need to output in the session's "reference timezone." Since we don't store timezone info, we convert the UTC ms to the **export requester's local time** (or we could add a session-level timezone field later). For now, server-side export uses UTC for consistency — the export consumer can adjust.

Actually, for exports the simplest approach: convert UTC ms to seconds-since-local-midnight for the server's timezone. This preserves the current export behavior for single-timezone setups. Multi-timezone export is a known limitation that can be addressed later.

---

## Implementation Steps

### Step 1: Schema Migration

**File:** `db.js`

- Add migration to add `timestamp_ms` column (`INTEGER`) to `notes` table
- Migrate existing `timestamp` (seconds-since-UTC-midnight) → `timestamp_ms` (UTC ms)
  - For each existing note: reconstruct the UTC date from seconds-since-midnight + the session's `started_at` or `created_at` as the reference date
  - If the note's timestamp is < 86400 (24 hours), treat as seconds-since-midnight
  - If the note's timestamp is >= 86400 and < 1000000000000, treat as seconds → multiply by 1000 to get ms (timer mode data)
  - Heuristic: if `timestamp_mode = 'timer'`, the value is elapsed seconds → store as `session.started_at.getTime() + (timestamp * 1000)`
  - If `timestamp_mode = 'clock'`, the value is UTC seconds-since-midnight → reconstruct full UTC ms using `created_at` date
- After migration, rename `timestamp` → `timestamp_ms` (or drop old column)
- Update schema in `CREATE TABLE` to use `INTEGER` instead of `REAL`

**Risk:** Data loss if migration heuristic is wrong. Mitigation: keep old `timestamp` column until verified, then drop in a follow-up.

### Step 2: Server-Side Changes

**File:** `server.js`

- `formatDuration()`: unchanged (still takes seconds, outputs HH:MM:SS.mmm)
- `timeToHmsf()`: unchanged (takes seconds, outputs timecode)
- Export endpoints: convert `timestamp_ms` to appropriate format
  - For clock mode: `new Date(note.timestamp_ms).toLocaleTimeString()` or convert to seconds-since-midnight in server's timezone
  - For timer mode: `(note.timestamp_ms - sessionStartMs) / 1000` → seconds → `formatDuration()`
- REST API `POST /api/sessions/:id/notes`: accept `timestamp` as UTC ms (document this)
- WebSocket `CREATE_NOTE`: same, pass through `timestamp` (now ms)

### Step 3: Client-Side Changes

**File:** `public/app.js`

- Remove `getSecondsSinceMidnight()` entirely
- Note creation: send `Date.now()` (UTC ms) for clock mode
- Timer mode: send `session.started_at.getTime() + (elapsedSeconds * 1000)`
- `formatDuration()`: unchanged (still formats seconds → HH:MM:SS)
- Display logic: new `displayTimestamp(note, session)` function
  - Clock mode: `new Date(note.timestamp)` → local time components → `HH:MM:SS`
  - Timer mode: `(note.timestamp - sessionStartMs) / 1000` → `formatDuration()`
- Draft timestamp capture: use `Date.now()` for clock mode
- Session clock display: use elapsed time from `started_at` (already works)
- `compareTimestamps()`: works with ms values (same logic, just larger numbers)

### Step 4: Database Layer

**File:** `notes.js`

- Column name changes from `timestamp` to `timestamp_ms` in SQL queries
- Pass-through behavior unchanged (no transformation needed)

**File:** `sessions.js`

- No changes needed (`started_at`/`stopped_at` already ISO strings)

### Step 5: Export Endpoints

**File:** `server.js` (export routes)

- REAPER CSV: convert `timestamp_ms` → seconds-since-midnight (server local time) → `formatDuration()`
- EDL: same conversion → `timeToHmsf()`
- Audition: same conversion → `formatDuration()`
- Add `timezone` query parameter for future use (optional, not required now)

### Step 6: Tests

**Files:** `test/timestamp_logic.test.js`, `test/timecode.test.js`, all other tests

- Update all test data to use UTC ms instead of seconds
- Add tests for:
  - Multi-timezone display (mock different timezones)
  - DST transition handling
  - Migration correctness (seconds → ms conversion)
  - Export format preservation
- Update existing assertions that check `note.timestamp` values

### Step 7: Documentation

**Files:** `README.md`, `SECURITY.md`

- Update timestamp documentation to explain the new model
- Note that exports use server's local timezone
- Update API documentation for the `timestamp` field (now UTC ms)

---

## Migration Strategy

### Phase 1: Dual-Column Migration (Safe)
1. Add `timestamp_ms INTEGER` column
2. Migrate data from `timestamp` → `timestamp_ms` using heuristic
3. Update all code to read/write `timestamp_ms`
4. Keep `timestamp` column (read-only) for verification
5. Run tests against both columns to verify parity

### Phase 2: Cleanup (Follow-up)
1. Drop old `timestamp` column
2. Update schema to remove old column
3. Remove migration code from `initDb()`

---

## Migration Heuristic Details

For existing notes, determine the original format:

```js
function migrateTimestamp(note, session) {
  const raw = note.timestamp; // Current REAL value
  
  if (session.timestamp_mode === 'timer') {
    // Value is elapsed seconds from session start
    const sessionStartMs = new Date(session.started_at).getTime();
    return sessionStartMs + (raw * 1000);
  } else {
    // Value is UTC seconds-since-midnight
    // Reconstruct using the note's created_at date
    const createdDate = new Date(note.created_at);
    const utcMs = (raw * 1000); // seconds → ms
    // Add the date portion from created_at
    const year = createdDate.getUTCFullYear();
    const month = createdDate.getUTCMonth();
    const day = createdDate.getUTCDate();
    return new Date(Date.UTC(year, month, day, 0, 0, 0)).getTime() + utcMs;
  }
}
```

**Edge cases:**
- Notes created before `started_at` was implemented (SquadCast sessions without `started_at`) → use `created_at` as reference
- Notes with timestamp > 86400 in clock mode → likely already ms or a data error; flag for manual review
- Timer mode notes with no `started_at` → use session `created_at` as reference

---

## Acceptance Criteria

- [ ] Notes created in London display correct local time for London users
- [ ] Notes created in New York display correct local time for New York users
- [ ] Notes from both timezones sort in correct chronological order when viewed together
- [ ] Timer mode displays elapsed seconds (unchanged behavior)
- [ ] CSV export produces same HH:MM:SS.mmm format as before
- [ ] EDL export produces valid timecodes
- [ ] All existing tests pass (updated for new format)
- [ ] Migration correctly converts existing data (verified against sample datasets)
- [ ] No regressions in WebSocket real-time sync
- [ ] Guest link access works with new timestamp format

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Data loss during migration | Dual-column approach; keep old column until verified |
| Export format changes | Preserve HH:MM:SS.mmm output; server timezone as reference |
| Timer mode breakage | Timer mode logic is separate; test independently |
| Existing integrations (SquadCast) | `started_at`/`stopped_at` unchanged; no impact |
| Test suite overhaul | Large test update; run incrementally per step |

---

## Effort Estimate

| Step | Effort |
|------|--------|
| Schema migration | ~45 min |
| Server changes | ~30 min |
| Client changes | ~45 min |
| Export endpoints | ~20 min |
| Test updates | ~45 min |
| Documentation | ~15 min |
| **Total** | **~3.5 hours** |

---

## Files to Modify

- `db.js` — schema + migration
- `server.js` — export logic, API handling
- `public/app.js` — timestamp creation, display, comparison
- `notes.js` — column name updates
- `test/timestamp_logic.test.js` — rewrite for new model
- `test/timecode.test.js` — update test data
- `test/*.test.js` — all tests with timestamp assertions
- `README.md` — documentation update
- `SECURITY.md` — mark timestamp issue as fixed
