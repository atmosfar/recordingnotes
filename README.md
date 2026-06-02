# Recording Notes

Minimalist podcast note-taking system with real-time collaboration.

## Quick Start

```bash
npx recordingnotes start
```

Or install globally:

```bash
npm install -g recordingnotes
recordingnotes start
```

Open `http://localhost:3000` in your browser. No login required by default — just start taking notes.

## Configuration

Copy `.env.example` to `.env` and customize:

```bash
# Database (SQLite, defaults to dev.db)
DB_PATH=./dev.db

# Authentication (optional — public access when unset)
AUTH_USERNAME=admin
AUTH_PASSWORD=password123

# Session secret (for cookie signing)
SESSION_SECRET=your_secret_here

# Webhook token (auto-generated from AUTH credentials if not set)
AUTH_WEBHOOK_TOKEN=your_webhook_token
```

**Authentication modes:**

| `AUTH_USERNAME` | `AUTH_PASSWORD` | Behavior |
|---|---|---|
| Unset | Unset | **Open mode** — no login required |
| Set | Set | **Login required** — credentials checked against env vars |

## Features

- **Real-time note-taking** — multiple users can annotate the same session simultaneously via WebSocket sync
- **Guest access** — generate shareable guest tokens for read-only collaboration (`/?token=xxx`)
- **Session management** — create, list, and delete recording sessions
- **Timestamps** — supports clock time or relative timestamps for podcast recordings
- **Export** — download notes as CSV
- **Webhooks** — receive webhook events from companion apps (SquadCast, etc.)

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/sessions` | List all sessions |
| POST | `/api/sessions` | Create a new session |
| GET | `/api/sessions/:id` | Get session details |
| DELETE | `/api/sessions/:id` | Delete a session |
| POST | `/api/sessions/:id/guest-token` | Generate a guest access token |
| GET | `/api/sessions/:id/notes` | List notes for a session |
| POST | `/api/sessions/:id/notes` | Add a note to a session |
| DELETE | `/api/sessions/:session_id/notes/:note_id` | Delete a note |
| GET | `/api/sessions/:id/export` | Export notes as CSV |
| GET | `/api/status` | Health check |

## Requirements

- Node.js >= 23.9.0 (required for native `node:sqlite`)

## License

ISC
