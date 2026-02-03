# Specification: Restricted Session Links (Guest Mode)

## 1. Overview
Implement a "Guest Mode" that allows users to access and contribute to a specific recording session via a unique URL. These links will bypass the standard login, hide the sidebar/session list, and restrict the user's interaction to the designated session only.

## 2. Functional Requirements
- **Guest Link Generation:**
    - Admins can generate a "Guest Access Link" from the session dashboard.
    - The link should include a unique, non-guessable token (e.g., a UUID or high-entropy hash).
- **Authentication Bypass:**
    - Accessing a `/guest/:token` URL should allow entry without requiring the standard `AUTH_USERNAME` / `AUTH_PASSWORD` login.
- **Restricted UI (Guest Mode):**
    - The sidebar and all session-switching controls must be hidden.
    - The "Export" and "Delete Session" actions should be removed for guests.
    - The UI should clearly indicate "Guest Access" or "Contributing to [Session Name]".
- **Security & Scope:**
    - Guests must only be able to see and add notes to the session associated with their token.
    - The WebSocket server must verify the token before allowing a guest to join a room.
    - Guests should not be able to retrieve the full session list.

## 3. Technical Architecture
- **Server-Side (`server.js` & `db.js`):**
    - Add a `guest_token` column to the `sessions` table.
    - Update `checkAuth` middleware to allow `/guest/:token` routes if the token is valid.
    - Add an endpoint to generate/refresh a token for a session.
    - Update WebSocket `JOIN_SESSION` logic to handle token-based joining.
- **Frontend-Side (`public/app.js`):**
    - Handle the `/guest/:token` route (or `/#/guest/:token`).
    - Implement a `isGuestMode` flag to toggle UI elements (hide sidebar, toggles, etc.).
- **CSS (`public/style.css`):**
    - Add a `.guest-mode` class to `body` to facilitate hiding elements via CSS.

## 4. Acceptance Criteria
- [ ] Admins can generate a unique link for any session.
- [ ] Users with the link can view and add notes without logging in.
- [ ] Guest users cannot see or access other sessions.
- [ ] Sidebar and navigation are completely hidden for guest users.
