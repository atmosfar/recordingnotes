# Specification: Highlight Active Session in Sidebar from URL

## 1. Overview
This track ensures that when a session is opened via its deep-link URL (e.g., `/#/session/123`), the corresponding item in the sidebar is visually highlighted as active. It also ensures the active item is scrolled into view if the list is long.

## 2. Problem Description
Currently, when a user loads the application with a session hash in the URL, the session data is loaded correctly, but the sidebar item for that session does not show the "active" styling. This is likely due to a type mismatch during comparison (`string` vs `number`) and a lack of explicit scroll-to-active logic.

## 3. Functional Requirements
- **URL-Based Highlighting:** On initial page load or hash change, the sidebar item matching the session ID in the URL must be highlighted with the `.active` class.
- **Scroll into View:** If the highlighted session item is not visible in the sidebar's scrollable area, it should be automatically scrolled into view.
- **Persistent Highlight:** The highlight must be maintained even if the session list is refreshed (e.g., after creating a new session).
- **Responsive Consistency:** Highlighting must be applied regardless of whether the sidebar is currently open or closed (important for mobile UX).

## 4. Technical Details
- **Type Safety:** Update `renderSessionList` to ensure robust comparison between the `currentSessionId` (which might be a string from the URL) and the `session.id` (usually a number from the database).
- **Scrolling Logic:** Use `element.scrollIntoView({ block: 'nearest' })` on the active session item within `renderSessionList`.
- **Target File:** `public/app.js`

## 5. Acceptance Criteria
- [ ] Loading `/#/session/<id>` directly highlights the correct session in the sidebar.
- [ ] If the session list is long, the active session is scrolled into view within the sidebar.
- [ ] Switching sessions via the sidebar updates the highlight and URL correctly.
- [ ] Navigating via browser Back/Forward buttons updates the sidebar highlight.
