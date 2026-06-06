# Tech Stack (Simplified)

## Backend
- **Core Runtime:** Node.js (Stable LTS).
- **Web Server:** Node.js built-in `http` module or a minimal framework like `express` for basic routing.
- **Native Modules:** Utilizing Node.js built-in modules where possible (e.g., `crypto` for auth tokens, `fs` for file handling).

## Frontend
- **Language:** Plain Vanilla JavaScript (ES6+).
- **Persistence:** `localStorage` for client-side state (e.g., UI preferences, Quick Tags).
- **Templating:** Server-side rendered (SSR) HTML using simple template literals or a lightweight library, or plain static HTML with client-side DOM manipulation.
- **Styling:** Standard CSS3 with CSS Variables for theme management. No pre-processors or utility frameworks.

## Database
- **Engine:** `node:sqlite` (Node.js native SQLite module).
- **Management:** Raw SQL queries. Timestamps are stored as `REAL` (floating-point seconds) for millisecond precision.

## Communication
- **Real-time:** Server-Sent Events (SSE) for one-way updates (session notifications) and standard `fetch` API for note creation and updates.

## Authentication
- **Mechanism:** Simple session-based authentication using cookies and a local user table.