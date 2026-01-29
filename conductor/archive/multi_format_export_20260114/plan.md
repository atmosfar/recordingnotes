# Plan: Multi-format Marker Export

## Phase 1: Server-Side Multi-format Logic [checkpoint: fab3da0]
- [x] Task: Write Tests for the export endpoint with both `reaper` and `audition` format parameters. [fab3da0]
- [x] Task: Update `/api/sessions/:id/export` in `server.js` to handle the `format` query parameter. [fab3da0]
- [x] Task: Implement Audition CSV generation logic (tab-delimited, correct headers). [fab3da0]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Server-Side Multi-format Logic' (Protocol in workflow.md) [fab3da0]

## Phase 2: Frontend UI Enhancements [checkpoint: 906dd3f]
- [x] Task: Update `public/index.html` to add a format selection dropdown or menu. [906dd3f]
- [x] Task: Update `public/style.css` to style the selection menu for both desktop and mobile views. [906dd3f]
- [x] Task: Update `public/app.js` to toggle the format menu and trigger the download with the selected format. [906dd3f]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Frontend UI Enhancements' (Protocol in workflow.md) [906dd3f]

## Phase 3: Final Integration & Verification [checkpoint: 906dd3f]
- [x] Task: Verify that both REAPER and Audition files download correctly with accurate content. [906dd3f]
- [x] Task: Ensure mobile UI handles the selection gracefully within the overflow menu. [906dd3f]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Final Integration & Verification' (Protocol in workflow.md) [906dd3f]
