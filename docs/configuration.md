# Configuration

Recording Notes can be configured via `~/.recordingnotes/settings.conf` (key=value format) or environment variables. Environment variables take highest priority.

## Settings File

Create `~/.recordingnotes/settings.conf` with key=value pairs:

```ini
# Server port
RECNOTES_PORT=3000

# Database path (npm native sqlite)
RECNOTES_DB_PATH=~/.recordingnotes/default.db

# Authentication (optional — public access when unset)
RECNOTES_AUTH_USERNAME=admin
RECNOTES_AUTH_PASSWORD=CHANGE_ME_TO_A_STRONG_PASSWORD

# Session secret (for cookie signing)
RECNOTES_SESSION_SECRET=your_secret_here

# API token (auto-generated from AUTH credentials if not set)
RECNOTES_AUTH_API_TOKEN=your_api_token

# Export timezone
RECNOTES_EXPORT_TIMEZONE=UTC
```

Comments (lines starting with `#`) and empty lines are ignored. Values can be optionally quoted.

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `RECNOTES_PORT` | `3000` | Server port |
| `RECNOTES_DB_PATH` | `~/.recordingnotes/default.db` | SQLite database path |
| `RECNOTES_AUTH_USERNAME` | — | Login username (enables auth) |
| `RECNOTES_AUTH_PASSWORD` | — | Login password |
| `RECNOTES_AUTH_API_TOKEN` | auto (SHA-256) | Webhook/triggers token |
| `RECNOTES_SESSION_SECRET` | random hex | Cookie signing secret |
| `RECNOTES_EXPORT_TIMEZONE` | `UTC` | Timezone for exported timestamps |

## Requirements

- **Node.js >= 23.9.0** — required for native `node:sqlite`
- Best used behind a HTTPS server + proxy (e.g. [Caddy](https://github.com/caddyserver/caddy))

## Clock Synchronization

Recording Notes uses the server's system clock for timestamps and the client's clock for timer display. If clocks drift between server and clients, timer start/stop times and note timestamps will be inaccurate.

Enable NTP on all devices (server and clients) to keep clocks in sync.

**Debian/Ubuntu:**
```bash
sudo apt install systemd-timesyncd
sudo timedatectl set-ntp true
```

If `timedatectl` reports "NTP not supported", fall back to:

```bash
sudo apt install ntpdate
sudo ntpdate -s pool.ntp.org
```

**macOS:** (enabled by default)

```bash
sudo sntp -S pool.ntp.org  # force immediate sync
```

Verify with `timedatectl status` — look for `System clock synchronized: yes`.
