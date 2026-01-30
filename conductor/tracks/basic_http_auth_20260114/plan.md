# Plan: Minimal HTTP Session Authentication

## Phase 1: Basic Session Auth & Middleware
- [x] Task: Update `.env.example` with `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_WEBHOOK_TOKEN`. [60b36b9]
- [x] Task: Install `express-session` dependency. [04eef26]
- [ ] Task: Write failing unit tests in `test/auth.test.js` for user login, session persistence, and unauthorized access redirection.
- [ ] Task: Implement `userAuthMiddleware` and session management in `server.js`.
- [ ] Task: Create `/login` routes and a minimal `public/login.html` page.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Basic Session Auth & Middleware' (Protocol in workflow.md)

## Phase 2: Webhook Token Auth
- [ ] Task: Write failing unit tests in `test/webhook_auth.test.js` for token-based access to SquadCast and Companion routes.
- [ ] Task: Implement `webhookAuthMiddleware` to check for query tokens or auth headers.
- [ ] Task: Apply `webhookAuthMiddleware` to all `/api/webhooks/*` routes.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Webhook Token Auth' (Protocol in workflow.md)

## Phase 3: Integration & UI Polish
- [ ] Task: Add a "Logout" button/link to the main dashboard.
- [ ] Task: Verify that WebSocket connections are correctly handled (or blocked) for unauthenticated users.
- [ ] Task: Run final test suite and verify >80% coverage for new auth logic.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Integration & UI Polish' (Protocol in workflow.md)

