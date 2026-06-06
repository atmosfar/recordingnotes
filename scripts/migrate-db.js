#!/usr/bin/env node
/**
 * Standalone migration script for upgrading old dev database instances.
 * Run: node scripts/migrate-db.js [path-to-db]
 * If no path given, uses RECNOTES_DB_PATH or ~/.recordingnotes/default.db
 */

import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { homedir } from 'node:os';

const dbPath = process.argv[2] ||
  process.env.RECNOTES_DB_PATH ||
  join(homedir(), '.recordingnotes', 'default.db');

console.log(`Migrating database: ${dbPath}`);

const db = new DatabaseSync(dbPath);

// Migration: Add timestamp_ms column if it doesn't exist (old schema had 'timestamp REAL')
const notesInfo = db.prepare("PRAGMA table_info(notes)").all();
const notesColumnNames = notesInfo.map(c => c.name);

if (!notesColumnNames.includes('timestamp_ms')) {
  db.exec("ALTER TABLE notes ADD COLUMN timestamp_ms INTEGER DEFAULT 0");
  console.log('Added timestamp_ms column to notes table');

  // Migrate existing data from 'timestamp' (REAL seconds-since-midnight or elapsed seconds)
  // to 'timestamp_ms' (INTEGER UTC milliseconds)
  const oldNotes = db.prepare("SELECT id, timestamp, session_id, created_at FROM notes WHERE timestamp_ms = 0").all();
  for (const note of oldNotes) {
    const raw = note.timestamp;
    const session = db.prepare("SELECT timestamp_mode, started_at FROM sessions WHERE id = ?").get(note.session_id);
    let newTimestamp;
    if (session && session.timestamp_mode === 'timer') {
      const sessionStartMs = session.started_at ? new Date(session.started_at).getTime() : new Date(note.created_at).getTime();
      newTimestamp = sessionStartMs + (raw * 1000);
    } else {
      const createdDate = new Date(note.created_at);
      const year = createdDate.getUTCFullYear();
      const month = createdDate.getUTCMonth();
      const day = createdDate.getUTCDate();
      const baseDateMs = new Date(Date.UTC(year, month, day, 0, 0, 0)).getTime();
      newTimestamp = baseDateMs + (raw * 1000);
    }
    db.prepare("UPDATE notes SET timestamp_ms = ? WHERE id = ?").run(Math.round(newTimestamp), note.id);
  }
  console.log(`Migrated ${oldNotes.length} notes to timestamp_ms`);
} else {
  console.log('timestamp_ms column already exists, skipping');
}

// Migration: Drop old 'timestamp' column if it still exists
if (notesColumnNames.includes('timestamp')) {
  try {
    db.exec("ALTER TABLE notes DROP COLUMN timestamp");
    console.log('Dropped old timestamp column from notes table');
  } catch (e) {
    console.warn('Could not drop old timestamp column:', e.message);
  }
}

// Migration for existing sessions table
const sessionsInfo = db.prepare("PRAGMA table_info(sessions)").all();
const sessionsColumnNames = sessionsInfo.map(c => c.name);

if (!sessionsColumnNames.includes('external_id')) {
  db.exec("ALTER TABLE sessions ADD COLUMN external_id TEXT");
  console.log('Added external_id column to sessions table');
}
if (!sessionsColumnNames.includes('stopped_at')) {
  db.exec("ALTER TABLE sessions ADD COLUMN stopped_at DATETIME");
  console.log('Added stopped_at column to sessions table');
}
if (!sessionsColumnNames.includes('guest_token')) {
  db.exec("ALTER TABLE sessions ADD COLUMN guest_token TEXT");
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_guest_token ON sessions(guest_token)");
  } catch (e) {
    console.warn('Could not create unique index on guest_token:', e.message);
  }
  console.log('Added guest_token column to sessions table');
}

console.log('Migration complete.');
db.close();
