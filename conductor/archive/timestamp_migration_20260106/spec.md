# Specification: Millisecond Timestamp Migration (REAL)

## Overview
Update the Recording Notes system to use floating-point seconds (`REAL`) for all note timestamps. This replaces the current string-based (`TEXT`) storage, allowing for 0.1s precision in the UI and full millisecond (`.mmm`) precision in CSV exports.

## Functional Requirements

### 1. Database Schema Refactor
- Change `notes.timestamp` column type from `TEXT` to `REAL`.
- Implement a fresh database initialization process that wipes existing test data.

### 2. High-Precision Note Capture
- **Client-Side:** Calculate note timestamps as floating-point seconds.
- **Elapsed Mode:** `(Date.now() - started_at_ms) / 1000`.
- **Clock Mode:** Total seconds elapsed since the start of the current day (UTC).
- **API:** Send the raw float value to the `POST /api/sessions/:id/notes` endpoint.

### 3. UI Display (0.1s Precision)
- Update the live header clock and note stream to display `HH:MM:SS.s`.
- Increase the live clock update frequency to 100ms.

### 4. REAPER CSV Export (Millisecond Precision)
- Update the server-side export logic to convert `REAL` seconds back into `HH:MM:SS.mmm` strings.

## Acceptance Criteria
- [ ] Database `notes` table uses `REAL` for `timestamp`.
- [ ] New notes are saved as floating-point numbers.
- [ ] UI displays timestamps with one decimal place (e.g., `00:01:23.4`).
- [ ] Exported CSV displays timestamps with three decimal places (e.g., `00:01:23.456`).
- [ ] Database is cleared of all legacy string-based entries.
