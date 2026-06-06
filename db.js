import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      user_id INTEGER,
      session_id INTEGER NOT NULL,
      timestamp_ms INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (session_id) REFERENCES sessions (id)
    );
  `);

  // Migration: Add timestamp_ms column if it doesn't exist (old schema had 'timestamp REAL')
  const notesInfo = db.prepare("PRAGMA table_info(notes)").all();
  const notesColumnNames = notesInfo.map(c => c.name);
  if (!notesColumnNames.includes('timestamp_ms')) {
    // Add new column
    db.exec("ALTER TABLE notes ADD COLUMN timestamp_ms INTEGER DEFAULT 0");
    console.log('Added timestamp_ms column to notes table');

    // Migrate existing data from 'timestamp' (REAL seconds-since-midnight or elapsed seconds)
    // to 'timestamp_ms' (INTEGER UTC milliseconds)
    const oldNotes = db.prepare("SELECT id, timestamp, session_id, created_at FROM notes WHERE timestamp_ms = 0").all();
    for (const note of oldNotes) {
      const raw = note.timestamp;
      // Get session to determine mode
      const session = db.prepare("SELECT timestamp_mode, started_at FROM sessions WHERE id = ?").get(note.session_id);
      let newTimestamp;
      if (session && session.timestamp_mode === 'timer') {
        // Timer mode: raw value is elapsed seconds from session start
        const sessionStartMs = session.started_at ? new Date(session.started_at).getTime() : new Date(note.created_at).getTime();
        newTimestamp = sessionStartMs + (raw * 1000);
      } else {
        // Clock mode: raw value is UTC seconds-since-midnight
        // Reconstruct using the note's created_at date
        const createdDate = new Date(note.created_at);
        const year = createdDate.getUTCFullYear();
        const month = createdDate.getUTCMonth();
        const day = createdDate.getUTCDate();
        const baseDateMs = new Date(Date.UTC(year, month, day, 0, 0, 0)).getTime();
        newTimestamp = baseDateMs + (raw * 1000);
      }
      db.prepare("UPDATE notes SET timestamp_ms = ? WHERE id = ?").run(Math.round(newTimestamp), note.id);
    }
    console.log(`Migrated ${oldNotes.length} notes to timestamp_ms`);
  }

  // Migration: Drop old 'timestamp' column if it still exists (replaced by timestamp_ms)
  if (notesColumnNames.includes('timestamp')) {
    try {
      db.exec("ALTER TABLE notes DROP COLUMN timestamp");
      console.log('Dropped old timestamp column from notes table');
    } catch (e) {
      console.warn('Could not drop old timestamp column:', e.message);
    }
  }

  // Migration for existing sessions table
  const info = db.prepare("PRAGMA table_info(sessions)").all();
  const columnNames = info.map(c => c.name);
  if (!columnNames.includes('external_id')) {
    db.exec("ALTER TABLE sessions ADD COLUMN external_id TEXT");
    console.log('Added external_id column to sessions table');
  }
  if (!columnNames.includes('stopped_at')) {
    db.exec("ALTER TABLE sessions ADD COLUMN stopped_at DATETIME");
    console.log('Added stopped_at column to sessions table');
  }
  if (!columnNames.includes('guest_token')) {
    db.exec("ALTER TABLE sessions ADD COLUMN guest_token TEXT");
    // Ensure uniqueness for existing data (though it's null now)
    try {
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_guest_token ON sessions(guest_token)");
    } catch (e) {
      console.warn('Could not create unique index on guest_token:', e.message);
    }
    console.log('Added guest_token column to sessions table');
  }

  initializedPaths.add(dbPath);
  console.log('Database initialized at', dbPath);
}

export default getDb;
