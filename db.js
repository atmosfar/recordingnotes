import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { getConfig, SETTINGS_DIR } from './config.js';

let dbInstance = null;
let initializedPaths = new Set();

function getDbPath() {
  const config = getConfig();
  return config.RECNOTES_DB_PATH || join(SETTINGS_DIR, 'default.db');
}

function createDbInstance() {
  if (!dbInstance) {
    const dbPath = getDbPath();
    mkdirSync(dirname(dbPath), { recursive: true });
    dbInstance = new DatabaseSync(dbPath);
  }
  return dbInstance;
}

export function getDb() {
  // Auto-initialize schema if not done yet for this path
  const dbPath = getDbPath();
  if (!initializedPaths.has(dbPath)) {
    initDb();
  }
  return createDbInstance();
}

export function resetDbInstance() {
  dbInstance = null;
  initializedPaths.clear();
}

export function initDb() {
  const dbPath = getDbPath();
  if (initializedPaths.has(dbPath)) return;

  const db = createDbInstance();
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      provider TEXT DEFAULT 'local',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      external_id TEXT,
      guest_token TEXT UNIQUE,
      timestamp_mode TEXT DEFAULT 'clock',
      status TEXT DEFAULT 'active',
      started_at DATETIME,
      stopped_at DATETIME,
      elapsed_ms INTEGER DEFAULT 0,
      last_run_ms INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      user_id INTEGER,
      session_id INTEGER NOT NULL,
      timestamp_ms INTEGER NOT NULL DEFAULT 0,
      timer_position_ms INTEGER,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (session_id) REFERENCES sessions (id)
    );
  `);

  // Migration: add timer_position_ms column if it doesn't exist
  try {
    db.exec('ALTER TABLE notes ADD COLUMN timer_position_ms INTEGER DEFAULT NULL');
  } catch (e) { /* column already exists */ }

  // Migration: add last_run_ms column if it doesn't exist
  try {
    db.exec('ALTER TABLE sessions ADD COLUMN last_run_ms INTEGER DEFAULT 0');
  } catch (e) { /* column already exists */ }

  initializedPaths.add(dbPath);
  console.log('Database initialized at', dbPath);
}

export default getDb;
