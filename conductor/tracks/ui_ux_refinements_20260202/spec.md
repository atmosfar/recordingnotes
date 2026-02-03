# Specification: UI/UX Refinements

## 1. Overview
This track focuses on several targeted UI/UX improvements to streamline the interface, prevent accidental actions, and modernize the visual language.

## 2. Functional Requirements
- **Revised Session Sorting:**
    - Only sessions with an active recording (pulsing red dot) should be prioritized at the top.
    - Sessions with active users (but not recording) should follow normal chronological sorting.
- **Logout Confirmation:**
    - Clicking "Logout" must trigger a standard browser confirmation (`confirm()`).
    - The logout process only proceeds if the user confirms.
- **Android-style Share Icon:**
    - Replace the current "upload" style share icon with the 3-connect-nodes style icon (`share-variant`).
- **Universal Kebab Menu:**
    - Move "Export" and "Theme Toggle" into the overflow (kebab) menu on desktop.
    - Consolidate the header by removing individual desktop-only action buttons in favor of the unified menu.

## 3. Technical Architecture
- **Frontend Logic (`public/app.js`):**
    - Update `renderSessionList` sorting logic to remove `active_users` prioritization.
    - Wrap the `/logout` redirection in a `confirm()` block.
    - Update event listeners to handle the newly unified menu structure.
- **HTML/CSS (`public/index.html` & `style.css`):**
    - Replace the Share button SVG.
    - Adjust CSS to show the overflow menu toggle on desktop.
    - Reposition and style the desktop overflow menu for a consistent experience.

## 4. Acceptance Criteria
- [ ] Only recording sessions appear at the very top of the sidebar.
- [ ] Users are prompted before being logged out.
- [ ] The share icon uses the new 3-node connected style.
- [ ] Desktop interface uses the kebab menu for Export and Theme actions.
