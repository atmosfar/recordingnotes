# Plan: Highlight Active Session in Sidebar from URL

## Phase 1: Implementation
- [ ] Task: Update `public/app.js` to ensure robust comparison in `renderSessionList` by converting IDs to strings.
- [ ] Task: Add logic to `renderSessionList` to scroll the active session item into view.
- [ ] Task: Ensure `currentSessionId` is set early during the initial load to trigger the highlight.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Implementation' (Protocol in workflow.md)

## Phase 2: Verification
- [ ] Task: Manually verify deep-linking with long and short session lists.
- [ ] Task: Manually verify highlight consistency after creating a new session.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Verification' (Protocol in workflow.md)
