import 'dotenv/config';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SETTINGS_DIR = join(homedir(), '.recordingnotes');
const SETTINGS_FILE = join(SETTINGS_DIR, 'settings.conf');

const DEFAULTS = {
  RECNOTES_PORT: '3000',
  RECNOTES_DB_PATH: join(SETTINGS_DIR, 'default.db'),
  RECNOTES_EXPORT_TIMEZONE: 'UTC',
};

let cachedFileSettings = null;

/**
 * Parse a simple key=value config file.
 * Supports:
 *   - Lines starting with # are comments
 *   - Empty/whitespace-only lines are skipped
 *   - Values can be optionally quoted (single or double)
 *   - Leading/trailing whitespace on keys and values is trimmed
 */
function parseConfigFile(content) {
  const result = {};
  const lines = content.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    // Strip surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

/**
 * Load settings from the global config file.
 * Cached after first read. Returns an empty object if the file doesn't exist.
 */
function loadSettingsFile() {
  if (cachedFileSettings !== null) return cachedFileSettings;
  // Skip settings file in test mode to avoid leaking local config into tests
  if (process.env.NODE_ENV === 'test') {
    cachedFileSettings = {};
    return cachedFileSettings;
  }
  if (!existsSync(SETTINGS_FILE)) {
    cachedFileSettings = {};
    return cachedFileSettings;
  }
  try {
    const content = readFileSync(SETTINGS_FILE, 'utf-8');
    cachedFileSettings = parseConfigFile(content);
  } catch {
    cachedFileSettings = {};
  }
  return cachedFileSettings;
}

/**
 * Build the effective configuration:
 *   1. Start with defaults
 *   2. Overlay values from ~/.recordingnotes/settings.conf (cached)
 *   3. Overlay environment variables (highest priority, read fresh every call)
 *
 * Environment variables are re-read on every call so that tests and runtime
 * changes are picked up. Only the file read is cached.
 */
function getConfig() {
  // 1. Defaults
  const config = { ...DEFAULTS };

  // 2. Global settings file (cached)
  const fileSettings = loadSettingsFile();
  for (const [key, value] of Object.entries(fileSettings)) {
    if (value !== undefined && value !== '') {
      config[key] = value;
    }
  }

  // 3. Environment variables (highest priority, always fresh)
  for (const key of Object.keys(config)) {
    if (process.env[key] !== undefined && process.env[key] !== '') {
      config[key] = process.env[key];
    }
  }

  // Also surface any RECNOTES_* env vars not in defaults
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('RECNOTES_') && !(key in config)) {
      config[key] = value;
    }
  }

  return config;
}

/**
 * Clear the cached file settings. Useful for tests.
 */
function resetConfig() {
  cachedFileSettings = null;
}

/**
 * Ensure the settings directory exists.
 */
function ensureSettingsDir() {
  if (!existsSync(SETTINGS_DIR)) {
    mkdirSync(SETTINGS_DIR, { recursive: true });
  }
}

export {
  getConfig,
  resetConfig,
  parseConfigFile,
  loadSettingsFile,
  SETTINGS_FILE,
  SETTINGS_DIR,
  DEFAULTS,
  ensureSettingsDir,
};
