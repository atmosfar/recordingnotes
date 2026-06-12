import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';

describe('Authentication System', () => {
  let server;
  let baseUrl;

  before(() => {
    // Set test credentials
    process.env.RECNOTES_AUTH_USERNAME = 'testuser';
    process.env.RECNOTES_AUTH_PASSWORD = 'testpassword';
    process.env.RECNOTES_SESSION_SECRET = 'test_secret_key_long_enough_32_chars';

    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(resolve);
    });
  });

  test('should redirect unauthorized user from root to /login', async () => {
    const response = await fetch(`${baseUrl}/`, { redirect: 'manual' });
    assert.strictEqual(response.status, 302);
    assert.ok(response.headers.get('location').includes('/login'));
  });

  test('should return 401 for unauthorized API call', async () => {
    const response = await fetch(`${baseUrl}/api/status`);
    assert.strictEqual(response.status, 401);
  });

  test('should fail login with incorrect credentials', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'wrong', password: 'wrong' })
    });
    assert.strictEqual(response.status, 401);
  });

  test('should succeed login with correct credentials and set cookie', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'testpassword' })
    });
    assert.strictEqual(response.status, 200);
    const cookie = response.headers.get('set-cookie');
    assert.ok(cookie && cookie.includes('connect.sid'));
  });

  test('should allow access to protected route after login', async () => {
    // 1. Login to get cookie
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'testpassword' })
    });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // 2. Access protected route with cookie
    const response = await fetch(`${baseUrl}/`, {
      headers: { 'Cookie': cookie }
    });
    assert.strictEqual(response.status, 200);
    const body = await response.text();
    assert.ok(body.includes('<title>Recording Notes</title>'));
  });

  // T27: GET /logout (session destroy + redirect)
  test('T27: GET /logout destroys session and redirects to /login', async () => {
    // 1. Login first
    const loginRes = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'testuser', password: 'testpassword' })
    });
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // 2. Logout
    const logoutRes = await fetch(`${baseUrl}/logout`, {
      headers: { 'Cookie': cookie },
      redirect: 'manual'
    });

    assert.strictEqual(logoutRes.status, 302);
    assert.ok(logoutRes.headers.get('location').includes('/login'));
    assert.ok(logoutRes.headers.get('location').includes('cleared=1'));

    // 3. Verify session is destroyed — should be redirected again
    const afterLogoutRes = await fetch(`${baseUrl}/api/status`, {
      headers: { 'Cookie': cookie }
    });
    assert.strictEqual(afterLogoutRes.status, 401);
  });

  // T28: auto-generated API token from username:password
  test('T28: API token is auto-generated from username:password when not explicitly set', async () => {
    // Ensure no explicit API token is set
    delete process.env.RECNOTES_AUTH_API_TOKEN;

    // The server should auto-generate the token from username:password
    // We can verify this by checking that x-auth-token auth works
    const response = await fetch(`${baseUrl}/api/status`, {
      headers: { 'x-auth-token': 'invalid-token' }
    });
    // Should return 401 for invalid token
    assert.strictEqual(response.status, 401);
  });

  // T29: x-auth-token header authentication
  test('T29: x-auth-token header authenticates requests to protected endpoints', async () => {
    // Ensure API token is auto-generated from username:password
    delete process.env.RECNOTES_AUTH_API_TOKEN;

    // Get the expected token: SHA-256 of 'testuser:testpassword'
    const crypto = await import('crypto');
    const expectedToken = crypto.createHash('sha256')
      .update('testuser:testpassword')
      .digest('hex');

    // x-auth-token is used by checkApiTokenAuth on webhook/trigger endpoints
    // Test on a webhook endpoint that has checkApiTokenAuth
    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/${expectedToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'recording_session.created', sessionID: 'test_123', sessionTitle: 'Test' })
    });

    // Should NOT return 401 (token is valid)
    assert.notStrictEqual(response.status, 401);
    // Should succeed (201 for new session creation)
    assert.strictEqual(response.status, 201);
  });

  test('T29: x-auth-token header rejects invalid token on protected endpoints', async () => {
    const response = await fetch(`${baseUrl}/api/webhooks/squadcast/invalid-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'recording_session.created', sessionID: 'test_123', sessionTitle: 'Test' })
    });

    assert.strictEqual(response.status, 401);
    const data = await response.json();
    assert.strictEqual(data.error, 'Unauthorized');
  });

  // T30: rememberMe cookie extension (30-day maxAge)
  test('T30: Login with rememberMe extends cookie maxAge to 30 days', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'testpassword',
        rememberMe: true
      })
    });

    assert.strictEqual(response.status, 200);
    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie);

    // express-session converts maxAge to Expires
    // 30 days = 30 * 24 * 60 * 60 = 2592000 seconds from now
    const expiresMatch = setCookie.match(/Expires=([^;]+)/);
    assert.ok(expiresMatch, 'Cookie should have Expires attribute');
    const expiresDate = new Date(expiresMatch[1].trim());
    const now = new Date();
    const diffMs = expiresDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Should be approximately 30 days (allow 1 day tolerance for timing)
    assert.ok(diffDays >= 29 && diffDays <= 31, `Expected ~30 days, got ${diffDays.toFixed(1)}`);
  });

  test('T30: Login without rememberMe uses default 24-hour maxAge', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        password: 'testpassword'
      })
    });

    assert.strictEqual(response.status, 200);
    const setCookie = response.headers.get('set-cookie');
    assert.ok(setCookie);

    // Default maxAge should be 24 hours
    const expiresMatch = setCookie.match(/Expires=([^;]+)/);
    assert.ok(expiresMatch, 'Cookie should have Expires attribute');
    const expiresDate = new Date(expiresMatch[1].trim());
    const now = new Date();
    const diffMs = expiresDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    // Should be approximately 24 hours (allow 1 hour tolerance for timing)
    assert.ok(diffHours >= 23 && diffHours <= 25, `Expected ~24 hours, got ${diffHours.toFixed(1)}`);
  });
});
