import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';

describe('Server Basic Functionality', () => {
  let server;
  let baseUrl;

  before(() => {
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

  test('should serve index.html at root', async () => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();
    
    assert.strictEqual(response.status, 200);
    assert.ok(body.includes('<title>Recording Notes</title>'));
  });

  test('should respond to GET /api/status', async () => {
    const response = await fetch(`${baseUrl}/api/status`);
    const data = await response.json();
    
    assert.strictEqual(response.status, 200);
    assert.strictEqual(data.status, 'ok');
    assert.ok(data.database.includes('dev.db') || data.database.includes('test.db'));
  });
});
