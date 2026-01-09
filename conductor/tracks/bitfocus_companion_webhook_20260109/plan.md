# Plan: Bitfocus Companion Webhook Integration

## Phase 1: Server-Side Implementation
- [ ] Task: Update `server.js` to include the `POST /api/webhooks/companion` endpoint.
- [ ] Task: Implement the `create` action to create a new session and return the ID.
- [ ] Task: Implement the `start` action to set the `started_at` timestamp for a given ID.
- [ ] Task: Implement the `stop` action to set the `stopped_at` timestamp for a given ID.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Server-Side Implementation' (Protocol in workflow.md)

## Phase 2: Testing & Documentation
- [ ] Task: Create a test script `scripts/test-companion-webhook.js` to simulate Companion requests.
- [ ] Task: Verify the full lifecycle (create -> start -> stop) using the test script.
- [ ] Task: Document the webhook payload and response format for the user to configure in Companion.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Testing & Documentation' (Protocol in workflow.md)
