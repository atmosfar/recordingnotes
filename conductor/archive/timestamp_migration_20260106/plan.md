# Plan: Millisecond Timestamp Migration (REAL)

## Phase 1: Database & Schema Reset [checkpoint: 2bf7542]
- [x] Task: Update `db.js` to define `notes.timestamp` as `REAL` [a9a2d96]
- [x] Task: Create a script/command to delete `dev.db` and re-run `initDb()` [a9a2d96]
- [x] Task: Update `test/schema.test.js` to verify the `REAL` column type [a9a2d96]
- [x] Task: Conductor - User Manual Verification 'Database & Schema Reset' (Protocol in workflow.md) [2bf7542]

## Phase 2: Client-Side Refactor [checkpoint: 838b132]
- [x] Task: Refactor `formatDuration` in `public/app.js` to support variable precision (`.s` vs `.mmm`) [25d7802]
- [x] Task: Update `sendNote` in `public/app.js` to calculate and send timestamps as floats [25d7802]
- [x] Task: Update `updateClock` and `renderNotes` in `public/app.js` to show 0.1s precision [25d7802]
- [x] Task: Increase `updateClock` interval to 100ms [25d7802]
- [x] Task: Conductor - User Manual Verification 'Client-Side Refactor' (Protocol in workflow.md) [838b132]

## Phase 3: Server-Side Export & Final Integration [checkpoint: e4d3e36]
- [x] Task: Implement a time-formatting utility in `server.js` (or shared helper) for CSV export [5516ca8]
- [x] Task: Update `GET /api/sessions/:id/export` to format `REAL` seconds into `HH:MM:SS.mmm` [5516ca8]
- [x] Task: Update `test/export.test.js` to verify high-precision CSV output [5516ca8]
- [x] Task: Conductor - User Manual Verification 'Server-Side Export & Final Integration' (Protocol in workflow.md) [e4d3e36]
