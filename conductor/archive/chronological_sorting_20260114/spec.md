# Specification: Chronological Note Sorting

## 1. Overview
Currently, notes in the note stream are appended in the order they arrive at the client, regardless of their internal timestamp. This leads to visual inconsistencies, especially when notes are sent with a delay or out of sequence. This track will implement smart client-side sorting to ensure that notes are always displayed in chronological order based on their `timestamp` value, including robust handling for midnight wrap-around scenarios in "Time-of-Day" sessions.

## 2. Functional Requirements
- **Server-Side Ordering:** Maintain the existing `created_at ASC` ordering in the database queries.
- **Client-Side Smart Insertion:** 
    - When a new note is received, it must be inserted into the DOM at the correct chronological position based on its `timestamp`.
- **Midnight Wrap-Around Logic:**
    - In "Time-of-Day" mode, timestamps represent seconds since midnight. 
    - If a session spans midnight, a note with a timestamp of `100` (00:01:40 AM) should appear *after* a note with a timestamp of `86300` (11:58:20 PM).
    - The logic must detect these large jumps to ensure the chronological sequence of the *recording* is preserved, even if the absolute time values reset.
- **Consistency:** The UI must always display notes from top to bottom in the order they were intended to be recorded.

## 3. Technical Architecture
- **Frontend Logic (`public/app.js`):**
    - Refactor `renderNotes` to implement a comparison function that handles wrap-around.
    - **Heuristic for Wrap-Around:** If the difference between two timestamps is extreme (e.g., > 12 hours), the smaller value is considered "later" in the sequence.
    - Use `insertBefore` to place new notes at the identified index.

## 4. Acceptance Criteria
- [ ] Notes are sorted chronologically by timestamp.
- [ ] Notes spanning midnight (e.g., 11:59 PM followed by 12:01 AM) are sorted correctly.
- [ ] Real-time WebSocket pushes respect this ordering.
- [ ] No layout shifts or performance lag during insertion into large streams.
