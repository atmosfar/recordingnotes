import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

test('environment has express installed', () => {
  try {
    require.resolve('express');
    assert.ok(true, 'express is installed');
  } catch (e) {
    assert.fail('express is not installed');
  }
});
