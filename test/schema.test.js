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

  test('should have INTEGER timestamp_ms column in notes table', async () => {
    process.env.RECNOTES_DB_PATH = testDbPath;
    const { initDb, resetDbInstance } = await import(`../db.js?notes=${Date.now()}`);
    resetDbInstance();
    initDb();

    const db = new DatabaseSync(testDbPath);
    const info = db.prepare("PRAGMA table_info(notes)").all();
    const timestampCol = info.find(c => c.name === 'timestamp_ms');

    assert.ok(timestampCol, 'notes table should have timestamp_ms column');
    assert.strictEqual(timestampCol.type, 'INTEGER', 'notes.timestamp_ms should be INTEGER');
    
    db.close();
  });
});
