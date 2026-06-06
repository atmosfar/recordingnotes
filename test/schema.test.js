import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const testDbPath = join(process.cwd(), 'test-schema.db');
const originalDbPath = process.env.RECNOTES_DB_PATH;

describe('Database Schema Updates', () => {
  before(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  after(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    process.env.RECNOTES_DB_PATH = originalDbPath;
  });

  test('should have external_id and stopped_at columns in sessions table', async () => {
    // Set DB_PATH for db.js
    process.env.RECNOTES_DB_PATH = testDbPath;
    
    // Dynamically import initDb so it respects DB_PATH
    const { initDb, resetDbInstance } = await import(`../db.js?update=${Date.now()}`);
    resetDbInstance();
    initDb();

    const db = new DatabaseSync(testDbPath);
    const info = db.prepare("PRAGMA table_info(sessions)").all();
    const columnNames = info.map(c => c.name);

    assert.ok(columnNames.includes('external_id'), 'sessions table should have external_id column');
    assert.ok(columnNames.includes('stopped_at'), 'sessions table should have stopped_at column');
    
    db.close();
  });

  test('should migrate existing sessions table to include new columns', async () => {
    const migrationDbPath = join(process.cwd(), 'test-migration.db');
    if (existsSync(migrationDbPath)) unlinkSync(migrationDbPath);

    // Create old schema
    const db = new DatabaseSync(migrationDbPath);
    db.exec(`
      CREATE TABLE sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        timestamp_mode TEXT DEFAULT 'clock',
        status TEXT DEFAULT 'active',
        started_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    db.close();

    // Run initDb with the existing db
    process.env.RECNOTES_DB_PATH = migrationDbPath;
    const { initDb, resetDbInstance } = await import(`../db.js?migration=${Date.now()}`);
    resetDbInstance();
    initDb();

    // Check if columns were added
    const dbCheck = new DatabaseSync(migrationDbPath);
    const info = dbCheck.prepare("PRAGMA table_info(sessions)").all();
    const columnNames = info.map(c => c.name);

    assert.ok(columnNames.includes('external_id'), 'migrated sessions table should have external_id column');
    assert.ok(columnNames.includes('stopped_at'), 'migrated sessions table should have stopped_at column');
    
    dbCheck.close();
    unlinkSync(migrationDbPath);
  });

  test('should have REAL timestamp column in notes table', async () => {
    process.env.RECNOTES_DB_PATH = testDbPath;
    const { initDb, resetDbInstance } = await import(`../db.js?notes=${Date.now()}`);
    resetDbInstance();
    initDb();

    const db = new DatabaseSync(testDbPath);
    const info = db.prepare("PRAGMA table_info(notes)").all();
    const timestampCol = info.find(c => c.name === 'timestamp');

    assert.strictEqual(timestampCol.type, 'REAL', 'notes.timestamp should be REAL');
    
    db.close();
  });
});
