import { test, describe } from 'node:test';
import assert from 'node:assert';
import { timeToHmsf, mapColorToResolve } from '../server.js';

describe('Timecode Conversion', () => {
  const FR = {
    '23.976': 24000/1001,
    '24': 24,
    '25': 25,
    '29.97': 30000/1001,
    '30': 30
  };

  test('24 fps NDF', () => {
    assert.strictEqual(timeToHmsf(1, 24, false), '00:00:01:00');
    assert.strictEqual(timeToHmsf(0, 24, false), '00:00:00:00');
    assert.strictEqual(timeToHmsf(3600, 24, false), '01:00:00:00');
  });

  test('25 fps NDF', () => {
    assert.strictEqual(timeToHmsf(1, 25, false), '00:00:01:00');
    assert.strictEqual(timeToHmsf(0.04, 25, false), '00:00:00:01');
  });

  test('23.976 fps NDF', () => {
    // 1.001 seconds at 23.976 is exactly 24 frames
    assert.strictEqual(timeToHmsf(1.001, FR['23.976'], false), '00:00:01:00');
  });

  test('29.97 fps DF', () => {
    // 60 seconds wall clock maps to 00:01:00;02 in the user formula
    assert.strictEqual(timeToHmsf(60, FR['29.97'], true), '00:01:00;02');
    
    // 599.999 seconds maps to 00:10:00;17
    assert.strictEqual(timeToHmsf(599.999, FR['29.97'], true), '00:10:00;17');
    
    // 600s (10 mins) maps to 00:10:00;18
    assert.strictEqual(timeToHmsf(600, FR['29.97'], true), '00:10:00;18');
  });
});

describe('Color Mapping', () => {
  test('Standard colors', () => {
    assert.strictEqual(mapColorToResolve('#FF4D4D'), 'Red');
    assert.strictEqual(mapColorToResolve('#2ECC71'), 'Green');
    assert.strictEqual(mapColorToResolve('#3498DB'), 'Blue');
    assert.strictEqual(mapColorToResolve('#F1C40F'), 'Yellow');
  });

  test('Unknown colors default to Blue', () => {
    assert.strictEqual(mapColorToResolve('#000000'), 'Blue');
    assert.strictEqual(mapColorToResolve(null), 'Blue');
  });
});
