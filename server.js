import express from 'express';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { getPort, getApiToken, wasApiTokenExplicitlySet, getAuthCredentials, authIsRequired, getSessionSecret, getExportTimezone } from './middleware/config-accessors.js';
import { checkAuth, checkApiTokenAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import { getDb, initDb } from './db.js';
import exportRoutes from './routes/export.js';
import webhooksRoutes from './routes/webhooks.js';
import triggersRoutes from './routes/triggers.js';
import sessionsRoutes from './routes/sessions.js';
import timerRoutes from './routes/timer.js';
import notesRoutes from './routes/notes.js';
import { setupWebSocket, wss, broadcastToAll, broadcastToRoom, broadcastSessionList, broadcastNoteUpdate } from './websocket/index.js';

const app = express();


app.use(express.json());

// Trust the reverse proxy's X-Forwarded-Proto header so Express knows when HTTPS is in use.
// This enables secure: 'auto' on session cookies to work correctly behind nginx/cloudflare/etc.
app.set('trust proxy', 1);

// Rate limiting to prevent brute-force attacks
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

// Auth is only required if both env vars are explicitly set.
// Otherwise the app runs in open/public mode (no login needed).
// Checked dynamically per-request so env changes are picked up.
// Session configuration
const sessionParser = session({
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: 'auto',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
});

app.use(sessionParser);

// Public routes
app.use(authRoutes);

// Root route requires auth
app.get('/', (req, res) => {
  if (authIsRequired() && !req.session?.authenticated) {
    return res.redirect('/login?returnTo=/');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files (publicly accessible, including from login page)
app.use(express.static(path.join(__dirname, 'public')));

// Webhook routes (before auth — they use token auth)
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/triggers', triggersRoutes);

// Protect all following API routes
app.use(checkAuth);
app.get('/api/status', (req, res) => res.json({ status: 'ok' }));
app.use('/api/sessions', sessionsRoutes);
app.use('/api/sessions', timerRoutes);
app.use('/api/sessions', notesRoutes);
app.use('/api/sessions', exportRoutes);

// Health check
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize the database immediately on startup so it's ready for first use

// Initialize the database immediately on startup so it's ready for first use
initDb();

if (process.env.NODE_ENV !== 'test') {
  const desiredPort = getPort();
  let server = null;

  function startServer(port) {
    return new Promise((resolve, reject) => {
      const s = app.listen(port, () => resolve(s));
      s.on('error', (err) => reject(err));
    });
  }

  (async () => {
    let port = desiredPort;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        server = await startServer(port);
        console.log(`\n✓ Recording Notes running at http://localhost:${port}`);
        if (authIsRequired()) {
          console.log('  Auth mode: Login required (RECNOTES_AUTH_USERNAME & RECNOTES_AUTH_PASSWORD set)');
        } else {
          console.warn('  Warning: No authorization configured. Do not use this setup in untrusted environments. See .env.example for details.');
        }
        const token = getApiToken();
        if (token) {
          if (wasApiTokenExplicitlySet()) {
            console.log(`  API token: ****${token.slice(-4)}`);
          } else {
            console.log(`  API token (auto-generated): ${token}`);
          }
        }
        // WebSocket setup (only after server is listening)
        setupWebSocket(server, sessionParser);

        // Store server reference for external access (e.g., tests)
        globalThis.__RECNOTES_SERVER_READY__ = true;

        break;
      } catch (err) {
        if (err.code === 'EADDRINUSE' && attempts < maxAttempts - 1) {
          console.warn(`  Port ${port} is in use, trying ${port + 1}...`);
          port++;
          attempts++;
        } else {
          console.error(`  Failed to start server on port ${port}: ${err.message}`);
          console.error('  Set RECNOTES_PORT to a different port and try again.');
          process.exit(1);
        }
      }
    }
  })();
}

export { app, sessionParser, wss, setupWebSocket, broadcastToAll, broadcastToRoom, broadcastSessionList, broadcastNoteUpdate };
export default app;
