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
  deleteSession,
  getSessionByExternalId,
  getSessionByGuestToken
} from '../services/sessions.js';

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
        external_id TEXT,
        guest_token TEXT UNIQUE,
        timestamp_mode TEXT DEFAULT 'clock',
        status TEXT DEFAULT 'active',
        started_at DATETIME,
        stopped_at DATETIME,
        elapsed_ms INTEGER DEFAULT 0,
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
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      );
    `);
  });

  after(() => {
    db.close();
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  });

  test('should create and retrieve a session', () => {
    const sessionData = { name: 'Test Session', timestamp_mode: 'timer', external_id: 'sq_123' };
    const id = createSession(db, sessionData);
    assert.ok(id > 0);

    const session = getSession(db, id);
    assert.strictEqual(session.name, 'Test Session');
    assert.strictEqual(session.timestamp_mode, 'timer');
    assert.strictEqual(session.status, 'active');
    assert.strictEqual(session.external_id, 'sq_123');
  });

  test('should retrieve a session by external_id', () => {
    const session = getSessionByExternalId(db, 'sq_123');
    assert.ok(session);
    assert.strictEqual(session.name, 'Test Session');
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

  // T01: getSession() with non-existent ID returns undefined
  test('T01: getSession() with non-existent ID returns undefined', () => {
    const session = getSession(db, 99999);
    assert.strictEqual(session, undefined);
  });

  // T02: createSession() defaults (timestamp_mode='clock', external_id=null)
  test('T02: createSession() defaults timestamp_mode to clock and external_id to null', () => {
    const id = createSession(db, { name: 'Defaults Test' });
    const session = getSession(db, id);
    assert.strictEqual(session.timestamp_mode, 'clock');
    assert.strictEqual(session.external_id, null);
  });

  // T03: updateSession() with multiple fields in one call
  test('T03: updateSession() with multiple fields in one call', () => {
    const id = createSession(db, { name: 'Multi Update' });
    updateSession(db, id, { status: 'active', timestamp_mode: 'timer', external_id: 'multi_123' });
    const updated = getSession(db, id);
    assert.strictEqual(updated.status, 'active');
    assert.strictEqual(updated.timestamp_mode, 'timer');
    assert.strictEqual(updated.external_id, 'multi_123');
  });

  // T04: updateSession() on non-existent ID returns 0 changes
  test('T04: updateSession() on non-existent ID returns 0 changes', () => {
    const result = updateSession(db, 99999, { name: 'Ghost' });
    assert.strictEqual(result.changes, 0);
  });

  // T05: deleteSession() on non-existent ID
  test('T05: deleteSession() on non-existent ID returns 0 changes', () => {
    const result = deleteSession(db, 99999);
    assert.strictEqual(result.changes, 0);
  });

  // T06: listSessions() ordering verification (ORDER BY created_at DESC)
  test('T06: listSessions() returns sessions ordered by created_at DESC', () => {
    // Delete all existing sessions first to isolate this test
    const allSessions = listSessions(db);
    for (const s of allSessions) {
      db.prepare('DELETE FROM notes WHERE session_id = ?').run(s.id);
      db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
    }

    // Create sessions with larger delays to ensure different timestamps
    // SQLite stores DATETIME as 'YYYY-MM-DD HH:MM:SS' (second precision)
    const id1 = createSession(db, { name: 'First Session' });
    const start = Date.now();
    while (Date.now() - start < 1100) {}
    const id2 = createSession(db, { name: 'Second Session' });
    while (Date.now() - start < 2200) {}
    const id3 = createSession(db, { name: 'Third Session' });

    const sessions = listSessions(db);
    // The most recently created should appear first (by created_at DESC)
    assert.strictEqual(sessions.length, 3);
    // Verify ordering by created_at: first item has latest timestamp
    assert.ok(new Date(sessions[0].created_at) >= new Date(sessions[1].created_at));
    assert.ok(new Date(sessions[1].created_at) >= new Date(sessions[2].created_at));
    // Verify names match the insertion order reversed
    assert.strictEqual(sessions[0].name, 'Third Session');
    assert.strictEqual(sessions[1].name, 'Second Session');
    assert.strictEqual(sessions[2].name, 'First Session');
  });

  // T07: getSessionByGuestToken() (new function, zero coverage)
  test('T07: getSessionByGuestToken() returns session for valid token', () => {
    const id = createSession(db, { name: 'Guest Session' });
    // Set guest_token via updateSession since createSession doesn't accept it
    updateSession(db, id, { guest_token: 'abc123token' });
    const session = getSessionByGuestToken(db, 'abc123token');
    assert.ok(session);
    assert.strictEqual(session.id, id);
    assert.strictEqual(session.name, 'Guest Session');
  });

  test('T07: getSessionByGuestToken() returns undefined for invalid token', () => {
    const session = getSessionByGuestToken(db, 'nonexistent_token');
    assert.strictEqual(session, undefined);
  });
});
