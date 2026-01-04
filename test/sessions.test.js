import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { 
  createSession, 
  getSession, 
  listSessions, 
  updateSession, 
  deleteSession 
} from '../sessions.js';

const testDbPath = join(process.cwd(), 'test-sessions.db');

describe('Session CRUD Operations', () => {
  let db;

  before(() => {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    db = new DatabaseSync(testDbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        timestamp_mode TEXT DEFAULT 'clock',
        status TEXT DEFAULT 'active',
        started_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  after(() => {
    db.close();
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  });

  test('should create and retrieve a session', () => {
    const sessionData = { name: 'Test Session', timestamp_mode: 'timer' };
    const id = createSession(db, sessionData);
    assert.ok(id > 0);

    const session = getSession(db, id);
    assert.strictEqual(session.name, 'Test Session');
    assert.strictEqual(session.timestamp_mode, 'timer');
    assert.strictEqual(session.status, 'active');
  });

  test('should list all sessions', () => {
    const sessions = listSessions(db);
    assert.ok(Array.isArray(sessions));
    assert.ok(sessions.length >= 1);
  });

  test('should update a session', () => {
    const sessionData = { name: 'New Session' };
    const id = createSession(db, sessionData);
    
    updateSession(db, id, { status: 'completed' });
    const updated = getSession(db, id);
    assert.strictEqual(updated.status, 'completed');
  });

  test('should delete a session', () => {
    const id = createSession(db, { name: 'To be deleted' });
    deleteSession(db, id);
    const session = getSession(db, id);
    assert.strictEqual(session, undefined);
  });
});
