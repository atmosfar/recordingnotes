import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

let dbInstance = null;
let initializedPaths = new Set();

export function getDb() {
  if (!dbInstance) {
    const dbPath = process.env.DB_PATH || join(process.cwd(), 'dev.db');
    dbInstance = new DatabaseSync(dbPath);
  }
  return dbInstance;
}

export function resetDbInstance() {
  dbInstance = null;
  initializedPaths.clear();
}

export function initDb() {
  const dbPath = process.env.DB_PATH || join(process.cwd(), 'dev.db');
  if (initializedPaths.has(dbPath)) return;

  const db = getDb();
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
      timestamp REAL NOT NULL,
      color TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (session_id) REFERENCES sessions (id)
    );
  `);

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

  initializedPaths.add(dbPath);
  console.log('Database initialized at', dbPath);
}

export default getDb;
