import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';
import { resetDbInstance } from '../db.js';

describe('Webhook Token Authentication - Iterative', () => {
  let server;
  let baseUrl;

  before(() => {
    process.env.AUTH_WEBHOOK_TOKEN = 'secret_webhook_token';
    process.env.DB_PATH = 'test-webhook-auth.db';
    resetDbInstance();
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

  describe('SquadCast', () => {
    test('should return 401 for SquadCast webhook without token', async () => {
      const response = await fetch(`${baseUrl}/api/webhooks/squadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' })
      });
      assert.strictEqual(response.status, 401);
    });

    test('should succeed for SquadCast webhook with query token', async () => {
      const uniqueId = `sq-${Date.now()}`;
      const response = await fetch(`${baseUrl}/api/webhooks/squadcast?token=secret_webhook_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'recording_session.created', sessionID: uniqueId, sessionTitle: 'Test' })
      });
      assert.strictEqual(response.status, 201);
    });
  });

  describe('Companion', () => {
    test('should return 401 for Companion webhook without token', async () => {
      const response = await fetch(`${baseUrl}/api/webhooks/companion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: 'Test' })
      });
      assert.strictEqual(response.status, 401);
    });

    test('should succeed for Companion webhook with correct token', async () => {
      const uniqueName = `Companion ${Date.now()}`;
      const response = await fetch(`${baseUrl}/api/webhooks/companion?token=secret_webhook_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', name: uniqueName })
      });
      assert.strictEqual(response.status, 201);
    });
  });
});
