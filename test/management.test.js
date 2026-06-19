import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createSession, getSession, deleteSession } from '../sessions.js';
import { createNote, listNotesBySession, deleteNote, getNote } from '../notes.js';

const testDbPath = join(process.cwd(), 'test-management.db');

describe('Session and Note Management Operations', () => {
  let db;

  before(() => {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    db = new DatabaseSync(testDbPath);
    db.exec(`
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
        timestamp_ms INTEGER NOT NULL DEFAULT 0,
        timer_position_ms INTEGER,
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

  test('should delete a specific note', () => {
    const sessionId = createSession(db, { name: 'Note Delete Test' });
    const noteId = createNote(db, {
      content: 'Note to be deleted',
      session_id: sessionId,
      timestamp: Date.now()
    });

    assert.ok(getNote(db, noteId), 'Note should exist before deletion');

    // This will fail initially because deleteNote is not implemented or imported
    deleteNote(db, noteId);

    assert.strictEqual(getNote(db, noteId), undefined, 'Note should not exist after deletion');
  });

  test('should delete a session and its associated notes', () => {
    const sessionId = createSession(db, { name: 'Session Cleanup Test' });
    createNote(db, { content: 'Associated note 1', session_id: sessionId, timestamp: Date.now() });
    createNote(db, { content: 'Associated note 2', session_id: sessionId, timestamp: Date.now() + 1000 });

    const notesBefore = listNotesBySession(db, sessionId);
    assert.strictEqual(notesBefore.length, 2);

    deleteSession(db, sessionId);

    assert.strictEqual(getSession(db, sessionId), undefined, 'Session should be deleted');
    const notesAfter = listNotesBySession(db, sessionId);
    assert.strictEqual(notesAfter.length, 0, 'Associated notes should be deleted');
  });
});
