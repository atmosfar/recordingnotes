#!/usr/bin/env node
//
// Repair script for SquadCast sessions whose timestamps were wrongly migrated.
//
// Problem: Sessions created via SquadCast webhook had timestamp_mode='clock'
// (the default), but their old `timestamp` values stored elapsed seconds from
// session start (timer-mode data). The migration treated them as clock-mode,
// converting elapsed-seconds into seconds-since-UTC-midnight, producing
// timestamps near midnight instead of the actual recording times.
//
// Fix: Reverse-engineer the old elapsed-seconds from the (wrong) timestamp_ms,
// then recalculate: correct_timestamp_ms = started_at + elapsed_seconds * 1000
//
// Usage:
//   node scripts/repair-squadcast-timestamps.js              # dry-run (default)
//   node scripts/repair-squadcast-timestamps.js --apply       # apply changes
//   node scripts/repair-squadcast-timestamps.js --session 88  # specific session
//

import { getDb } from '../db.js';

const db = getDb();

// Determine which sessions to repair
const args = process.argv.slice(2);
const applyMode = args.includes('--apply');
const sessionArg = args.find(a => a.startsWith('--session'));
const targetSessionIds = sessionArg
  ? [parseInt(sessionArg.split(' ')[1] || sessionArg.split('=')[1], 10)]
  : [88, 90]; // Default: the known broken sessions

console.log(`Mode: ${applyMode ? 'APPLY' : 'DRY-RUN'}`);
console.log(`Target sessions: ${targetSessionIds.join(', ')}`);
console.log('');

let totalNotes = 0;
let totalFixed = 0;

for (const sessionId of targetSessionIds) {
  const session = db.prepare('SELECT id, name, timestamp_mode, started_at FROM sessions WHERE id = ?').get(sessionId);
  if (!session) {
    console.log(`Session ${sessionId}: NOT FOUND, skipping.`);
    continue;
  }

  if (!session.started_at) {
    console.log(`Session ${sessionId} (${session.name}): NO started_at, cannot repair.`);
    continue;
  }

  const sessionStartMs = new Date(session.started_at).getTime();
  console.log(`Session ${sessionId} (${session.name}):`);
  console.log(`  timestamp_mode: ${session.timestamp_mode}`);
  console.log(`  started_at: ${session.started_at} (${sessionStartMs})`);

  const notes = db.prepare('SELECT id, content, timestamp_ms, created_at FROM notes WHERE session_id = ? ORDER BY timestamp_ms').all(sessionId);
  totalNotes += notes.length;

  for (const note of notes) {
    // Step 1: Reverse-engineer what the migration used as baseDateMs
    // The migration did:
    //   const createdDate = new Date(note.created_at);
    //   const year = createdDate.getUTCFullYear();
    //   const month = createdDate.getUTCMonth();
    //   const day = createdDate.getUTCDate();
    //   const baseDateMs = Date.UTC(year, month, day, 0, 0, 0);
    //   newTimestamp = baseDateMs + (oldTimestamp * 1000);
    const createdDate = new Date(note.created_at);
    const year = createdDate.getUTCFullYear();
    const month = createdDate.getUTCMonth();
    const day = createdDate.getUTCDate();
    const baseDateMs = Date.UTC(year, month, day, 0, 0, 0);

    // Step 2: Recover the old elapsed-seconds value
    const oldElapsedSeconds = (note.timestamp_ms - baseDateMs) / 1000;

    // Step 3: Calculate the correct timestamp_ms
    const correctTimestampMs = Math.round(sessionStartMs + (oldElapsedSeconds * 1000));

    const oldDate = new Date(note.timestamp_ms);
    const newDate = new Date(correctTimestampMs);

    if (Math.abs(correctTimestampMs - note.timestamp_ms) > 1000) {
      totalFixed++;
      console.log(`  Note ${note.id} (${note.content?.substring(0, 40) ?? 'unnamed'}):`);
      console.log(`    oldElapsed: ${oldElapsedSeconds.toFixed(3)}s`);
      console.log(`    WRONG: ${oldDate.toISOString()} (BST: ${oldDate.toLocaleString('en-GB', { timeZone: 'Europe/London' })})`);
      console.log(`    FIXED: ${newDate.toISOString()} (BST: ${newDate.toLocaleString('en-GB', { timeZone: 'Europe/London' })})`);

      if (applyMode) {
        db.prepare('UPDATE notes SET timestamp_ms = ? WHERE id = ?').run(correctTimestampMs, note.id);
      }
    }
  }
  console.log('');
}

// Also fix timestamp_mode on the sessions themselves
if (applyMode) {
  for (const sessionId of targetSessionIds) {
    const session = db.prepare('SELECT id, timestamp_mode FROM sessions WHERE id = ?').get(sessionId);
    if (session && session.timestamp_mode !== 'timer') {
      db.prepare('UPDATE sessions SET timestamp_mode = ? WHERE id = ?').run('timer', sessionId);
      console.log(`Session ${sessionId}: updated timestamp_mode from '${session.timestamp_mode}' to 'timer'`);
    }
  }
}

console.log(`Summary: ${totalNotes} notes checked, ${totalFixed} would be/are fixed.`);
if (!applyMode) {
  console.log('Run with --apply to actually update the database.');
} else {
  console.log('Done. Database updated.');
}
