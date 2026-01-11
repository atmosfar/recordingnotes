# Specification: Session and Note Management

## 1. Overview
This track adds the ability for users to manage their data by editing session names, deleting entire sessions, and deleting individual notes. The UI will provide contextual actions for both desktop and mobile users.

## 2. Functional Requirements
- **Session Management:**
    - **Rename Session:** Users can edit the name of an existing session.
    - **Delete Session:** Users can permanently delete a session and all its associated notes.
    - **UI (Desktop):** Edit and Delete icons appear on the right side of each session item in the sidebar upon hover.
    - **UI (Mobile):** A "Manage Sessions" button appears at the bottom of the sidebar, which toggles a management mode (revealing edit/delete actions for each session).
- **Note Management:**
    - **Delete Note:** Users can permanently delete a specific note from a session.
    - **UI:** A trash icon appears in the note action area (next to the edit icon).

## 3. API Changes
- `PATCH /api/sessions/:id`: Update session name.
- `DELETE /api/sessions/:id`: Delete a session and its notes.
- `DELETE /api/sessions/:session_id/notes/:note_id`: Delete a specific note.

## 4. Visual & Style Guidelines
- **Hover States:** Sidebar session actions should only be visible on hover for desktop users to keep the interface clean.
- **Consistency:** Use the same iconography (e.g., pencil for edit, trash for delete) as existing note editing.
- **Confirmation:** Prompt the user for confirmation before deleting sessions or notes to prevent accidental data loss.

## 5. Acceptance Criteria
- [ ] Users can successfully rename a session from the sidebar.
- [ ] Users can successfully delete a session, and it is removed from the sidebar and database.
- [ ] Users can successfully delete a note, and it is removed from the stream and database.
- [ ] The "Manage Sessions" button on mobile correctly toggles management actions.
- [ ] UI remains clean and consistent across desktop and mobile.
