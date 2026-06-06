# Specification: Mobile UI Refinement

## 1. Overview
This track addresses specific UI bugs and refinement needs for the mobile version of the application. The goal is to ensure a consistent, functional, and visually stable experience on mobile browsers, particularly Firefox for Android, without affecting the desktop site.

## 2. Functional Requirements
- **Viewport Fix (Firefox Android):** Adjust the main container height to use dynamic viewport units (`dvh`) ensuring the input field at the bottom remains visible and is not obscured by the browser's URL bar.
- **Stable Sidebar Buttons:** Ensure the `[New]` and `[Edit/Done]` buttons in the mobile sidebar maintain a constant height when toggling between "Edit" (with icon) and "Done" (text only).
- **Theme Icon Sync:** Synchronize the theme icon in the mobile kebab menu with the active theme. The icon should represent the *current* state: Sun for Light mode, Moon for Dark mode.

## 3. Technical Architecture
- **CSS:**
    - Update `@media (max-width: 768px)` blocks in `style.css`.
    - Use `height: 100dvh` for the main layout containers on mobile.
    - Set a specific `min-height` for `.sidebar-top-actions .action-btn` to prevent fluctuations.
- **JavaScript:**
    - Modify the theme toggling logic in `app.js` to correctly update the SVG path of the theme icon in the mobile overflow menu.

## 4. Acceptance Criteria
- [ ] On mobile browsers, the bottom input field is fully visible and not hidden by the URL bar.
- [ ] Toggling the "Edit" button in the sidebar does not cause any vertical jump or height change in the button row.
- [ ] Tapping "Toggle Theme" correctly switches between Sun and Moon icons in the mobile menu.
- [ ] No changes are observed on the desktop version of the site.
