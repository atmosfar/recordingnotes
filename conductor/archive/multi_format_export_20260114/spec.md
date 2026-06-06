# Specification: Multi-format Marker Export

## 1. Overview
Currently, the application only supports exporting session notes as REAPER-compatible CSV files. This track will introduce support for Adobe Audition-formatted CSVs and update the user interface to allow users to select their preferred format before downloading.

## 2. Functional Requirements
- **Format Support:**
    - **REAPER CSV:** Existing format (Comma-delimited, specific headers).
    - **Adobe Audition CSV:** New format (Tab-delimited, headers: Name, Start, Duration, Time Format, Type, Description).
- **UI Interaction:**
    - Pressing the "Export" button (desktop or mobile) will now present a format selection choice.
    - Implementing a simple dropdown or selection menu near the export button.
- **Server-Side Export:**
    - Update the `/api/sessions/:id/export` endpoint to accept a `format` query parameter.
    - Default to `reaper` if no parameter is provided.
    - Generate the appropriate file content and headers based on the requested format.

## 3. Technical Architecture
- **Server (`server.js`):**
    - Refactor the export handler to include logic for Audition CSV generation (Tabs as delimiters, simplified columns).
    - Map internal note data to Audition's "Start" and "Duration" requirements.
- **Frontend (`public/app.js` & `index.html`):**
    - Add a hidden format selection UI (e.g., a small menu) that appears when "Export" is clicked.
    - Update `exportFn` to include the `?format=` parameter in the download URL.

## 4. Acceptance Criteria
- [ ] Clicking "Export" provides a choice between "REAPER" and "Adobe Audition".
- [ ] Selecting "REAPER" downloads a `.csv` file in the original format.
- [ ] Selecting "Adobe Audition" downloads a `.csv` file that is tab-delimited and compatible with Audition's marker import.
- [ ] Mobile UI correctly handles the format selection within the overflow menu or a bottom sheet.
