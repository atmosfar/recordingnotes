# Plan: WebSocket Migration

## Phase 1: Server-Side Foundation [checkpoint: f31ef85]
- [x] Task: Install `ws` dependency. [f70a45b]
- [x] Task: Initialize WebSocket server in `server.js` and implement room management (Map of sessionRooms). [1ac2dde]
- [x] Task: Create a unified `broadcastToRoom` and `broadcastToAll` helper function. [1ac2dde]
- [x] Task: Conductor - User Manual Verification 'Phase 1: Server-Side Foundation' (Protocol in workflow.md)

## Phase 2: Action Migration (Backend)
- [x] Task: Implement WebSocket message handlers for Session actions (Create, Update, Delete). [fca5ed7]
- [x] Task: Implement WebSocket message handlers for Note actions (Create, Update, Delete). [fca5ed7]
- [x] Task: Update existing Webhook handlers (SquadCast/Companion) to trigger WebSocket broadcasts. [fca5ed7]
- [x] Task: Conductor - User Manual Verification 'Phase 2: Action Migration (Backend)' (Protocol in workflow.md)

## Phase 3: Frontend Refactoring [checkpoint: 6a54f94]
- [x] Task: Create a `SocketManager` class in `public/app.js` to handle connection, reconnection, and event routing. [4f1323f]
- [x] Task: Replace all `fetch` calls for actions with `SocketManager.send()` calls. [4f1323f]
- [x] Task: Remove all `setInterval` polling logic and replace with WebSocket event listeners. [4f1323f]
- [x] Task: Conductor - User Manual Verification 'Phase 3: Frontend Refactoring' (Protocol in workflow.md) [6a54f94]

## Phase 4: Verification & Cleanup [checkpoint: 6a54f94]
- [x] Task: Verify end-to-end real-time synchronization between two browser tabs. [6a54f94]
- [x] Task: Verify that Companion Webhooks still trigger live updates in the UI. [6a54f94]
- [x] Task: Conductor - User Manual Verification 'Phase 4: Verification & Cleanup' (Protocol in workflow.md) [6a54f94]
