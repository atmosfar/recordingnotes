# Specification: UI Tidying & Mobile Refinement

## Overview
This track focuses on improving the UI, specifically for mobile devices, based on recent feedback. It involves repositioning elements for better visibility, introducing a vertical overflow menu, and refactoring CSS into an external file for better maintainability.

## Functional Requirements

### 1. CSS Refactoring
- Move all CSS from `index.html` into a new file: `public/style.css`.
- Update `index.html` to link to this external stylesheet.

### 2. Header & Title Refinements (Mobile Focus)
- **Title Layout:** The mobile header should display only the current session name (truncated with ellipses if needed) and the session timer.
- **Branding:** Move the "RecNotes" heading into the sidebar drawer. It should only be visible when the sidebar is expanded.
- **Recording Indicator:** Implement a thin red bar at the very top of the screen that only appears when a session is in the "Recording" state.

### 3. Action Menu (Mobile)
- Implement a vertical "..." (kebab) menu in the top right corner.
- Move the **Light/Dark Toggle** and **Export Button** into this menu.
- Expanded Menu Items: Display as "Icon + Text" for clarity and easy tapping.

### 4. Layout Fixes
- **Note Stream:** Add consistent spacing between the note timestamp and the note content.
- **Edit Button:** Ensure the "Edit" pencil icon stays on the far right of the note container and doesn't wrap to a new line.
- **Input Area:** Truncate the placeholder message to "Type a note" on small screens to prevent overflow.
- **Navigation:** Reinstate the hamburger menu icon to allow users to toggle the sidebar and switch between sessions on mobile.

## UI Requirements
- Maintain the minimalist, clean aesthetic.
- Use CSS Media Queries to target mobile screens (typically `< 768px`) for these specific layout changes.

## Acceptance Criteria
- [ ] CSS is successfully moved to `public/style.css`.
- [ ] Hamburger menu correctly toggles the sidebar on mobile.
- [ ] Session name and timer are the primary elements in the mobile header.
- [ ] Light/Dark toggle and Export are accessible via the new "..." menu on mobile.
- [ ] No layout shifting or wrapping for the edit button or timestamps.
- [ ] Red recording bar appears/disappears based on session state.

## Out of Scope
- Major changes to the desktop UI (beyond the branding move).
- Implementing new session management logic.
