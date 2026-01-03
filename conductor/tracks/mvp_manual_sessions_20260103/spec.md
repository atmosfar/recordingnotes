# Spec: MVP: Manual Recording Sessions

## Overview
This track focuses on the core functionality of the recording notes system, enabling producers to manually create sessions, collaborate on timestamped notes in real-time, and export those notes for post-production in REAPER.

## User Stories
- **Manual Session Creation:** As a producer, I want to create a new recording session and choose whether timestamps should follow the clock (Time-of-Day) or an elapsed timer (Session Time).
- **Collaborative Note-Taking:** As a producer, I want to type notes that appear instantly for all connected users, including my name, the correct timestamp, and a chosen color.
- **Manual Timer Control:** As a producer using Session Time, I want to manually start and stop the timer to match the recording status.
- **CSV Export:** As a producer, I want to download a CSV of the session notes formatted specifically for import into REAPER markers.

## Functional Requirements
- **Session Management:**
    - Persistence of sessions in SQLite.
    - Ability to list, create, and view sessions.
- **Note System:**
    - Real-time updates via Socket.io.
    - Each note captures: Content, Author, Timestamp (formatted based on mode), and Color.
    - Color palette selection (e.g., Red, Blue, Green, Yellow, Orange).
- **Export System:**
    - CSV generation with headers: `Name`, `Start`, `Duration`, `Timebase`, `Color`.
    - REAPER-specific time formatting.
- **Authentication (Minimal for MVP):**
    - Google OAuth for `@mycompany.com`.
    - Simple email/password local login.

## Non-Functional Requirements
- **Latency:** Socket.io updates should be perceived as instantaneous.
- **Persistence:** SQLite database must be updated for every note created.
- **Reliability:** The session timer should be calculated server-side or synchronized to prevent drift between clients.
