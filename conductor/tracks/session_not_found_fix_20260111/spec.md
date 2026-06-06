# Specification: Bug Fix - Non-existent Session Handling

## 1. Overview
Currently, if a user navigates to a session URL that does not exist, the application fails to handle the error gracefully. It displays a blank header, a flashing red recording bar, and an empty notes stream. This track will implement proper 404 detection, update the UI to reflect that the session was not found, and refactor the recording state management to be event-driven via WebSockets instead of polling.

## 2. Functional Requirements
- **Error Detection:** The frontend must detect a `404 Not Found` response when attempting to fetch session details from the server.
- **"Not Found" UI State:**
    - **Header Status Bar:** A solid yellow bar must appear at the top of the viewport.
    - **Notes Stream:** The stream must clear and display a central message: "Session not found."
    - **Input Area:** The note input area and color palette must be hidden.
- **WebSocket State Management:**
    - Remove the 100ms `setInterval` polling for session status/clock.
    - Update the UI (recording bar, labels) in response to `SESSION_STATUS_UPDATE` and `SESSION_DELETED` WebSocket messages.
    - Use a local timer for the live clock only when a session is active.

## 3. Technical Architecture
- **CSS Refactoring:**
    - Rename `body.recording` to `body.current-session-status`.
    - Use a CSS variable (e.g., `--status-color`) to toggle between red (`#ff4d4d`) for recording and yellow (`#f1c40f`) for errors.
- **Frontend Logic (`public/app.js`):**
    - Update `selectSession` to handle 404 errors and stop polling dependencies.
    - Refactor `updateRecordingState` to be triggered by events rather than a high-frequency interval.
    - Ensure the "flashing" behavior (caused by high-frequency class toggling in a 100ms interval) is eliminated.

## 4. Acceptance Criteria
- [ ] Navigating to a non-existent session ID shows a solid yellow bar at the top.
- [ ] The notes stream displays "Session not found." and the input section is hidden.
- [ ] `setInterval` for session status updates is removed.
- [ ] Recording state (red bar) updates instantly when a WebSocket message is received.
- [ ] Valid recording sessions show a solid (non-flashing) red bar.
