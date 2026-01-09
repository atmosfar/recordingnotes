# Specification: Bitfocus Companion Webhook Integration

## 1. Overview
This track implements a new webhook endpoint designed for Bitfocus Companion (using the Generic HTTP module). It allows users to create, start, and stop recording sessions via remote triggers.

## 2. Problem Description
Users need a way to automate session lifecycle events using hardware controllers like Stream Deck (via Bitfocus Companion). The existing SquadCast webhook logic provides a good template, but a dedicated, more direct endpoint is needed for Companion to facilitate returning and reusing Session IDs.

## 3. Functional Requirements
- **Dedicated Webhook Endpoint:** Create a `POST /api/webhooks/companion` endpoint.
- **Action-Based Logic:** The endpoint should handle multiple actions based on an `action` field in the JSON payload:
    - `create`: Creates a new session and returns the `id`.
    - `start`: Sets the `started_at` timestamp and status to `active` for a specific session ID.
    - `stop`: Sets the `stopped_at` timestamp and status to `completed` for a specific session ID.
- **Payload Structure:**
    - Create: `{ "action": "create", "name": "Session Name" }`
    - Start: `{ "action": "start", "id": 123 }`
    - Stop: `{ "action": "stop", "id": 123 }`
- **Response Handling:**
    - `create` must return `{ "id": <new_id> }` to allow Companion to capture it as a variable.
    - Success responses should use appropriate HTTP status codes (201 for creation, 200 for updates).

## 4. Technical Details
- **Mirroring Logic:** Replicate the `started_at`/`stopped_at` and status update logic found in the `squadcast` webhook handler.
- **Validation:** Ensure the session `id` exists before attempting to start or stop it.
- **Database:** Utilize the existing `sessions.js` functions (`createSession`, `updateSession`).

## 5. Acceptance Criteria
- [ ] `POST /api/webhooks/companion` with `action: create` returns a valid session ID.
- [ ] `POST /api/webhooks/companion` with `action: start` and a valid ID updates the session's `started_at` time.
- [ ] `POST /api/webhooks/companion` with `action: stop` and a valid ID updates the session's `stopped_at` time.
- [ ] Invalid actions or missing IDs return clear error messages and 400/404 status codes.
