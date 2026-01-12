# Plan: Bug Fix - Non-existent Session Handling

## Phase 1: CSS & UI Scaffolding [checkpoint: 52795a2]
- [x] Task: Rename `body.recording` to `body.current-session-status` and introduce CSS variables for status colors. [9c670ed]
- [x] Task: Create a new CSS class for the "Not Found" state (solid yellow bar). [efe34d7]
- [x] Task: Conductor - User Manual Verification 'Phase 1: CSS & UI Scaffolding' (Protocol in workflow.md) [52795a2]

## Phase 2: Core Logic & Error Handling
- [~] Task: Write Tests for `selectSession` to handle 404 responses from the server.
- [ ] Task: Implement 404 error handling in `selectSession` to trigger the "Not Found" UI state.
- [ ] Task: Implement the "Session not found" message in the note stream and hide the input area when in the "Not Found" state.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Logic & Error Handling' (Protocol in workflow.md)

## Phase 3: WebSocket & Polling Refactoring
- [ ] Task: Write Tests for event-driven UI updates (recording status changes via WebSockets).
- [ ] Task: Refactor `updateRecordingState` to be event-driven and remove the `setInterval` high-frequency polling.
- [ ] Task: Ensure the live clock only runs during an active recording session.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: WebSocket & Polling Refactoring' (Protocol in workflow.md)

## Phase 4: Verification & Cleanup
- [ ] Task: Verify that a valid recording session still shows a solid red bar and updates correctly via WebSockets.
- [ ] Task: Verify that a non-existent session ID shows a solid yellow bar and "Session not found." message.
- [ ] Task: Final end-to-end testing across different browsers/tabs.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Verification & Cleanup' (Protocol in workflow.md)
