import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { authIsRequired, getAuthCredentials } from '../middleware/config-accessors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

router.get('/login', (req, res) => {
  // If auth is not configured, redirect to the main app
  if (!authIsRequired()) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'));
});

router.post('/login', loginLimiter, (req, res) => {
  const { username, password, rememberMe } = req.body;
  const { username: validUser, password: validPass } = getAuthCredentials();

  if (validUser && validPass && username === validUser && password === validPass) {
    // Rotate session: destroy old session ID and create a fresh one.
    // This invalidates any previously issued session cookie for this user,
    // so a compromised session ID can't be reused after a legitimate login.
    req.session.regenerate(() => {
      req.session.authenticated = true;
      if (rememberMe) {
        // Extend session to 30 days when "Remember me" is checked
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000;
      }
      res.json({ status: 'ok' });
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login?cleared=1');
});

export default router;
