# Plan: Bitfocus Companion Webhook Integration

## Phase 1: Server-Side Implementation
- [x] Task: Update `server.js` to include the `POST /api/webhooks/companion` endpoint. [18f9f60]
- [x] Task: Implement the `create` action to create a new session and return the ID. [18f9f60]
- [x] Task: Implement the `start` action to set the `started_at` timestamp for a given ID. [18f9f60]
- [x] Task: Implement the `stop` action to set the `stopped_at` timestamp for a given ID. [18f9f60]
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Server-Side Implementation' (Protocol in workflow.md)

## Phase 2: Testing & Documentation
- [ ] Task: Create a test script `scripts/test-companion-webhook.js` to simulate Companion requests.
- [ ] Task: Verify the full lifecycle (create -> start -> stop) using the test script.
- [ ] Task: Document the webhook payload and response format for the user to configure in Companion.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Testing & Documentation' (Protocol in workflow.md)
