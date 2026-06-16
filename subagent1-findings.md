# Bug Verification Findings

## Files Reviewed
1. `/Users/botoole/shel/recordingnotes/public/app.js` (1331 lines)
2. `/Users/botoole/shel/recordingnotes/notes.js` (29 lines)
3. `/Users/botoole/shel/recordingnotes/db.js` (61 lines)
4. `/Users/botoole/shel/recordingnotes/sessions.js` (37 lines)

---

## Claim 1 — Bug: `displayTimestamp` uses `Date.now()` instead of `note.timestamp_ms`

### Verdict: REJECTED — Not a real bug

The `displayTimestamp` function at **app.js lines 131–158** correctly uses `note.timestamp_ms` throughout. It never calls `Date.now()`.

**Evidence — the full function (app.js, line 131):**
```javascript
function displayTimestamp(note, session) {
    const ts = note.timestamp_ms;                  // ← reads note.timestamp_ms
    if (!session) return formatDuration(ts / 1000, 1);

    if (session.timestamp_mode === 'timer') {
        const elapsedMs = session.elapsed_ms || 0;
        const sessionStartMs = session.started_at ? new Date(session.started_at).getTime() : 0;
        if (!sessionStartMs) {
            // fall back to clock display
            const localDate = new Date(ts);         // ← uses ts (note.timestamp_ms)
            const hrs = localDate.getHours();
            const mins = localDate.getMinutes();
            const secs = localDate.getSeconds() + localDate.getMilliseconds() / 1000;
            const totalSeconds = (hrs * 3600) + (mins * 60) + secs;
            return formatDuration(totalSeconds, 1);
        }
        const totalMs = elapsedMs + (ts - sessionStartMs);  // ← uses ts (note.timestamp_ms)
        return formatDuration(totalMs / 1000, 1);
    } else {
        // Clock mode
        const localDate = new Date(ts);             // ← uses ts (note.timestamp_ms)
        const hrs = localDate.getHours();
        const mins = localDate.getMinutes();
        const secs = localDate.getSeconds() + localDate.getMilliseconds() / 1000;
        const totalSeconds = (hrs * 3600) + (mins * 60) + secs;
        return formatDuration(totalSeconds, 1);
    }
}
```

Every code path uses `ts` which is assigned from `note.timestamp_ms` on line 132. There is no `Date.now()` call anywhere in this function.

---

## Claim 2 — Bug: `listNotesBySession` orders by `created_at` instead of `timestamp_ms`

### Verdict: CONFIRMED — This is a real bug

**Evidence — notes.js, lines 7–12:**
```javascript
export function listNotesBySession(db, session_id) {
  const stmt = db.prepare(`
    SELECT * FROM notes 
    WHERE session_id = ? 
    ORDER BY created_at ASC
  `);
  return stmt.all(session_id);
}
```

The `ORDER BY created_at ASC` sorts notes by database insertion time, not by `timestamp_ms` (the recording position). If notes are inserted out of sequence (e.g., a WebSocket delay causes a later note to arrive first), they will be returned in the wrong order.

**Fix:** Change `ORDER BY created_at ASC` to `ORDER BY timestamp_ms ASC`.

---

## Claim 3 — Architectural Risk: `Object.keys(updates)` in `updateSession` is SQL injection risk

### Verdict: CONFIRMED — This is a real risk (column-name injection, not value injection)

**Evidence — sessions.js, lines 23–28:**
```javascript
export function updateSession(db, id, updates) {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = fields.map(field => `${field} = ?`).join(', ');
  const stmt = db.prepare(`UPDATE sessions SET ${setClause} WHERE id = ?`);
  return stmt.run(...values, id);
}
```

**Analysis:**
- The *values* are safely parameterized via `?` placeholders, so value-based SQL injection is not possible.
- However, the *column names* (from `Object.keys(updates)`) are interpolated directly into the SQL string without any whitelist or sanitization. If `updates` is derived from user input (e.g., from a WebSocket message body), an attacker could inject arbitrary SQL via column names.

**Example attack vector:** If `updates` were `{"name": "X"; DROP TABLE notes;--": 1}`, the resulting SQL would be:
```sql
UPDATE sessions SET name; DROP TABLE notes;-- = ? WHERE id = ?
```

Even though the value is parameterized, the column name injection could corrupt the query or, with more clever payloads, execute arbitrary SQL.

