# Specification: Fix Session Switching Note Concatenation

## 1. Overview
This track addresses a UI bug where switching between active sessions results in the notes from the newly selected session being appended to the existing list, rather than replacing them. The expected behavior is for the notes view to clear completely before displaying the notes for the new session.

## 2. Problem Description
Currently, when a user selects a different session from the "Active Sessions" list (or equivalent UI element), the application fetches the new notes and appends them to the DOM. It fails to remove the notes from the previously selected session, leading to a confusing, concatenated list of notes from multiple sessions.

### Reproduction Steps
1. Open the application and ensure at least two sessions exist with distinct notes.
2. Select **Session A**. Observe that the notes for Session A are displayed.
3. Select **Session B**.
4. **Observe the Bug:** The notes for Session B appear *below* the notes for Session A, instead of replacing them.

## 3. Proposed Solution
The frontend logic responsible for handling session switching and rendering notes needs to be updated. Specifically, the container element holding the note items must be cleared (e.g., `innerHTML = ''` or removing all child nodes) immediately before or during the process of rendering the fetched notes for the new session.

## 4. Acceptance Criteria
- [ ] **Clean Switch:** When switching from Session A to Session B, all notes from Session A are removed from the view.
- [ ] **Correct Content:** Only the notes belonging to the currently selected session are visible.
- [ ] **No Flickering (Optional but good):** Ideally, the transition is smooth, but the priority is correctness.
- [ ] **Verification:** Switching back and forth between sessions consistently shows the correct, isolated set of notes for each session.

## 5. Technical Considerations
- **File:** Likely `public/app.js` or the main client-side script.
- **Function:** Look for the event handler for session clicks or the function responsible for rendering notes (e.g., `renderNotes()`, `loadSession()`).
