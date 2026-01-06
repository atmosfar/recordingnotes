import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createNote, updateNote, getNote } from '../notes.js';

const testDbPath = join(process.cwd(), 'test-notes-update.db');

describe('Note Update Operations', () => {
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
        timestamp REAL NOT NULL,
        color TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      );
    `);
    db.prepare('INSERT INTO sessions (name) VALUES (?)').run('Test Session');
  });

  after(() => {
    db.close();
    if (existsSync(testDbPath)) unlinkSync(testDbPath);
  });

  test('should update note content', () => {
    const noteId = createNote(db, {
      content: 'Original content',
      session_id: 1,
      timestamp: 123.456,
      user_id: null,
      color: 'blue'
    });

    const updateResult = updateNote(db, noteId, 'Updated content');
    assert.strictEqual(updateResult.changes, 1);

    const updatedNote = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    assert.strictEqual(updatedNote.content, 'Updated content');
    assert.strictEqual(updatedNote.timestamp, 123.456); // Verify timestamp remains unchanged
  });
});
