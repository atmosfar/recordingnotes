import crypto from 'crypto';
import { getDb } from '../services/db.js';
import * as sessions from '../services/sessions.js';
import { authIsRequired, getApiToken } from './config-accessors.js';

export function authRequired() {
  return authIsRequired();
}

/**
 * Middleware to check user authentication
 */
export function checkAuth(req, res, next) {
  // If auth is not configured, run in open/public mode — everyone is "authenticated"
  if (!authRequired()) {
    req.session.authenticated = true;
    return next();
  }

  // Allow access to login page and its related API
  if (req.path === '/login' || req.path === '/api/login') {
    return next();
  }

  // Exempt integrations from session auth (they use token auth)
  if (req.path.startsWith('/api/webhooks/') || req.path.startsWith('/api/triggers')) {
    return next();
  }

  // If a token is provided in query, try to verify and "login" as guest
  if (req.query.token) {
    const db = getDb();
    const session = sessions.getSessionByGuestToken(db, req.query.token);
    if (session) {
      req.session.guestToken = req.query.token;
      return next();
    }
  }

  if ((req.session && req.session.authenticated) || (req.session && req.session.guestToken)) {
    return next();
  }

  // If it's an API call, return 401
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Otherwise redirect to login
  res.redirect(`/login?returnTo=${encodeURIComponent(req.originalUrl)}`);
}

/**
 * Middleware to ensure guests can only access the session their token belongs to.
 * Authenticated users bypass this check.
 */
export function requireSessionAccess(req, res, next) {
  // Authenticated users have full access
  if (req.session.authenticated) return next();

  // No guest token — already handled by checkAuth
  if (!req.session.guestToken) return next();

  const db = getDb();
  const guestSession = sessions.getSessionByGuestToken(db, req.session.guestToken);
  if (!guestSession) {
    return res.status(401).json({ error: 'Invalid guest token' });
  }

  // Extract session ID from the URL path
  // Routes: /api/sessions/:id/... or /api/sessions/:id/sub/:subId/...
  const parts = req.path.split('/');
  const requestedSessionId = parts[1] ? parts[1].toString() : null;

  if (requestedSessionId && requestedSessionId !== guestSession.id.toString()) {
    return res.status(403).json({ error: 'Guest access limited to invited session' });
  }

  next();
}

/**
 * Middleware to check API token
 */
export function checkApiTokenAuth(req, res, next) {
  const validToken = getApiToken();

  // If no API token is configured, endpoints are public
  if (!validToken) {
    return next();
  }

  const token = req.params.token || req.query.token || req.headers['x-auth-token'];

  if (token && token.length === validToken.length && crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(validToken)
  )) {
    return next();
  }

  res.status(401).json({ error: 'Unauthorized' });
}
