import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const testDbPath = join(process.cwd(), 'test-dev.db');

describe('Database Initialization', () => {
  before(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  after(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  test('should create tables correctly', async () => {
    const db = new DatabaseSync(testDbPath);
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
        timestamp_mode TEXT DEFAULT 'clock',
        status TEXT DEFAULT 'active',
        started_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        user_id INTEGER,
        session_id INTEGER NOT NULL,
        timestamp TEXT NOT NULL,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      );
    `);

    // Check if tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);

    assert.ok(tableNames.includes('users'), 'users table should exist');
    assert.ok(tableNames.includes('sessions'), 'sessions table should exist');
    assert.ok(tableNames.includes('notes'), 'notes table should exist');
    
    db.close();
  });
});
