# Plan: Quick Tags & Snippets

## Phase 1: UI Structure & Styling [checkpoint: 610faea]
- [x] Task: Add the Quick Tag bar container and Management Modal to `public/index.html`. [245ab7c]
- [x] Task: Add styles for the scrollable tag bar and management modal in `public/style.css`. [537c496]
- [x] Task: Implement basic "Hide for Guests" logic in CSS/HTML. [5d2b658]
- [x] Task: Conductor - User Manual Verification 'Phase 1: UI Structure & Styling' (Protocol in workflow.md)

## Phase 2: Tag Management Logic
- [x] Task: Write tests for `TagManager` logic (LocalStorage initialization, add, remove). [c2e4713]
- [x] Task: Implement `TagManager` in `public/app.js` to handle `localStorage` persistence. [3afeefa]
- [~] Task: Implement modal interaction logic (opening, rendering tag list, adding/deleting tags).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Tag Management Logic' (Protocol in workflow.md)

## Phase 3: Integration & Interaction
- [ ] Task: Write integration tests for Quick Tag clicks (mocking `socket.send`).
- [ ] Task: Implement click handlers for tag buttons to trigger `CREATE_NOTE` events.
- [ ] Task: Integrate tag rendering into the session selection flow (ensure tags appear when a session is active).
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Integration & Interaction' (Protocol in workflow.md)

## Phase 4: Final Polishing
- [ ] Task: Verify horizontal scrolling behavior on mobile screen sizes.
- [ ] Task: Verify that custom tags persist correctly after page reloads.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Final Polishing' (Protocol in workflow.md)
