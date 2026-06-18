# Client-Side Refactor Plan

**Goal:** Break `public/app.js` (1,775 lines, single monolithic file) into smaller, focused modules that are easier to parse, debug, and maintain — without introducing a build step.

## Current State

`public/app.js` is a single vanilla-JS file loaded via `<script src="app.js">`. It contains:

| Concern | Approx. Lines | Description |
|---|---|---|
| Global state | ~10 | `currentSessionId`, `selectedColor`, etc. |
| `TagManager` class | ~50 | CRUD + localStorage persistence for quick tags |
| `SocketManager` class | ~80 | WebSocket connect/reconnect/pub-sub abstraction |
| Utility functions | ~80 | `formatDuration`, `compareTimestamps`, `displayTimestamp` |
| Draft timestamp | ~40 | Capture/display logic for pending note timestamps |
| UI state management | ~40 | `updateRecordingState`, input placeholder logic |
| Clock/timer display | ~60 | `updateClock`, the 100ms interval ticker |
| Timer controls | ~80 | `startTimer`, `stopTimer`, `resetTimer`, warning modal |
| Session list rendering | ~130 | `renderRecentSessions`, `renderSessionList` |
| Session CRUD | ~40 | `renameSession`, `deleteSession`, `selectSession` |
| Note rendering | ~120 | `renderNotes` — DOM creation, sorting, insertion |
| Note editing | ~80 | `toggleEditMode`, `saveEdit`, `deleteNote`, `autosizeEditArea` |
| Note sending | ~30 | `sendNote` |
| Color picker | ~20 | `updateColorSelection`, `toggleColorPicker` |
| Sidebar/modals | ~60 | `closeSidebarFn`, modal toggle functions |
| `init()` function | ~400 | Event binding, DOM setup, inline event handlers |
| WebSocket listeners | ~150 | `socket.on('SESSION_DATA')`, `NOTE_UPDATE`, etc. |
| Hash routing | ~20 | `hashchange` handler |

**Problems:**
- All code in global scope — no encapsulation
- `init()` is a 400-line function that mixes DOM queries, event binding, and inline logic
- WebSocket event handlers are buried inside `init()` as closures
- Hard to grep for a specific feature (e.g., "how does timer reset work?")
- No clear separation between data logic, UI rendering, and event wiring
- Testing individual units is impossible

## Constraints

- **No build step.** The project ships as an npm package with zero dependencies beyond Express/WS. Introducing Vite/esbuild/webpack adds complexity that outweighs the benefit.
- **Vanilla JS only.** No React, Vue, Svelte, or framework overhead.
- **Backward compatible.** The refactor must produce the same runtime behavior.
- **Module-friendly.** Use ES modules (`<script type="module">`) so we can use `import`/`export` natively in modern browsers.

## Target Architecture

```
public/
├── index.html              # Updated to use <script type="module" src="app/index.js">
├── app/
│   ├── index.js            # Entry point: imports modules, calls init()
│   ├── state.js            # Global state + accessors
│   ├── socket.js           # SocketManager class
│   ├── tags.js             # TagManager class
│   ├── utils.js            # formatDuration, compareTimestamps, displayTimestamp
│   ├── timer.js            # Timer controls + clock display
│   ├── sessions.js         # Session list rendering + CRUD
│   ├── notes.js            # Note rendering, editing, sending
│   ├── ui.js               # Modals, sidebar, color picker, theme toggle
│   ├── events.js           # WebSocket event handlers (socket.on(...))
│   └── dom.js              # DOM event binding (click handlers, keyboard, etc.)
├── style.css
├── qr-creator.min.js
└── login.html
```

## Phased Plan

### Phase 1: Extract Utilities and Classes (Low Risk)

**Files:** `utils.js`, `socket.js`, `tags.js`, `state.js`

These are the easiest to extract because they have minimal DOM coupling and clear boundaries.

1. **`state.js`** — Extract global variables into a single exported object:
   ```js
   export const state = {
       currentSessionId: null,
       currentSession: null,
       selectedColor: "",
       sessionSearchFilter: "",
       activeDraftTimestamp: null,
       draftResetTimeout: null,
       lastManualNoteContent: null,
       clientRunStart: null,
   };
   ```
   All other modules import `state` instead of referencing globals.

2. **`utils.js`** — Extract pure functions:
   - `formatDuration(seconds, precision)`
   - `compareTimestamps(t1, t2)`
   - `displayTimestamp(note, session)` — depends on `formatDuration`

