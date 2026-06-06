# Plan: Chronological Note Sorting

## Phase 1: Logic & Unit Tests [checkpoint: 235df61]
- [x] Task: Write a utility function in `public/app.js` (or a helper module) to compare two timestamps, including midnight wrap-around detection (> 12h difference). [235df61]
- [x] Task: Create a unit test file `test/timestamp_logic.test.js` to verify the comparison heuristic with various scenarios (sequential, out-of-order, midnight cross). [235df61]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Logic & Unit Tests' (Protocol in workflow.md) [235df61]

## Phase 2: Frontend Refactoring (Smart Insertion) [checkpoint: a346b3b]
- [x] Task: Modify `renderNotes` in `public/app.js` to find the correct insertion index for each note using the new comparison logic. [a346b3b]
- [x] Task: Replace `appendChild` with `insertBefore` logic to ensure notes are added at the correct chronological position. [a346b3b]
- [x] Task: Verify that initial session load (bulk notes) results in a perfectly sorted list. [a346b3b]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Frontend Refactoring' (Protocol in workflow.md) [a346b3b]

## Phase 3: Real-Time & Edge Case Verification [checkpoint: 0a5d8a3]
- [x] Task: Verify that WebSocket note pushes appearing out of order (simulated) are inserted correctly. [0a5d8a3]
- [x] Task: Verify that midnight wrap-around notes (e.g., 23:59:59 and 00:00:01) are sorted correctly in the UI. [0a5d8a3]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Real-Time & Edge Case Verification' (Protocol in workflow.md) [0a5d8a3]
