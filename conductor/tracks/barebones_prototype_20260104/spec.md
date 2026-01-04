# Spec: Barebones Prototype

## Goal
Build a functional, single-process Node.js application that allows multiple users to log timestamped notes into a shared session stored in a native SQLite database.

## Requirements
- **Server:** Node.js server using `http` or `express`.
- **Database:** SQLite using `node:sqlite`. One table for `sessions`, one for `notes`.
- **Frontend:** Single HTML page with Vanilla JS and a plain CSS file.
- **Features:**
    - List active/past sessions.
    - Create a new session.
    - Enter a session to view the note stream.
    - Post a new note with a timestamp.
    - Export session to CSV.

## Data Model
### `sessions`
- `id`: INTEGER PRIMARY KEY
- `title`: TEXT
- `created_at`: DATETIME

### `notes`
- `id`: INTEGER PRIMARY KEY
- `session_id`: INTEGER (FK)
- `content`: TEXT
- `timestamp`: TEXT (or INTEGER for offset)
- `user_name`: TEXT
