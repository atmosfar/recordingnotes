# Specification: Session Activity Indicators & Prioritization

## 1. Overview
Enhance the sidebar session list to provide real-time visibility into which sessions are actively recording and how many users are currently connected. Active sessions should be visually prioritized to help users quickly find ongoing recordings.

## 2. Functional Requirements
- **Recording Indicator:**
    - Sessions with an active recording (started_at is set, stopped_at is null) must show a red "Recording" dot or badge in the sidebar.
- **Active User Indicator:**
    - Sessions with 1 or more connected users must show a user icon and the count of active connections.
- **Prioritized Sorting:**
    - The session list must be sorted by the following priority:
        1. **Recording:** Sessions currently recording come first.
        2. **Active Users:** Sessions with connected users (but not recording) come next.
        3. **Recency:** All other sessions sorted by `created_at DESC` (existing behavior).
- **Real-time Updates:**
    - The list must re-sort and update indicators instantly as users join/leave or as recordings start/stop.

## 3. Technical Architecture
- **Server-Side (`server.js`):**
    - Augment session objects in `SESSION_LIST_UPDATE` and `GET_SESSIONS` with an `active_users` count from `sessionRooms`.
    - Trigger `broadcastSessionList()` on WebSocket `connection`, `JOIN_SESSION`, `LEAVE_SESSION`, and `close`.
- **Frontend-Side (`public/app.js`):**
    - Refactor `renderSessionList` to implement the new sorting priority.
    - Update the session item template to include the new indicator elements (SVG icons/badges).
- **CSS (`public/style.css`):**
    - Add styles for the recording dot and user count badge.
    - Ensure indicators are responsive and don't crowd the session name.

## 4. Acceptance Criteria
- [ ] Active recordings show a red dot/badge in the sidebar.
- [ ] User counts are visible for sessions with active connections.
- [ ] The session list correctly prioritizes recording sessions, then active-user sessions, then newest sessions.
- [ ] Connecting/disconnecting from a session instantly updates the list for all users.
