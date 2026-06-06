import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createNote, listNotesBySession } from '../notes.js';

const testDbPath = join(process.cwd(), 'test-notes.db');

describe('Note Database Operations', () => {
  let db;

  before(() => {
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
    db = new DatabaseSync(testDbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
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
    // Create a dummy session for testing notes
    db.prepare('INSERT INTO sessions (name) VALUES (?)').run('Test Session');
  });

  after(() => {
    db.close();
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  });

  test('should create and list notes for a session', () => {
    const noteData = {
      content: 'Important moment',
      session_id: 1,
      timestamp: Date.now(),
      user_id: null,
      color: 'red'
    };

    const id = createNote(db, noteData);
    assert.ok(id > 0);

    const notes = listNotesBySession(db, 1);
    assert.strictEqual(notes.length, 1);
    assert.strictEqual(notes[0].content, 'Important moment');
    assert.ok(notes[0].timestamp_ms > 0);
  });

  test('should list multiple notes in order', () => {
    createNote(db, {
      content: 'Second note',
      session_id: 1,
      timestamp: Date.now(),
      user_id: null
    });

    const notes = listNotesBySession(db, 1);
    assert.strictEqual(notes.length, 2);
    // Assuming default order is by creation or timestamp
    assert.strictEqual(notes[1].content, 'Second note');
  });
});
