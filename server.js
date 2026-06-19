import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import path from 'path';

import { authIsRequired, getSessionSecret } from './middleware/config-accessors.js';
import { checkAuth } from './middleware/auth.js';
import { initDb, getDb } from './services/db.js';
import * as sessions from './services/sessions.js';
import { startServer } from './startup.js';
import authRoutes from './routes/auth.js';
import sessionsRoutes from './routes/sessions.js';
import notesRoutes from './routes/notes.js';
import timerRoutes from './routes/timer.js';
import exportRoutes from './routes/export.js';
import webhooksRoutes from './routes/webhooks.js';
import triggersRoutes from './routes/triggers.js';
import { wss, broadcastToAll, broadcastToRoom, broadcastSessionList, broadcastNoteUpdate } from './websocket/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.set('trust proxy', 1);

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

// Root route requires auth (or valid guest token)
app.get('/', (req, res) => {
  if (authIsRequired()) {
    // Already authenticated or guest session active
    if (req.session?.authenticated || req.session?.guestToken) {
      return res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }

    // Validate guest token from query string
    if (req.query?.token) {
      const db = getDb();
      const session = sessions.getSessionByGuestToken(db, req.query.token);
      if (session) {
        req.session.guestToken = req.query.token;
        return res.sendFile(path.join(__dirname, 'public', 'index.html'));
      }
    }

    return res.redirect('/login?returnTo=/');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files (publicly accessible, including from login page)
app.use(express.static(path.join(__dirname, 'public')));
// Webhook routes (before auth — they use token auth)
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/triggers', triggersRoutes);

// Protected API routes
app.use(checkAuth);
app.get('/api/status', (req, res) => res.json({ status: 'ok' }));
app.use('/api/sessions', sessionsRoutes);
app.use('/api/sessions', timerRoutes);
app.use('/api/sessions', notesRoutes);
app.use('/api/sessions', exportRoutes);

initDb();

if (process.env.NODE_ENV !== 'test') {
  startServer(app, sessionParser);
}

export { app, sessionParser, wss, broadcastToAll, broadcastToRoom, broadcastSessionList, broadcastNoteUpdate };
export default app;
