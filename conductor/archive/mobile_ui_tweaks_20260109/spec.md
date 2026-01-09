# Specification: Mobile UI Tweaks

## 1. Overview
This track focuses on refining the mobile user experience for Recording Notes. Key improvements include a more modern color picker UX, improved visual consistency in dark mode, and a more intuitive sidebar closing mechanism.

## 2. Functional Requirements
- **Redesigned Color Picker:**
    - Replace the existing "bottom sheet" (iphone-style settings drawer) with a small overlaid popup menu for color selection on mobile.
    - The new popup should mirror the style of the kebab (overflow) menu (12px border radius, `0 4px 15px rgba(0,0,0,0.1)` shadow).
    - Selecting a color from the popup should immediately update the note's draft color and close the popup.
- **Enhanced Dark Mode Visibility:**
    - The color picker toggle button (`#mobile-color-toggle`) should use a slightly darker background in dark mode (`#2a2a2a`) to ensure the paintbrush icon remains visible while maintaining good contrast.
- **Improved Sidebar Interaction:**
    - Users can now close the sidebar by tapping anywhere on the screen outside of the sidebar itself. This should reuse the existing overlay logic used for the kebab menu and bottom sheet backdrops.

## 3. Visual & Style Guidelines
- Popup Style: Consistent with `#overflow-menu` in `style.css`.
- Dark Mode Background: `#2a2a2a` for the mobile color toggle.
- Animation: Smooth transitions for the new color picker popup, similar to the overflow menu.

## 4. Acceptance Criteria
- [ ] **Color Picker Popup:** On mobile, clicking the color picker button opens a styled popup menu instead of a bottom sheet.
- [ ] **Dark Mode Contrast:** The color picker button is clearly visible and aesthetically pleasing in dark mode with the new `#2a2a2a` background.
- [ ] **Sidebar Close:** Tapping the backdrop overlay when the sidebar is open successfully closes it.
- [ ] **Verification:** Manual confirmation from the user for each step of the implementation.
