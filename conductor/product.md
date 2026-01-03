# Product Guide

## Initial Concept
I want to build a system for taking live timestamped notes during a podcast recording session. The system should be hosted on a server (eg running node) so that clients can connect from their browsers and take notes in parallel, collaboratively. The timestamp of the notes could come from two origins: time-of-day, or recording session time. The recording session time would be triggered by a webhook from riverside, squadcast, or by bitfocus companion sending an http request. The creation of the sessions themselves would be done either manually or through a webhook from riverside or squadcast. Access to the dashboard should be gated through a Google account login. The sessions should be saved to a lightweight database for retrospective access through the session list. The session notes should be exportable in a number of formats which are to be confirmed, but initially they should be CSV.

## Target Audience
- **Producers/Editors:** The primary users who need to log specific moments, edit points, and highlights during a live recording for post-production efficiency.

## Core Features
- **Real-time Collaboration:**
    - **User Presence:** Ability to see who else is currently viewing or editing the session notes.
    - **Live Typing Indicators:** Visual cues to show when other users are actively typing to prevent collision and enhance coordination.
    - **Self-Edit Only:** Users can create notes freely but can only edit the notes they personally created to maintain accountability and data integrity.

## User Interface
- **Chronological Stream:** The note-taking interface will present a single, scrolling stream of notes sorted by timestamp, providing a clear timeline of the recording session.

## Export & Integration
- **Primary Output:** CSV is the priority format.
- **Editor Compatibility:** Specific focus on importing notes into **REAPER** and **Davinci Resolve**, recognizing that they require different CSV marker formats.
- **Extensibility:** The export system should be designed with a plugin architecture or configuration layer, allowing users to define custom export formats for other tools or workflows.

## Access Control & Security
- **Hybrid Authentication:**
    - **Google Workspace (Domain Restricted):** Seamless login for internal users with a `@mycompany.com` email address.
    - **External Access:** A manual allowlist for external collaborators (e.g., freelancers, guests) who can log in using a standard email/password combination.