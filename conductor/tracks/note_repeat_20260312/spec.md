# Specification: Empty Input Note Repeat

## Overview
Enhance the note-taking experience by allowing users to quickly repeat the content of their last manually sent note. If the note input field is empty, pressing the Enter key or clicking the Send button will resend the previous note's content at the current timestamp.

## Functional Requirements
- **Repeat Logic:** If `note-input` is empty upon submission (Enter key or click), the system must check for a stored "last note" value.
- **Resend Content:** If a "last note" exists, send a `CREATE_NOTE` event with that content at the current session timestamp.
- **Storage:** Maintain the "last note" content in a local variable in the frontend (`public/app.js`). 
- **Persistence:** This variable is transient and reset upon page refresh.
- **Exclusion:** Clicking Quick Tags or editing existing notes does NOT update the "last note" memory. Only manual text submissions update it.
- **Initial State:** If no notes have been manually sent yet and the input is empty, the submission action should do nothing.

## User Interface
- No visual changes to the UI.
- The interaction relies on existing keyboard (Enter) and mouse (Send button) events.

## Technical Details
- **Frontend Variable:** Introduce a variable (e.g., `lastManualNoteContent`) in `app.js`.
- **Event Handler Update:** Update the `sendNote` function to handle the empty input case by checking `lastManualNoteContent`.
- **Memory Update:** Update `lastManualNoteContent` every time a non-empty manual note is successfully prepared for sending.

## Acceptance Criteria
- [ ] Typing "Check" and pressing Enter sends "Check" and stores it as the last note.
- [ ] Clearing the input and pressing Enter immediately after sends another note with the content "Check".
- [ ] Refreshing the page clears the repeat memory.
- [ ] Clicking a Quick Tag like "#noise" does not change the repeat memory.
- [ ] Pressing Enter on a completely fresh session (no notes sent) with an empty input results in no note being sent.

## Out of Scope
- Visual indicators of what the "last note" is.
- `localStorage` persistence for the repeat memory.
- Repeating Quick Tag clicks.
