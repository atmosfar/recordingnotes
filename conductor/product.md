# Product Guide (Minimalist Prototype)

## Initial Concept
A simple, server-hosted system for taking live timestamped notes during podcast recordings. Multiple clients can connect via browsers to a central Node.js server to log notes collaboratively.

## Core Features (v1.0)
- **Manual Sessions:** Create a session with a title.
- **SquadCast Integration (POC):** Automate session creation and timer triggers via SquadCast.fm webhooks.
- **Timestamped Logging:** Add notes that automatically capture the current time (Time-of-Day or elapsed session time).
- **First-Keystroke Capture:** Note timestamps are locked the moment a user begins typing, ensuring accuracy for long notes.
- **Collaborative Stream:** A single scrolling list of notes that updates for all connected users.
- **CSV Export:** Basic download of session notes in a CSV format compatible with most editors.
- Simple Access: Password-protected dashboard (single shared password or simple user list).
- Quick Tags: Customizable buttons for instant, one-click note-taking (e.g., #retake, #noise). Stored locally per user.
- Note Repeat: Pressing Enter or clicking Send with an empty input repeats the last manually sent note.
- Data Management: Edit session names, delete sessions, and remove individual notes directly from the UI.

## Target Audience
- **Producers/Editors:** Anyone needing to mark points of interest during a live recording.

## User Interface
- **The Stream:** A vertical list of notes: `[Timestamp] [User] [Content]`.
- **Input:** A simple text box at the bottom (or top) that saves on 'Enter'.
