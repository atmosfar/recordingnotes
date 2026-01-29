# Specification: CMX3600 EDL Marker Export

## 1. Overview
Introduce the ability to export session notes as a CMX3600 Edit Decision List (EDL) file. This allows markers to be imported directly into professional video editing software like DaVinci Resolve and Adobe Premiere Pro.

## 2. Functional Requirements
- **Export Format:** CMX3600 EDL.
- **Framerate Selection:** 
    - Users must select a framerate before exporting: 23.976 (24000/1001), 24, 25, 29.97 DF (30000/1001), 29.97 NDF (30000/1001), or 30.
- **Timecode Calculation:**
    - Implement frame-accurate conversion from second-based timestamps using the provided SMPTE 12M Drop Frame and Non-Drop Frame formulas.
- **Color Mapping:**
    - Map the application's hex colors to standard Resolve/Premiere color strings (e.g., `|C:ResolveColorBlue`).
- **Entry Numbering:**
    - Use chronological indices (001, 002, etc.) for each marker entry.

## 3. Technical Architecture
- **Server-Side Logic (`server.js`):**
    - Extend the `/api/sessions/:id/export` endpoint to support `format=edl`.
    - Implement the `timeToHmsf` formula in JavaScript on the backend.
- **Frontend UI (`public/app.js` & `index.html`):**
    - Update the "Export" button logic to prompt for framerate when "EDL" is selected.
    - Add "EDL" as an option in the export selection menu.

## 4. Acceptance Criteria
- [ ] EDL file is generated with correct CMX3600 syntax.
- [ ] Timecodes match the expected framerate and drop-frame logic.
- [ ] Colors are correctly mapped to Resolve-compatible strings.
- [ ] Markers import into DaVinci Resolve at the correct timestamps with correct names and colors.

