# Specification: Fix Note Item Height Fluctuation (Desktop)

## 1. Overview
A regression was introduced where note items in the note stream change height when their action icons (edit/bin) appear on hover. This is caused by the use of `display: none` for the icons, which removes them from the document flow and collapses the container's height requirement. This track will stabilize the height of note items on desktop while retaining the `display: none` behavior for the icons.

## 2. Functional Requirements
- **Stable Row Height:** Note items must maintain a consistent minimum height regardless of whether the action icons are visible.
- **Icon Visibility:** Action icons must continue to be hidden by default and appear on hover (or in edit mode) using `display: none` / `display: flex`.
- **Text Wrapping:** The fix must not interfere with the ability of note content to wrap onto multiple lines.

## 3. Technical Architecture
- **CSS Styles (`public/style.css`):**
    - Apply a `min-height` to the `.note` class in the desktop view.
    - The `min-height` value will be calculated to accommodate the height of the SVG action icons (approximately 32-36px).
    - Ensure `box-sizing: border-box` is used to include padding in the height calculation.

## 4. Acceptance Criteria
- [ ] Hovering over a note item on desktop reveals the icons without changing the height of the row.
- [ ] Multi-line notes still expand correctly to fit their content.
- [ ] No layout shifts occur when icons appear or disappear.
- [ ] No impact on the mobile UI (which already has its own stabilization logic).
