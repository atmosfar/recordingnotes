# User Guide

## Getting Started

Open `http://localhost:3000` in your browser. If authentication is configured, you'll be prompted to log in.

## Sessions

Sessions represent individual recording projects. From the sidebar you can:

- **Create** a new session with a name
- **Switch** between sessions by clicking them
- **Edit** session names by clicking the name
- **Delete** sessions (removes all associated notes)

Sessions support two timestamp modes:

- **Clock mode** — notes use the current time-of-day (HH:MM:SS)
- **Timer mode** — notes use time relative to when the timer started. Supports multi-run timers (pause/resume across multiple takes).

## Taking Notes

In the main panel:

1. Type a note in the input field at the bottom
2. Press **Enter** to add it — it gets the current timestamp automatically
3. Notes appear in chronological order

Notes can be:

- **Edited** by clicking on the note text
- **Deleted** via the delete button on each note
- **Color-coded** using the color picker (for categorization)
- **Tagged** with quick-access tags (stored in localStorage)

## Real-Time Collaboration

Multiple users can annotate the same session simultaneously. Changes sync in real-time via WebSocket — no page refresh needed.

## Guest Access

Generate a shareable guest link from any session (`/?token=xxx`). Guests can:

- View and add notes to that session
- Edit and delete their own notes

Guests **cannot** manage sessions (create, delete, or switch sessions).

## Export

Export notes for use in editing software:

- **REAPER** — CSV with timeline markers
- **Audition** — CSV with timeline markers
- **Resolve** — CMX3600 EDL format

Exported timestamps use the timezone configured in `RECNOTES_EXPORT_TIMEZONE` (default: `UTC`).

## Keyboard Shortcuts

<!-- TODO: document actual shortcuts once finalized -->
