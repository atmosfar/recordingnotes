# Mobile Note Actions UX — Current Implementation

## User Flow

1. **Long-press a note** (500ms) → enters editing mode: content becomes textarea, Save/Cancel/Delete buttons appear
2. **Tap Save** → changes saved, note returns to plaintext, buttons hidden
3. **Tap Cancel** → changes discarded, note returns to original plaintext, buttons hidden
4. **Tap Delete** → Delete button changes to "Confirm Del." (confirm guard)
5. **Tap Confirm Del.** → note removed from stream
6. **Tap Save or Cancel** (after Delete) → returns to plaintext, Delete resets, buttons hidden

## Architecture

### Single state class: `.editing`
- Added when long-press triggers edit mode
- Removed when Save/Cancel/Delete completes
- CSS handles all button visibility — zero inline `style.display` toggling

### Delete confirm guard: `.delete-confirm`
- Added when Delete is first pressed (hides Delete, shows "Confirm Del.")
- Removed when exiting edit mode

### Long-press detection
- `touchstart` → start 500ms timer
- `touchmove` / `touchend` → cancel timer
- Timer fires → `toggleEditMode(noteEl, true)`
- Also handles `mousedown`/`mouseup`/`mousemove` for desktop testing
- Skips if already editing, if innerWidth > 768, or if target is inside `.note-actions`

### Button layout (all in `.note-actions`)
```
.note-actions
  ├─ .edit-btn (✎)          — visible idle, hidden during editing
  ├─ .delete-btn (🗑)        — visible idle, hidden during editing, hidden by .delete-confirm
  ├─ .save-btn (✓)           — hidden by default, shown during editing
  ├─ .cancel-btn (✕)         — hidden by default, shown during editing
  └─ .confirm-del-btn        — hidden by default, shown by .delete-confirm
```

### CSS state machine
| State | `.editing` | `.delete-confirm` | Visible buttons |
|-------|-----------|-------------------|-----------------|
| Idle | — | — | edit, delete |
| Editing | ✓ | — | save, cancel |
| Delete pending | ✓ | ✓ | save, cancel, confirm-del |

### Mobile vs Desktop
- **Desktop**: hover shows `.note-actions` (opacity toggle). Long-press disabled.
- **Mobile**: `.note-actions` hidden by default (`display: none`). Shown only when `.editing` (`display: flex`).
