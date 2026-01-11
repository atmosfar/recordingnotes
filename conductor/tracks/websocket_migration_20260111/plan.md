# Plan: WebSocket Migration

## Phase 1: Server-Side Foundation
- [x] Task: Install `ws` dependency. [f70a45b]
- [x] Task: Initialize WebSocket server in `server.js` and implement room management (Map of sessionRooms). [1ac2dde]
- [x] Task: Create a unified `broadcastToRoom` and `broadcastToAll` helper function. [1ac2dde]
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Server-Side Foundation' (Protocol in workflow.md)

## Phase 2: Action Migration (Backend)
- [ ] Task: Implement WebSocket message handlers for Session actions (Create, Update, Delete).
- [ ] Task: Implement WebSocket message handlers for Note actions (Create, Update, Delete).
- [ ] Task: Update existing Webhook handlers (SquadCast/Companion) to trigger WebSocket broadcasts.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Action Migration (Backend)' (Protocol in workflow.md)

## Phase 3: Frontend Refactoring
- [ ] Task: Create a `SocketManager` class in `public/app.js` to handle connection, reconnection, and event routing.
- [ ] Task: Replace all `fetch` calls for actions with `SocketManager.send()` calls.
- [ ] Task: Remove all `setInterval` polling logic and replace with WebSocket event listeners.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Frontend Refactoring' (Protocol in workflow.md)

## Phase 4: Verification & Cleanup
- [ ] Task: Verify end-to-end real-time synchronization between two browser tabs.
- [ ] Task: Verify that Companion Webhooks still trigger live updates in the UI.
- [ ] Task: Conductor - User Manual Verification 'Phase 4: Verification & Cleanup' (Protocol in workflow.md)
