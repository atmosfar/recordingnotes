import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../server.js';

describe('Static File Serving', () => {
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

  test('should serve index.html', async () => {
    const response = await fetch(`${baseUrl}/`);
    const body = await response.text();
    
    assert.strictEqual(response.status, 200);
    assert.ok(body.includes('<title>Recording Notes</title>'));
  });

  test('should serve app.js', async () => {
    const response = await fetch(`${baseUrl}/app.js`);
    const body = await response.text();
    
    assert.strictEqual(response.status, 200);
    assert.ok(body.includes('currentSessionId'));
  });
});