3. **`socket.js`** — Extract `SocketManager` class as-is (it's already a clean class). Export the singleton instance.

4. **`tags.js`** — Extract `TagManager` class as-is. Export the singleton instance.

**Validation:** After this phase, run the app and verify WebSocket connects, tags persist, and timestamps display correctly. Nothing visual should change.

### Phase 2: Extract Rendering Logic (Medium Risk)

**Files:** `sessions.js`, `notes.js`, `timer.js`

These contain the DOM manipulation heavy-lifting but no event binding.

5. **`sessions.js`** — Extract session-related rendering and CRUD:
   - `renderRecentSessions(sessions)`
   - `renderSessionList(sessions)`
   - `renameSession(id, oldName)`
   - `deleteSession(id)`
   - `selectSession(id)`
   - `updateSessionMenuVisibility()`

   Imports: `state`, `socket`, `utils`

6. **`notes.js`** — Extract note-related rendering and operations:
   - `renderNotes(notes)`
   - `toggleEditMode(noteEl, editing)`
   - `autosizeEditArea(ta)`
   - `saveEdit(noteEl)`
   - `showDeleteConfirm(noteEl)`
   - `deleteNote(noteEl)`
   - `sendNote()`
   - `captureDraftTimestamp()`
   - `updateDraftDisplay()`
   - `renderQuickTags()`

   Imports: `state`, `socket`, `utils`, `tagManager`

7. **`timer.js`** — Extract timer and clock logic:
   - `updateClock()` (and the `setInterval` call)
   - `updateRecordingState()`
   - `updateTimerMenuVisibility()`
   - `startTimer()`, `stopTimer()`, `resetTimer()`
   - `showTimerResetWarning(message)`

   Imports: `state`, `utils`

**Validation:** After this phase, verify session switching, note creation/editing/deletion, timer start/stop/reset, and clock display all work.

### Phase 3: Extract UI and Event Wiring (Medium Risk)

**Files:** `ui.js`, `events.js`, `dom.js`

8. **`ui.js`** — Extract modal/sidebar/picker/theme management:
   - `closeSidebarFn()`
   - `toggleColorPicker(open)`
   - `updateColorSelection(color)`
   - `toggleOverflow(open)`
   - `toggleExportMenu(open)`
   - `toggleFpsModal(open)`
   - `toggleTagsModal(open)`
   - `toggleShareLinkModal(open, url)`
   - `toggleNewSessionModal(open)`
   - `renderModalTags()`
   - `exportFn(format, fps)`
   - `themeToggleFn(isDark)`

   Imports: `state`, `socket`

9. **`events.js`** — Extract all `socket.on(...)` handlers into a dedicated module:
   ```js
   import { socket } from './socket.js';
   import { state } from './state.js';
   import { renderNotes, renderQuickTags } from './notes.js';
   import { updateClock, updateTimerMenuVisibility } from './timer.js';
   import { renderSessionList, renderRecentSessions } from './sessions.js';
   import { exportFn } from './ui.js';

   export function registerSocketListeners() {
       socket.on('SESSION_DATA', (data) => { /* ... */ });
       socket.on('SESSION_LIST_UPDATE', (data) => { /* ... */ });
       socket.on('SESSION_DELETED', (data) => { /* ... */ });
       socket.on('NOTE_UPDATE', (data) => { /* ... */ });
       socket.on('NOTE_DELETED', (data) => { /* ... */ });
       socket.on('SESSION_STATUS_UPDATE', (data) => { /* ... */ });
       socket.on('SESSION_UPDATE', (data) => { /* ... */ });
       socket.on('ERROR', (data) => { /* ... */ });
   }
   ```

10. **`dom.js`** — Extract all DOM event binding from the massive `init()` function:
    - Click handlers for buttons (new session, send note, sidebar, color picker, export, timer controls, etc.)
    - Keyboard handlers (Esc key, Enter in inputs)
    - Click-outside handlers (close menus/modals)
    - Input handlers (note input, session search, new session name)
    - Hash change listener

    This module should export a single `bindDomEvents()` function.

    Imports: `state`, `socket`, `notes`, `timer`, `ui`, `sessions`

### Phase 4: Assemble Entry Point (Low Risk)

11. **`index.js`** — The new entry point:
    ```js
    import { registerSocketListeners } from './events.js';
    import { bindDomEvents } from './dom.js';

    function init() {
        // Guest mode / hash routing setup (from current init())
        // REST fetch for initial session list
        // Theme init
        registerSocketListeners();
        bindDomEvents();
    }

    init();
    ```

12. **Update `index.html`**:
    ```html
    <!-- Replace: -->
    <script src="app.js"></script>
    <!-- With: -->
    <script type="module" src="app/index.js"></script>
    ```

    The `qr-creator.min.js` stays as a regular script (it exposes a global `QrCreator`).

13. **Delete `app.js`** once everything is verified.

### Phase 5: Cleanup and Polish (Optional)

14. **Remove dead code.** During extraction, identify and remove any unreachable code or redundant logic.

15. **Add JSDoc comments** to exported functions for better IDE support and debugging.

16. **Update `package.json`** `files` array to include the new `public/app/` directory structure.

17. **Consider adding a lint config** (ESLint) to enforce consistent imports and catch unused variables across modules.

## Migration Checklist

- [x] Phase 1: Extract `state.js`, `utils.js`, `socket.js`, `tags.js`
- [x] Phase 2: Extract `sessions.js`, `notes.js`, `timer.js`
- [x] Phase 3: Extract `ui.js`, `events.js`, `dom.js`
- [x] Phase 4: Create `index.js`, update `index.html`
- [ ] Phase 4b: Smoke test the app, then delete `app.js`
- [ ] Phase 5: Cleanup, JSDoc, package.json update

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| ES module CORS issues when served via `file://` | The app is always served via Express (`localhost:3000`), so this is non-issue |
| `qr-creator.min.js` global dependency | Keep it as a regular `<script>` tag; `QrCreator` remains global |
| Import order / circular dependencies | Design imports as a DAG: `utils` ← `state` ← `socket` ← `tags` ← `notes`/`timer`/`sessions` ← `ui` ← `events`/`dom` ← `index` |
| Behavioral regression during extraction | Keep `app.js` alongside the new files until Phase 4 is fully verified. Run manual smoke tests after each phase. |

## Estimated Effort

- **Phase 1:** 1–2 hours (straightforward extraction)
- **Phase 2:** 2–3 hours (DOM logic is bulkier but well-bounded)
- **Phase 3:** 2–3 hours (event wiring is fragmented but mechanical)
- **Phase 4:** 30 minutes (assembly)
- **Phase 5:** 1–2 hours (polish)
- **Total:** ~7–10 hours
