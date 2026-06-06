# Specification: SquadCast Webhook Integration (POC)

## Overview
This track implements a Proof of Concept (POC) for integrating SquadCast.fm webhooks into the Recording Notes system. The goal is to automate session creation and timer management based on SquadCast recording events.

## Functional Requirements

### 1. Webhook Endpoints
- Implement `POST /api/webhooks/squadcast` to receive SquadCast events.
- Support core events:
    - **Session Created:** Creates a new Recording Notes session.
    - **Recording Started:** Sets `started_at` and triggers the elapsed timer.
    - **Recording Stopped:** Sets `stopped_at` and freezes the elapsed timer at its final value.

### 2. Data Mapping
- Add `external_id` column to the `sessions` table to store SquadCast IDs.
- Add `stopped_at` column to the `sessions` table to store the final recording time.

### 3. Timer Logic
- **Server-Side:** Record UTC start and stop times.
- **Client-Side:** 
    - **Recording:** Switch from "Live Clock" to "Elapsed Timer" (`Current Time - started_at`).
    - **Post-Recording:** Show final duration (`stopped_at - started_at`). 
    - **Note-Taking:** Users remain in the session and can continue taking notes after the recording stops.

### 4. Local Simulation & Testing
- **Simulation Script:** Create `scripts/simulate-webhook.js` for fast, offline logic testing.
- **Localtunnel Integration:** Provide instructions for using the `localtunnel` npm package to verify real payloads.

## Acceptance Criteria
- [ ] Session is created automatically via webhook.
- [ ] UI switches to elapsed timer automatically when recording starts.
- [ ] Timer freezes at the correct duration when recording stops.
- [ ] Note taking remains possible after recording stops (notes capture the frozen final duration).
- [ ] Both `localtunnel` and the simulation script are verified as viable testing paths.

## Out of Scope
- Production security (e.g., signature verification).
- Automating the "Export to CSV" step.
