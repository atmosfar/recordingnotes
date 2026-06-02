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
# Server port (default: 3000)
PORT=3000

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
- **Webhooks** — automated session management via SquadCast and Bitfocus Companion integrations

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

## Webhooks

Automate session creation and lifecycle management by sending HTTP POST requests to Recording Notes. Both webhook endpoints require token authentication.

### Authentication

All webhook requests must include the `AUTH_WEBHOOK_TOKEN` (set in `.env`). Pass it via URL parameter, query string, or header:

| Endpoint | Token Location |
|---|---|
| SquadCast | URL path: `/api/webhooks/squadcast/:token` |
| Companion | Header: `Authorization: Bearer <token>` or query: `?token=<token>` |

If `AUTH_WEBHOOK_TOKEN` is not explicitly set, it is auto-generated from your `AUTH_USERNAME` and `AUTH_PASSWORD` (SHA-256 hash of `username:password`).

### SquadCast

**Endpoint:** `POST /api/webhooks/squadcast/:token`

Handles recording lifecycle events. Set this URL in your SquadCast webhook settings.

| Event | Action |
|---|---|
| `recording_session.created` | Creates a new session (skips if `sessionID` already exists) |
| `participant.joined` | Creates a new session (workaround for missing create event) |
| `recording.started` | Marks session as `active`, sets `started_at` |
| `recording.stopped` | Marks session as `completed`, sets `stopped_at` |

**Example payload (`recording_session.created`):**

```json
{
  "name": "recording_session.created",
  "sessionID": "sq-1234567890",
  "sessionTitle": "My Podcast Episode 42"
}
```

**Example curl:**

```bash
curl -X POST http://localhost:3000/api/webhooks/squadcast/YOUR_TOKEN \
  -H "Content-Type: application/json" \
  -d '{"name":"recording_session.created","sessionID":"sq-abc123","sessionTitle":"Test Episode"}'
```

### Bitfocus Companion

**Endpoint:** `POST /api/webhooks/companion`

Control sessions directly from Companion actions (buttons, etc.).

| Action | Body Fields | Description |
|---|---|---|
| `create` | `name` (required) | Create a new session |
| `start` | `id` (required) | Mark an existing session as active |
| `stop` | `id` (required) | Mark an existing session as completed |

**Example curl:**

```bash
# Create a session
curl -X POST "http://localhost:3000/api/webhooks/companion?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"create","name":"Companion Session"}'

# Start the session (use returned id)
curl -X POST "http://localhost:3000/api/webhooks/companion?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"start","id":1}'

# Stop the session
curl -X POST "http://localhost:3000/api/webhooks/companion?token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"stop","id":1}'
```

## Requirements

- Node.js >= 23.9.0 (required for native `node:sqlite`)

## License

MIT
