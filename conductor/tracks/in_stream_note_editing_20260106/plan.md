# Plan: In-Stream Note Editing

## Phase 1: Backend API Support
- [x] Task: Create `updateNote` function in `notes.js` to modify the `content` of a note [644dd4b]
- [x] Task: Implement `PATCH /api/sessions/:session_id/notes/:note_id` endpoint in `server.js` [9cd3a14]
- [x] Task: Write unit tests in `test/notes_api.test.js` for the update functionality [9cd3a14]
- [~] Task: Conductor - User Manual Verification 'Backend API Support' (Protocol in workflow.md)

## Phase 2: Frontend "Edit Mode" Foundations
- [x] Task: Add "Edit" icon/button to the note template in `public/app.js` (initially hidden) [ce74795]
- [x] Task: Implement CSS in `public/index.html` for note hovering and action button positioning [ce74795]
- [x] Task: Implement `toggleEditMode` in `public/app.js` to swap static text with a `<textarea>` [ce74795]
- [~] Task: Conductor - User Manual Verification 'Frontend "Edit Mode" Foundations' (Protocol in workflow.md)

## Phase 3: Editor Behavior & Saving [checkpoint: bac2b39]
- [x] Task: Implement auto-expanding logic for the `<textarea>` based on content length [ce74795]
- [x] Task: Add event listeners for `Enter` (save), `Shift+Enter` (newline), `Escape` (cancel), and `blur` (cancel) [ce74795]
- [x] Task: Implement `saveEdit` function in `public/app.js` to call the PATCH API and update the UI [ce74795]
- [x] Task: Conductor - User Manual Verification 'Editor Behavior & Saving' (Protocol in workflow.md) [bac2b39]

## Phase 4: Mobile & Final Polish
- [~] Task: Add tap-to-reveal logic for the Edit button on mobile devices
- [ ] Task: Refine icon button styling for accessibility and "clean & minimalist" guidelines
- [ ] Task: Final end-to-end testing of the full edit lifecycle
- [ ] Task: Conductor - User Manual Verification 'Mobile & Final Polish' (Protocol in workflow.md)
