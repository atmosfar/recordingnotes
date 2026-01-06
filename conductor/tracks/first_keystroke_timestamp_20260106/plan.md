# Plan: "First-Keystroke" Timestamp Capture

## Phase 1: Frontend Logic & State Management
- [x] Task: Add `activeDraftTimestamp` and `draftResetTimeout` variables to `public/app.js`
- [x] Task: Create a `captureDraftTimestamp` helper function to handle the locking logic
- [x] Task: Implement an `onInput` event listener for `#note-input` to trigger capture and handle the 100ms grace period for clearing
- [x] Task: Update `sendNote` to use the `activeDraftTimestamp` if available, and clear the state after successful submission
- [~] Task: Conductor - User Manual Verification 'Frontend Logic & State Management' (Protocol in workflow.md)

## Phase 2: UI Implementation [checkpoint: c812f94]
- [x] Task: Add a `#draft-timestamp-display` element to `public/index.html` near the note input [c812f94]
- [x] Task: Style the display element in `public/index.html` to be subtle and minimalist [c812f94]
- [x] Task: Update `public/app.js` to show/hide and update the content of `#draft-timestamp-display` based on the draft state [c812f94]
- [x] Task: Conductor - User Manual Verification 'UI Implementation' (Protocol in workflow.md) [c812f94]

## Phase 3: Integration & Testing
- [~] Task: Write manual verification steps to test the 500ms grace period behavior
- [ ] Task: Verify that both "Elapsed Timer" and "Time-of-Day" modes work correctly with the new capture logic
- [ ] Task: Conductor - User Manual Verification 'Integration & Testing' (Protocol in workflow.md)
