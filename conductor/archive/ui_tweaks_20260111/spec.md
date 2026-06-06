# Specification: UI Tweaks - Desktop Header & Stream Polishing

## 1. Overview
This track focuses on refining the desktop user interface to improve feature parity with the mobile view and enhance visual consistency in the note stream. Key changes include displaying the active session name in the desktop header and centering informational messages.

## 2. Functional Requirements
- **Desktop Session Display:**
    - Display the currently selected session name in the center of the header bar on desktop views.
    - Ensure the title updates dynamically as sessions are selected or renamed.
    - Matches the styling and behavior of the existing mobile session title.
- **Message Alignment:**
    - Ensure "empty state" messages (e.g., "No notes yet.", "Select a session...", "Session not found.") are perfectly centered horizontally within the note stream.
- **Icon Tweaks:**
    - Refine existing icons (Edit, Delete, Theme Toggle, etc.) based on user feedback provided during implementation.

## 3. Technical Architecture
- **HTML/CSS:**
    - Modify `header` structure in `index.html` to allow the session title to be visible on desktop.
    - Update `style.css` to handle responsive visibility for the header title (center-aligned).
    - Refine `.empty-state` CSS to guarantee horizontal centering.
- **JavaScript:**
    - Update `app.js` logic (e.g., `updateClock`, `selectSession`) to ensure the session name is updated in the newly visible desktop header element.

## 4. Acceptance Criteria
- [ ] Active session name is visible and centered in the header on desktop view.
- [ ] Header title displays "No Session" or "RecNotes" when no session is active.
- [ ] Empty state messages in the note stream are horizontally centered.
- [ ] Icon refinements are applied as specified during implementation.
