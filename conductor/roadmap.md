# Project Roadmap

This file tracks upcoming features, bug fixes, and chores that haven't been promoted to full tracks yet.

## Upcoming Features

### Core UX & Interaction
- [ ] **Manual Start/Stop State:** Add a dashboard toggle to manually set `started_at` and `stopped_at`. This allows non-webhook users to trigger the pulsing recording indicator and elapsed timer logic.
- [ ] **Improved Session Creation UX:** Replace the `prompt()` dialog with a proper modal or inline form. Include validation and allow selecting the timestamp mode (Timer vs. Clock) during creation.
- [x] **Quick Tags & Snippets:** Customizable buttons to instantly post common notes (e.g., #retake, #noise, #good).
- [ ] **User Attribution:** Support for "Display Names" and showing initials/names next to notes in the stream.

### Accessibility & Connectivity
- [ ] **Offline Mode:** Implement local queueing (IndexedDB/localStorage) for notes taken while disconnected. Add a "Sync" indicator/button to upload queued data once the WebSocket reconnects.
- [ ] **Responsive CSS Refactor:** Refactor `style.css` to remove fixed `px` sizes in favor of relative units (`rem`, `em`, `dvh`). Improve scaling for various screen sizes and browser font settings.

### Privacy & Management
- [ ] **Restricted Session Links:** Generate unique links for specific sessions that hide the sidebar and session list. Perfect for inviting guests to contribute to a single recording without exposing other project data.
- [ ] **Global Search & Archive:** Search bar for filtering sessions/notes and an "Archive" state to hide old sessions from the main sidebar.
- [ ] **Sync Offset (Nudge):** Global offset tool to align export timestamps with DAW/NLE recordings (e.g., +/- 2 seconds).
- [ ] **Regions Support:** Capture "Duration Notes" (start/end) for span-based markers, exporting as Regions in REAPER or Spans in Resolve.

### Integration
- [ ] **Hardware Feedback:** State API for Bitfocus Companion to allow Stream Deck buttons to reflect live recording status (Red when active, Dim when stopped).

## Technical Debt & Maintenance
- [ ] Performance: Optimize WebSocket broadcasts for extremely large session lists.
- [ ] DX: Improve automated test setup to use dynamic imports consistently across all suites.
