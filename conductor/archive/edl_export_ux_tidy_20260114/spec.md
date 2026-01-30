# Specification: EDL Export UX Tidy Up

## 1. Overview
Refine the user experience for the EDL export process. Currently, selecting EDL triggers a simple modal for framerate selection. This track will improve the persistence of user choices, the ease of dismissing the modal, and the overall visual polish of the selection process.

## 2. Functional Requirements
- **FPS Persistence:**
    - The application must remember the last selected framerate using `localStorage`.
    - When the FPS modal is opened, the last used framerate should be visually highlighted (e.g., a "selected" class).
- **Improved Dismissal:**
    - Clicking the backdrop (shadowed area) should close the FPS modal, consistent with other UI overlays in the app.
- **Visual Polish:**
    - Standardize the FPS modal's styling to match the modern aesthetic of the overflow and color picker menus.
    - Improve the grid layout and button feedback (hover/active states).

## 3. Technical Architecture
- **State Management:**
    - Use `localStorage.getItem('last_edl_fps')` and `localStorage.setItem('last_edl_fps', fps)`.
- **Event Handling:**
    - Update the backdrop click listener in `app.js` to include the `#fps-modal`.
- **CSS:**
    - Update `style.css` to handle selected states for `.fps-opt` buttons.
    - Ensure `.palette-popup` (used by the FPS modal) is consistently styled.

## 4. Acceptance Criteria
- [ ] Selecting a framerate and exporting saves that choice to `localStorage`.
- [ ] Re-opening the EDL export highlights the previous choice.
- [ ] Tapping outside the FPS modal correctly closes it.
- [ ] Modal styling is consistent with other app menus.
