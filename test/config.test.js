import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  getConfig,
  resetConfig,
  parseConfigFile,
  loadSettingsFile,
  SETTINGS_FILE,
  DEFAULTS,
} from '../services/config.js';
import { validateTimezone } from '../middleware/config-accessors.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Temp directory for test config files (inside project, writable)
const TEST_CONFIG_DIR = join(__dirname, '..', 'test-config-tmp');
const TEST_SETTINGS_FILE = join(TEST_CONFIG_DIR, 'settings.conf');

describe('parseConfigFile', () => {
  test('parses simple key=value pairs', () => {
    const result = parseConfigFile('KEY=value\nKEY2=value2');
    assert.strictEqual(result.KEY, 'value');
    assert.strictEqual(result.KEY2, 'value2');
  });

  test('ignores comment lines', () => {
    const result = parseConfigFile('# this is a comment\nKEY=value');
    assert.strictEqual(result.KEY, 'value');
    assert.strictEqual(Object.keys(result).length, 1);
  });

  test('ignores empty lines', () => {
    const result = parseConfigFile('\n\nKEY=value\n\n');
    assert.strictEqual(result.KEY, 'value');
    assert.strictEqual(Object.keys(result).length, 1);
  });

  test('strips double-quoted values', () => {
    const result = parseConfigFile('KEY="quoted value"');
    assert.strictEqual(result.KEY, 'quoted value');
  });

  test('strips single-quoted values', () => {
    const result = parseConfigFile("KEY='single quoted'");
    assert.strictEqual(result.KEY, 'single quoted');
  });

  test('trims whitespace around keys and values', () => {
    const result = parseConfigFile('  KEY  =  value  ');
    assert.strictEqual(result.KEY, 'value');
  });

  test('skips lines without equals sign', () => {
    const result = parseConfigFile('no equals here\nKEY=value');
    assert.strictEqual(Object.keys(result).length, 1);
    assert.strictEqual(result.KEY, 'value');
  });

  test('handles empty input', () => {
    const result = parseConfigFile('');
    assert.strictEqual(Object.keys(result).length, 0);
  });

  test('handles RECNOTES_ prefixed keys', () => {
    const result = parseConfigFile('RECNOTES_PORT=8080\nRECNOTES_EXPORT_TIMEZONE="Europe/London"');
    assert.strictEqual(result.RECNOTES_PORT, '8080');
    assert.strictEqual(result.RECNOTES_EXPORT_TIMEZONE, 'Europe/London');
  });
});

describe('getConfig priority', () => {
  // Save original env values to restore later
  const savedEnv = {};

  before(() => {
    for (const key of ['RECNOTES_PORT', 'RECNOTES_EXPORT_TIMEZONE', 'RECNOTES_SESSION_SECRET', 'RECNOTES_AUTH_USERNAME', 'RECNOTES_AUTH_PASSWORD', 'RECNOTES_DB_PATH', 'RECNOTES_CUSTOM_THING']) {
      savedEnv[key] = process.env[key];
    }
    resetConfig();
  });

  after(() => {
    resetConfig();
    // Restore original env values
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    // Clean up temp dir
    if (existsSync(TEST_CONFIG_DIR)) {
      rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
    }
  });

  test('returns defaults when no env vars or settings file', () => {
    // Clear env vars that dotenv might have set
    delete process.env.RECNOTES_PORT;
    delete process.env.RECNOTES_EXPORT_TIMEZONE;
    resetConfig();
    const config = getConfig();
    assert.strictEqual(config.RECNOTES_PORT, '3000');
    assert.strictEqual(config.RECNOTES_EXPORT_TIMEZONE, 'UTC');
  });

  test('env vars override defaults', () => {
    delete process.env.RECNOTES_PORT;
    resetConfig();
    process.env.RECNOTES_PORT = '9999';
    const config = getConfig();
    assert.strictEqual(config.RECNOTES_PORT, '9999');
    delete process.env.RECNOTES_PORT;
  });

  test('env vars override settings file values', () => {
    delete process.env.RECNOTES_PORT;
    resetConfig();
    process.env.RECNOTES_PORT = '8888';
    const config = getConfig();
    assert.strictEqual(config.RECNOTES_PORT, '8888');
    delete process.env.RECNOTES_PORT;
  });

  test('picks up new env vars between calls', () => {
    resetConfig();
    delete process.env.RECNOTES_EXPORT_TIMEZONE;
    const config1 = getConfig();
    assert.strictEqual(config1.RECNOTES_EXPORT_TIMEZONE, 'UTC');

    process.env.RECNOTES_EXPORT_TIMEZONE = 'America/New_York';
    const config2 = getConfig();
    assert.strictEqual(config2.RECNOTES_EXPORT_TIMEZONE, 'America/New_York');

    delete process.env.RECNOTES_EXPORT_TIMEZONE;
  });

  test('surfaces arbitrary RECNOTES_* env vars', () => {
    resetConfig();
    process.env.RECNOTES_CUSTOM_THING = 'hello';
    const config = getConfig();
    assert.strictEqual(config.RECNOTES_CUSTOM_THING, 'hello');
    delete process.env.RECNOTES_CUSTOM_THING;
  });

  test('empty env var falls through to default', () => {
    resetConfig();
    process.env.RECNOTES_PORT = '';
    const config = getConfig();
    assert.strictEqual(config.RECNOTES_PORT, '3000');
    delete process.env.RECNOTES_PORT;
  });
});

describe('DEFAULTS', () => {
  test('contains expected keys', () => {
    assert.ok('RECNOTES_PORT' in DEFAULTS);
    assert.ok('RECNOTES_DB_PATH' in DEFAULTS);
    assert.ok('RECNOTES_EXPORT_TIMEZONE' in DEFAULTS);
  });

  test('RECNOTES_PORT defaults to 3000', () => {
    assert.strictEqual(DEFAULTS.RECNOTES_PORT, '3000');
  });

  test('RECNOTES_EXPORT_TIMEZONE defaults to UTC', () => {
    assert.strictEqual(DEFAULTS.RECNOTES_EXPORT_TIMEZONE, 'UTC');
  });
});

describe('validateTimezone', () => {
  test('accepts valid IANA timezone names', () => {
    assert.doesNotThrow(() => validateTimezone('UTC'));
    assert.doesNotThrow(() => validateTimezone('America/New_York'));
    assert.doesNotThrow(() => validateTimezone('Europe/London'));
    assert.doesNotThrow(() => validateTimezone('Asia/Tokyo'));
  });

  test('rejects invalid timezone names', () => {
    assert.throws(() => validateTimezone('Invalid/Timezone'), RangeError);
    assert.throws(() => validateTimezone('US/Eastern'), RangeError); // deprecated alias
    assert.throws(() => validateTimezone(''), RangeError);
    assert.throws(() => validateTimezone(null), RangeError);
    assert.throws(() => validateTimezone(123), RangeError);
  });
});
