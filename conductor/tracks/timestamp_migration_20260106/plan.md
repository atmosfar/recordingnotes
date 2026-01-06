# Plan: Millisecond Timestamp Migration (REAL)

## Phase 1: Database & Schema Reset [checkpoint: 2bf7542]
- [x] Task: Update `db.js` to define `notes.timestamp` as `REAL` [a9a2d96]
- [x] Task: Create a script/command to delete `dev.db` and re-run `initDb()` [a9a2d96]
- [x] Task: Update `test/schema.test.js` to verify the `REAL` column type [a9a2d96]
- [x] Task: Conductor - User Manual Verification 'Database & Schema Reset' (Protocol in workflow.md) [2bf7542]

## Phase 2: Client-Side Refactor
- [~] Task: Refactor `formatDuration` in `public/app.js` to support variable precision (`.s` vs `.mmm`)
- [ ] Task: Update `sendNote` in `public/app.js` to calculate and send timestamps as floats
- [ ] Task: Update `updateClock` and `renderNotes` in `public/app.js` to show 0.1s precision
- [ ] Task: Increase `updateClock` interval to 100ms
- [ ] Task: Conductor - User Manual Verification 'Client-Side Refactor' (Protocol in workflow.md)

## Phase 3: Server-Side Export & Final Integration
- [ ] Task: Implement a time-formatting utility in `server.js` (or shared helper) for CSV export
- [ ] Task: Update `GET /api/sessions/:id/export` to format `REAL` seconds into `HH:MM:SS.mmm`
- [ ] Task: Update `test/export.test.js` to verify high-precision CSV output
- [ ] Task: Conductor - User Manual Verification 'Server-Side Export & Final Integration' (Protocol in workflow.md)
