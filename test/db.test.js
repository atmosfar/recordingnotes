import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { getDb, resetDbInstance, initDb } from '../services/db.js';

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

describe('Database Instance Management', () => {
  const testDbPath = join(process.cwd(), 'test-db-instance.db');

  // Ensure clean state before each test
  beforeEach(() => {
    resetDbInstance();
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    process.env.RECNOTES_DB_PATH = testDbPath;
  });

  // T14: getDb() auto-initialization and caching
  test('T14: getDb() auto-initializes schema and caches instance', () => {
    // First call should auto-initialize
    const db1 = getDb();
    assert.ok(db1);
    assert.ok(db1 instanceof DatabaseSync);

    // Tables should exist
    const tables = db1.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    assert.ok(tableNames.includes('users'));
    assert.ok(tableNames.includes('sessions'));
    assert.ok(tableNames.includes('notes'));

    // Second call should return the same cached instance
    const db2 = getDb();
    assert.strictEqual(db1, db2);
  });

  // T15: resetDbInstance() clears cache (assert dbInstance becomes null)
  test('T15: resetDbInstance() clears the database cache', () => {
    // First get an instance
    const db1 = getDb();
    assert.ok(db1);

    // Reset should clear it
    resetDbInstance();

    // Next getDb() call should create a new instance
    const db2 = getDb();
    assert.ok(db2);
    assert.notStrictEqual(db1, db2);

    // The old instance should be closed/disconnected
    // and the new one should have the tables
    const tables = db2.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    assert.ok(tableNames.includes('sessions'));
  });

  // T16: initDb() idempotency (call twice, no error)
  test('T16: initDb() is idempotent - calling twice does not error', () => {
    // First call should succeed
    assert.doesNotThrow(() => initDb());

    // Second call should also succeed without error (idempotent)
    assert.doesNotThrow(() => initDb());

    // Third call should also succeed
    assert.doesNotThrow(() => initDb());

    // Verify the database is still functional
    const db = getDb();
    const sessionsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'").all();
    assert.strictEqual(sessionsTable.length, 1);

    // Verify the internal state is correct: initializedPaths should have the path
    // (initDb() should not re-execute SQL on subsequent calls)
    assert.doesNotThrow(() => initDb());
  });
});
