# Plan: CMX3600 EDL Marker Export

## Phase 1: Server-Side EDL Logic [checkpoint: 5ee6ebf]
- [x] Task: Implement `timeToHmsf` utility function in `server.js` (or a helper module) to convert seconds to SMPTE timecode. [5ee6ebf]
- [x] Task: Write unit tests for `timeToHmsf` covering all required framerates and Drop Frame scenarios. [5ee6ebf]
- [x] Task: Update the `/api/sessions/:id/export` endpoint in `server.js` to support the `edl` format and `fps` parameter. [5ee6ebf]
- [x] Task: Implement color mapping logic to translate hex colors to Resolve-compatible strings. [5ee6ebf]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Server-Side EDL Logic' (Protocol in workflow.md) [5ee6ebf]

## Phase 2: Frontend UI & Integration [checkpoint: 906dd3f]
- [x] Task: Add "CMX3600 EDL" as an option in the export dropdown menu in `public/index.html`. [906dd3f]
- [x] Task: Implement a framerate selection prompt (modal or dropdown) in `public/app.js`. [906dd3f]
- [x] Task: Update `exportFn` in `public/app.js` to handle the EDL selection, framerate prompting, and URL generation. [906dd3f]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Frontend UI & Integration' (Protocol in workflow.md) [906dd3f]

## Phase 3: Final Verification [checkpoint: 98ec072]
- [x] Task: Verify EDL file structure against the `Timeline_1.edl` reference. [98ec072]
- [x] Task: Ensure generated timecodes are accurate across different session lengths and framerates. [98ec072]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Final Verification' (Protocol in workflow.md) [98ec072]

