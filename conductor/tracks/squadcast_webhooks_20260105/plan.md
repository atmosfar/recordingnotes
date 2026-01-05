# Plan: SquadCast Webhook Integration (POC)

## Phase 1: Database Schema Updates [checkpoint: 036a43e]
- [x] Task: Update database schema in `db.js` to include `external_id` and `stopped_at` (verify `started_at` exists) [d4b1ef2]
- [x] Task: Update `init-db.js` to handle migrations for existing databases [d4b1ef2]
- [x] Task: Write tests for finding sessions by `external_id` in `test/sessions.test.js` [d4b1ef2]
- [x] Task: Implement `getSessionByExternalId` in `sessions.js` [d4b1ef2]
- [x] Task: Conductor - User Manual Verification 'Database Schema Updates' (Protocol in workflow.md) [036a43e]

## Phase 2: Webhook Endpoint Implementation
- [x] Task: Create `test/webhooks.test.js` with mock SquadCast payloads for Session Created, Started, and Stopped [9f4c97d]
- [x] Task: Implement `POST /api/webhooks/squadcast` in `server.js` to handle event routing [9f4c97d]
- [x] Task: Implement logic for "Session Created" (Create local session with `external_id`) [9f4c97d]
- [x] Task: Implement logic for "Recording Started" (Update `started_at`) [9f4c97d]
- [x] Task: Implement logic for "Recording Stopped" (Update `stopped_at`) [9f4c97d]
- [x] Task: Create `scripts/simulate-webhook.js` utility for local testing [9f4c97d]
- [~] Task: Conductor - User Manual Verification 'Webhook Endpoint Implementation' (Protocol in workflow.md)

## Phase 3: Client-Side Timer & UI Updates
- [ ] Task: Update API endpoint `GET /api/sessions/:id` to return `started_at` and `stopped_at`
- [ ] Task: Modify `public/app.js` to detect "Recording" state based on session data
- [ ] Task: Implement `updateElapsedTimer` function in `public/app.js` to calculate time from `started_at`
- [ ] Task: Update UI in `public/index.html` to show a "🔴 RECORDING" indicator when active
- [ ] Task: Ensure the "Send Note" logic uses elapsed time if `started_at` is present
- [ ] Task: Conductor - User Manual Verification 'Client-Side Timer & UI Updates' (Protocol in workflow.md)

## Phase 4: Final Verification & Localtunnel Setup
- [ ] Task: Manual end-to-end verification using `simulate-webhook.js`
- [ ] Task: Document steps for using `localtunnel` to test with live SquadCast payloads
- [ ] Task: Final code cleanup and refactoring
- [ ] Task: Conductor - User Manual Verification 'Final Verification & Localtunnel Setup' (Protocol in workflow.md)
