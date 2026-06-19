import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createNote, listNotesBySession, getNote, updateNote, deleteNote } from '../notes.js';

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
        timer_position_ms INTEGER,
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

  // T08: getNote(db, id) basic retrieval
  test('T08: getNote() retrieves a note by id', () => {
    const noteData = {
      content: 'T08 Note',
      session_id: 1,
      timestamp: Date.now(),
      user_id: null,
      color: 'blue'
    };
    const noteId = createNote(db, noteData);
    const note = getNote(db, noteId);
    assert.ok(note);
    assert.strictEqual(note.content, 'T08 Note');
    assert.strictEqual(note.session_id, 1);
    assert.strictEqual(note.color, 'blue');
  });

  // T09: deleteNote(db, id) deletion
  test('T09: deleteNote() removes a note and getNote returns undefined', () => {
    const noteId = createNote(db, {
      content: 'T09 Note',
      session_id: 1,
      timestamp: Date.now(),
      user_id: null
    });
    const result = deleteNote(db, noteId);
    assert.strictEqual(result.changes, 1);
    const note = getNote(db, noteId);
    assert.strictEqual(note, undefined);
  });

  // T10: createNote() with user_id (non-null)
  test('T10: createNote() accepts non-null user_id', () => {
    const noteId = createNote(db, {
      content: 'T10 Note with user',
      session_id: 1,
      timestamp: Date.now(),
      user_id: 42
    });
    const note = getNote(db, noteId);
    assert.ok(note);
    assert.strictEqual(note.user_id, 42);
  });

  // T11: createNote() fractional timestamp rounding
  test('T11: createNote() rounds fractional timestamp to integer ms', () => {
    const fractionalTs = Date.now() + 123.456;
    const noteId = createNote(db, {
      content: 'T11 Fractional Note',
      session_id: 1,
      timestamp: fractionalTs,
      user_id: null
    });
    const note = getNote(db, noteId);
    // timestamp_ms should be rounded integer
    assert.strictEqual(note.timestamp_ms, Math.round(fractionalTs));
    assert.strictEqual(Number.isInteger(note.timestamp_ms), true);
  });

  // T12: listNotesBySession() empty result set
  test('T12: listNotesBySession() returns empty array for session with no notes', () => {
    // Create a new session with no notes
    db.prepare('INSERT INTO sessions (name) VALUES (?)').run('Empty Session');
    const notes = listNotesBySession(db, 2);
    assert.ok(Array.isArray(notes));
    assert.strictEqual(notes.length, 0);
  });

  // T13: updateNote() on non-existent note ID (0 changes)
  test('T13: updateNote() on non-existent note returns 0 changes', () => {
    const result = updateNote(db, 99999, 'Ghost Note');
    assert.strictEqual(result.changes, 0);
  });
});
