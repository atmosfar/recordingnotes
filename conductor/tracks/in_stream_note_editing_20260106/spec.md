# Specification: In-Stream Note Editing

## Overview
This track allows users to correct or update the content of existing notes directly within the note stream. To ensure accuracy and ease of use, editing happens in-place so the user can see the full context of their note.

## Functional Requirements

### 1. Edit Interaction
- **Triggers:** 
    - **Desktop:** Hovering over a note displays an "Edit" button (pencil icon) on the far right.
    - **Mobile:** Tapping a note reveals the "Edit" button.
- **Entry:** Clicking the "Edit" button replaces the static note text with an **Inline TextArea**.
- **Action Buttons:** While in edit mode, the "Edit" button is replaced by two buttons:
    - **Save:** A tickbox/checkmark icon.
    - **Cancel:** An 'X' icon.

### 2. In-Place Editor Behavior
- The editor must be a `<textarea>` that auto-adjusts its height to fit the full content of the note.
- **Keyboard Shortcuts:**
    - `Enter`: Save changes.
    - `Shift + Enter`: Insert newline.
    - `Escape`: Cancel editing and discard changes.
- **Focus:** If the user clicks away (loses focus) to an area outside the action buttons, the edit is cancelled and the original text is restored.

### 3. Data Persistence
- **API:** Implement a `PATCH /api/sessions/:session_id/notes/:note_id` endpoint to update the note's content.
- **Database:** Update the note's `content` in the SQLite `notes` table.
- **Stability:** The original `timestamp` and `user_id` must remain unchanged.

## UI Requirements
- Maintain the minimalist, clean aesthetic of the prototype.
- The "Edit", "Save", and "Cancel" icons should be subtle and overlaid on the note container without shifting the text layout.

## Acceptance Criteria
- [ ] Hovering over a note reveals the Edit button.
- [ ] Clicking Edit allows modifying the text in a textarea that shows the full content.
- [ ] Clicking the "Tick" button or pressing Enter saves the change; the database is updated.
- [ ] Clicking the "X" button or pressing Escape reverts to the original text.
- [ ] Clicking away from the editor cancels the edit.
- [ ] Note timestamp remains identical after editing.

## Out of Scope
- Version history (keeping track of previous versions of an edited note).
- Deleting notes (this is a separate future feature).