**Fix:** Whitelist allowed fields:
```javascript
const ALLOWED_FIELDS = ['name', 'timestamp_mode', 'external_id', 'guest_token', 'status', 'started_at', 'stopped_at', 'elapsed_ms'];
const fields = Object.keys(updates).filter(f => ALLOWED_FIELDS.includes(f));
```

---

## Claim 4 — Architectural Risk: `db.js` singleton and redundant initialization

### Verdict: PARTIALLY CONFIRMED — Minor redundancy, not a bug

**Evidence — db.js, lines 11–18 and 20–25:**
```javascript
function createDbInstance() {
  if (!dbInstance) {
    const dbPath = getDbPath();
    mkdirSync(dirname(dbPath), { recursive: true });
    dbInstance = new DatabaseSync(dbPath);
  }
  return dbInstance;
}

export function getDb() {
  const dbPath = getDbPath();
  if (!initializedPaths.has(dbPath)) {
    initDb();
  }
  return createDbInstance();
}
```

And `initDb()` (lines 31–32):
```javascript
export function initDb() {
  const dbPath = getDbPath();
  if (initializedPaths.has(dbPath)) return;  // ← early return if already initialized
  ...
}
```

**Analysis:**
- `getDb()` calls `initDb()` which internally checks `initializedPaths.has(dbPath)` again. After the first call, `getDb()` still calls `initDb()` on every invocation, but `initDb()` returns immediately on line 32. This is redundant but harmless — it's a no-op after first initialization.
- `createDbInstance()` also has its own guard (`if (!dbInstance)`), so `DatabaseSync` is only instantiated once.
- The `initializedPaths` Set is overkill for a single-path application (there's only one `dbPath`), but it does provide safety if the config changes between calls.
- The `resetDbInstance()` function (line 28) suggests the Set is intended to support re-initialization scenarios (e.g., tests), which is a legitimate use case.

**Verdict:** The code works correctly. The redundancy is minor and the `initializedPaths` Set, while arguably over-engineered for production use, is not a bug. No fix needed unless code simplicity is a priority.

---

## Additional Bugs Found

### XSS Vulnerability in `renderModalTags` (app.js, lines 1049–1067)

**Evidence:**
```javascript
const renderModalTags = () => {
    const list = document.getElementById('modal-tags-list');
    if (!list) return;
    list.setAttribute('role', 'list');
    list.innerHTML = '';
    tagManager.getTags().forEach(tag => {
        const item = document.createElement('div');
        item.className = 'modal-tag-item';
        item.setAttribute('role', 'listitem');
        item.innerHTML = `
            <span>${tag}</span>
            <button class="delete-tag-btn" title="Delete tag" aria-label="Delete tag: ${tag}">×</button>
        `;
        // ...
    });
};
```

The `tag` variable (loaded from `localStorage` via `tagManager.getTags()`) is interpolated directly into `innerHTML` without escaping. If a malicious tag name containing HTML/JS is stored in `localStorage` (e.g., `<img src=x onerror=alert(1)>`), it will execute.

**Severity:** Medium — requires the attacker to get a malicious string into `localStorage`, but tags are user-editable via the "Add Tag" input, so this is a self-XSS vector that could escalate if combined with other vectors.

**Fix:** Use `textContent` instead of `innerHTML`:
```javascript
const span = document.createElement('span');
span.textContent = tag;
item.appendChild(span);
const btn = document.createElement('button');
btn.className = 'delete-tag-btn';
btn.textContent = '×';
btn.title = 'Delete tag';
btn.setAttribute('aria-label', `Delete tag: ${tag}`);
item.appendChild(btn);
```

---

### Summary Table

| # | Claim | Verdict | Severity |
|---|-------|---------|----------|
| 1 | `displayTimestamp` uses `Date.now()` | **REJECTED** | N/A |
| 2 | `listNotesBySession` orders by `created_at` | **CONFIRMED** | Medium (notes appear out of order) |
| 3 | `updateSession` column-name injection | **CONFIRMED** | High (SQL injection via column names) |
| 4 | `db.js` redundant initialization | **PARTIALLY CONFIRMED** | Low (cosmetic, not a bug) |
| — | `renderModalTags` XSS | **NEW FINDING** | Medium (stored XSS via tags) |
