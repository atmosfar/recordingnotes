# Specification: "First-Keystroke" Timestamp Capture

## Overview
Currently, note timestamps are captured at the moment the "Send" button is clicked or "Enter" is pressed. This track implements a more accurate capture system where the timestamp is locked the moment a user begins typing a note. This ensures that the note remains associated with the intended moment in the recording, regardless of how long it takes to compose.

## Functional Requirements

### 1. Timestamp Locking
- **Capture Logic:** The system must capture the current session time (or Time-of-Day) on the very first keystroke in an empty note input field.
- **Persistence:** This captured timestamp must remain "locked" for the current note draft as the user continues to type.
- **Submission:** When the note is sent, the "locked" timestamp must be used as the note's creation time in the database.

### 2. Reset & Grace Period
- **Clearing:** If the user clears all text from the input box, the system should prepare to reset the timestamp.
- **Grace Period (100ms):** To prevent losing the capture time during rapid "delete-and-rewrite" actions, the timestamp should only be cleared if the input remains empty for more than 100ms.
- **Re-Capture:** Once the grace period expires and the input is empty, the next character typed will capture a new "First-Keystroke" timestamp.

### 3. Visual Feedback
- **Display:** A visual indicator (e.g., `[00:05:21.4]`) must appear near the input field as soon as a timestamp is locked.
- **State:** The indicator should clear when the note is sent or when the grace period for an empty input expires.

## UI Requirements
- Add a small text element above or inside the note input area to display the captured "draft" timestamp.
- The styling should be subtle (e.g., using `--secondary-color`) to avoid cluttering the minimalist UI.

## Acceptance Criteria
- [ ] Typing the first character in an empty input field immediately captures and displays a timestamp.
- [ ] Continuing to type does not change the captured timestamp.
- [ ] Deleting all text and re-typing within 100ms preserves the original timestamp.
- [ ] Deleting all text and waiting >100ms clears the timestamp; subsequent typing captures a new one.
- [ ] The submitted note in the stream displays the "First-Keystroke" time, not the "Send" time.

## Out of Scope
- Manual editing or override of the captured timestamp.
- Persistence of draft timestamps across page refreshes.
