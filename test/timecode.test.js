import { test, describe } from 'node:test';
import assert from 'node:assert';
import { timeToHmsf, mapColorToResolve } from '../routes/export.js';

describe('Timecode Conversion', () => {
  const FR = {
    '23.976': 24000/1001,
    '24': 24,
    '25': 25,
    '29.97': 30000/1001,
    '30': 30
  };

  test('24 fps NDF', () => {
    assert.strictEqual(timeToHmsf(0, 24, false), '00:00:00:00');
    assert.strictEqual(timeToHmsf(1, 24, false), '00:00:01:00');
    assert.strictEqual(timeToHmsf(60, 24, false), '00:01:00:00');
    assert.strictEqual(timeToHmsf(3600, 24, false), '01:00:00:00');
  });

  test('25 fps NDF', () => {
    assert.strictEqual(timeToHmsf(0, 25, false), '00:00:00:00');
    assert.strictEqual(timeToHmsf(0.04, 25, false), '00:00:00:01');
    assert.strictEqual(timeToHmsf(1, 25, false), '00:00:01:00');
  });

  test('23.976 fps NDF', () => {
    // 1.001 seconds at 23.976 is exactly 24 frames
    assert.strictEqual(timeToHmsf(0, FR['23.976'], false), '00:00:00:00');
    assert.strictEqual(timeToHmsf(1.001, FR['23.976'], false), '00:00:01:00');
    assert.strictEqual(timeToHmsf(60, FR['23.976'], false), '00:00:59:23');
    assert.strictEqual(timeToHmsf(3600, FR['23.976'], false), '00:59:56:10');
  });

  test('29.97 fps NDF', () => {
    assert.strictEqual(timeToHmsf(0, FR['29.97'], false), '00:00:00:00');
    assert.strictEqual(timeToHmsf(1, FR['29.97'], false), '00:00:01:00');
    assert.strictEqual(timeToHmsf(60, FR['29.97'], false), '00:00:59:28');
    assert.strictEqual(timeToHmsf(120, FR['29.97'], false), '00:01:59:26');
    assert.strictEqual(timeToHmsf(600, FR['29.97'], false), '00:09:59:12');
    assert.strictEqual(timeToHmsf(3600, FR['29.97'], false), '00:59:56:12');
  });

  test('30 fps NDF', () => {
    assert.strictEqual(timeToHmsf(0, 30, false), '00:00:00:00');
    assert.strictEqual(timeToHmsf(1, 30, false), '00:00:01:00');
    assert.strictEqual(timeToHmsf(60, 30, false), '00:01:00:00');
    assert.strictEqual(timeToHmsf(600, 30, false), '00:10:00:00');
    assert.strictEqual(timeToHmsf(3600, 30, false), '01:00:00:00');
  });

  test('29.97 fps DF - basic', () => {
    // Verified against libltc and OTIO references
    assert.strictEqual(timeToHmsf(0, FR['29.97'], true), '00:00:00;00');
    assert.strictEqual(timeToHmsf(1, FR['29.97'], true), '00:00:01;00');
    assert.strictEqual(timeToHmsf(5, FR['29.97'], true), '00:00:05;00');
    assert.strictEqual(timeToHmsf(10, FR['29.97'], true), '00:00:10;00');
    assert.strictEqual(timeToHmsf(30, FR['29.97'], true), '00:00:29;29');
    assert.strictEqual(timeToHmsf(59, FR['29.97'], true), '00:00:58;28');
  });

  test('29.97 fps DF - 60s boundary', () => {
    // 60s wall-clock = 1798 frames = 00:00:59;28 (not 00:01:00;02)
    assert.strictEqual(timeToHmsf(60, FR['29.97'], true), '00:00:59;28');
    // 61s wall-clock = 1828 frames = 00:01:01;00 (overflow carry)
    assert.strictEqual(timeToHmsf(61, FR['29.97'], true), '00:01:01;00');
    assert.strictEqual(timeToHmsf(65.5, FR['29.97'], true), '00:01:05;15');
    assert.strictEqual(timeToHmsf(120, FR['29.97'], true), '00:01:59;28');
  });

  test('29.97 fps DF - minute boundaries', () => {
    assert.strictEqual(timeToHmsf(180, FR['29.97'], true), '00:02:59;29');
    assert.strictEqual(timeToHmsf(240, FR['29.97'], true), '00:03:59;29');
    assert.strictEqual(timeToHmsf(300, FR['29.97'], true), '00:04:59;29');
    assert.strictEqual(timeToHmsf(360, FR['29.97'], true), '00:05:59;29');
    assert.strictEqual(timeToHmsf(420, FR['29.97'], true), '00:06:59;29');
    assert.strictEqual(timeToHmsf(480, FR['29.97'], true), '00:08:00;02');
    assert.strictEqual(timeToHmsf(540, FR['29.97'], true), '00:09:00;02');
  });

  test('29.97 fps DF - 10-minute boundary', () => {
    // 599s = 17952 frames, just before the 10-min mark
    assert.strictEqual(timeToHmsf(599, FR['29.97'], true), '00:09:59;00');
    assert.strictEqual(timeToHmsf(599.9, FR['29.97'], true), '00:09:59;27');
    // 599.99-599.999 round to 17982 frames = 00:10:00;00
    assert.strictEqual(timeToHmsf(599.99, FR['29.97'], true), '00:10:00;00');
    assert.strictEqual(timeToHmsf(599.999, FR['29.97'], true), '00:10:00;00');
    assert.strictEqual(timeToHmsf(600, FR['29.97'], true), '00:10:00;00');
    assert.strictEqual(timeToHmsf(600.001, FR['29.97'], true), '00:10:00;00');
    assert.strictEqual(timeToHmsf(600.033, FR['29.97'], true), '00:10:00;01');
  });

  test('29.97 fps DF - extended', () => {
    assert.strictEqual(timeToHmsf(660, FR['29.97'], true), '00:10:59;28');
    assert.strictEqual(timeToHmsf(720, FR['29.97'], true), '00:11:59;28');
    assert.strictEqual(timeToHmsf(900, FR['29.97'], true), '00:14:59;29');
    assert.strictEqual(timeToHmsf(1200, FR['29.97'], true), '00:20:00;00');
    assert.strictEqual(timeToHmsf(1800, FR['29.97'], true), '00:30:00;00');
    assert.strictEqual(timeToHmsf(2400, FR['29.97'], true), '00:40:00;00');
    assert.strictEqual(timeToHmsf(3000, FR['29.97'], true), '00:50:00;00');
    assert.strictEqual(timeToHmsf(3600, FR['29.97'], true), '01:00:00;00');
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
