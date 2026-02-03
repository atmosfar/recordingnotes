# Specification: Quick Tags & Snippets

## Overview
Add a "Quick Tags" bar to the session interface that allows users to instantly post common notes with a single click. These tags are customizable and persist locally for the user across different sessions and browser restarts.

## Functional Requirements
- **Instant Note Creation:** Clicking a tag button must immediately send a `CREATE_NOTE` event via WebSocket with the tag's text as the content and the current session timestamp.
- **Default Tags:** The initial set of tags will include:
  - `x Cut`
  - `! Important`
  - `< Retake`
  - `? Question`
- **User Customization:** Users can add, remove, and rename tags.
- **Persistence:** Tag configurations must be stored in the browser's `localStorage` so they are preserved across sessions and page reloads.
- **Management UI:** A "Manage Quick Tags" option in the header's overflow menu (⋮) will open a modal to manage the tags.

## User Interface
- **Tag Bar:** A horizontal, touch-scrollable row located directly above the main text input area.
- **Buttons:** Large, accessible buttons for each tag, styled to match the existing UI (8px border-radius, 1rem horizontal padding).
- **Management Modal:** A simple modal or overlay containing:
  - A list of current tags with "Delete" buttons.
  - An input field and "Add" button to create new tags.
  - A "Close" or "Save" button to exit the modal.

## Technical Details
- **Frontend Storage:** Use `localStorage.setItem('quick_tags', JSON.stringify(tags))`.
- **WebSocket Integration:** Use the existing `SocketManager.send('CREATE_NOTE', ...)` method.
- **Mobile Responsiveness:** The tag bar must use `overflow-x: auto` and `white-space: nowrap` to allow horizontal swiping on small screens.

## Acceptance Criteria
- [ ] Tag bar is visible above the input field when a session is active.
- [ ] Clicking a tag instantly adds a note to the stream.
- [ ] Tags can be added/removed via the management modal.
- [ ] Custom tags persist after a page refresh.
- [ ] The tag bar is hidden for guest users.

## Out of Scope
- Server-side storage of tags (tags are unique to the browser/device).
- Assigning specific colors to tags (tags will use the default note color).
- Drag-and-drop reordering of tags in this iteration.
