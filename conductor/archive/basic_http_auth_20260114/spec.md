# Specification: Minimal HTTP Session Authentication

## 1. Overview
Implement a basic session-based authentication system for users and a token-based authentication system for automated external services (webhooks).

## 2. Functional Requirements
- **User Authentication:**
    - Credentials verified against `AUTH_USERNAME` and `AUTH_PASSWORD` in `.env`.
    - Unauthenticated users accessing the root (`/`) or `/api/*` are redirected/blocked.
    - Custom `/login` page establishes a cookie-based session.
- **Webhook Authentication:**
    - External services (SquadCast, Companion) must provide a `?token=` query parameter or `X-Auth-Token` header matching `AUTH_WEBHOOK_TOKEN` in `.env`.
    - Webhook routes (`/api/webhooks/*`) use this token-based bypass instead of session cookies.
- **Logout:** Simple route to clear the user session.

## 3. Technical Architecture
- **Environment Variables:**
    - `AUTH_USERNAME`: Dashboard username.
    - `AUTH_PASSWORD`: Dashboard password.
    - `AUTH_WEBHOOK_TOKEN`: Shared secret for external integrations.
- **Middleware:**
    - `userAuthMiddleware`: Checks for valid session cookie.
    - `webhookAuthMiddleware`: Checks for valid token in query/header.
- **Routes:**
    - `GET /login`, `POST /login`: User login management.
    - `/api/webhooks/*`: Protected by `webhookAuthMiddleware`.
    - All other routes: Protected by `userAuthMiddleware`.

## 4. Acceptance Criteria
- [ ] Dashboard is inaccessible without user login.
- [ ] Webhooks fail without the correct `?token=` parameter.
- [ ] Webhooks succeed when the correct `?token=` is provided.
- [ ] User sessions persist across page reloads until logout.
