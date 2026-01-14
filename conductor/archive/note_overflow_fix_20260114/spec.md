# Specification: Fix Note Content Overflow (Desktop)

## 1. Overview
A bug was identified where multiline notes in the desktop note stream overflow their container instead of the container expanding to fit the text. This occurred after recent changes to stabilize note item heights. This track will ensure that note items correctly expand vertically to accommodate any amount of content while maintaining a minimum height for single-line stability.

## 2. Functional Requirements
- **Dynamic Height:** Note containers must expand vertically when the text wraps to multiple lines.
- **Minimum Height:** The stable minimum height for single-line notes (currently `2.8rem`) must be maintained.
- **Vertical Alignment:** All elements within the note row (timestamp, text, actions) should remain vertically centered within the row's height.

## 3. Technical Architecture
- **CSS Refinement (`public/style.css`):**
    - Audit the `.note` class to ensure no `height` or `max-height` properties are present.
    - Verify that `display: grid` and `grid-template-columns` correctly handle the vertical growth of the content cell.
    - Ensure `align-items: center` is applied correctly to the row to maintain vertical centering during expansion.

## 4. Acceptance Criteria
- [ ] Multiline notes correctly expand the container's height without text overlapping or overflowing.
- [ ] Single-line notes maintain their stable `2.8rem` height.
- [ ] Action icons (edit/bin) remain accessible and correctly positioned during expansion.
- [ ] No regression in the "no-shudder" hover behavior.
