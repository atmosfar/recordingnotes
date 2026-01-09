# Plan: Highlight Active Session in Sidebar from URL

## Phase 1: Implementation
- [x] Task: Update `public/app.js` to ensure robust comparison in `renderSessionList` by converting IDs to strings. [0b7fe0b]
- [x] Task: Add logic to `renderSessionList` to scroll the active session item into view. [0b7fe0b]
- [x] Task: Ensure `currentSessionId` is set early during the initial load to trigger the highlight. [0b7fe0b]
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Implementation' (Protocol in workflow.md)

## Phase 2: Verification
- [ ] Task: Manually verify deep-linking with long and short session lists.
- [ ] Task: Manually verify highlight consistency after creating a new session.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Verification' (Protocol in workflow.md)
