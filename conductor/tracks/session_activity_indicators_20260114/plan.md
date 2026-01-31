# Plan: Session Activity Indicators & Prioritization

## Phase 1: Server-Side Data Augmentation [checkpoint: ad09a5a]
- [x] Task: Add `active_users` count logic to `server.js`.
- [x] Task: Trigger session list broadcasts on connection changes (join/leave/close).

## Phase 2: Frontend Sorting & UI
- [x] Task: Refactor `renderSessionList` in `public/app.js` to implement prioritized sorting. [2cab790]
- [x] Task: Update session item template in `public/app.js` to show recording dot and user count. [2cab790]
- [x] Task: Add CSS for indicators in `public/style.css`. [2cab790]
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Frontend Sorting & UI' (Protocol in workflow.md)

## Phase 3: Final Verification
- [ ] Task: Verify real-time list re-ordering across multiple browser sessions.
- [ ] Task: Verify indicator accuracy during recording start/stop.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Final Verification' (Protocol in workflow.md)
