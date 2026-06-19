// Must set BEFORE importing server.js
process.env.RECNOTES_DB_PATH = './test-export-timer.db';
process.env.RECNOTES_AUTH_USERNAME = 'testuser';
process.env.RECNOTES_AUTH_PASSWORD = 'testpassword';
process.env.RECNOTES_SESSION_SECRET = 'test_secret_key_long_enough_32_chars';
process.env.RECNOTES_EXPORT_TIMEZONE = 'UTC';

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync, existsSync } from 'node:fs';
import { getDb, resetDbInstance } from '../services/db.js';
import app from '../server.js';

describe('Timer Mode Export', () => {
  let server;
  let baseUrl;
  let authCookie;
  let sessionId;

  before(async () => {
    if (existsSync('./test-export-timer.db')) {
      try { unlinkSync('./test-export-timer.db'); } catch (e) {}
    }
    resetDbInstance();

    return new Promise((resolve) => {
      server = app.listen(0, async () => {
        const { port } = server.address();
        baseUrl = `http://localhost:${port}`;

        // Login
        const loginRes = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'testpassword' })
        });
        authCookie = loginRes.headers.get('set-cookie').split(';')[0];

        resolve();
      });
    });
  });

  after(() => {
    return new Promise((resolve) => {
      server.close(() => {
        try { if (existsSync('./test-export-timer.db')) unlinkSync('./test-export-timer.db'); } catch (e) {}
        resolve();
      });
    });
  });

  test('Timer mode export: timestamps are relative to recording start, not offset by elapsed_ms', async () => {
    // Create a timer session
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ name: 'Timer Export Test' })
    });
    const { id } = await createRes.json();
    sessionId = id;

    // Start the timer
    const startRes = await fetch(`${baseUrl}/api/sessions/${id}/timer/start`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(startRes.status, 200);

    // Wait 100ms to simulate some time passing
    await new Promise(r => setTimeout(r, 100));

    // Add a note (timestamp is Date.now() = wall clock)
    const noteRes = await fetch(`${baseUrl}/api/sessions/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ content: 'Five Seconds In', color: '#FF4D4D', timestamp: Date.now() })
    });
    assert.strictEqual(noteRes.status, 201);

    // Wait a bit more
    await new Promise(r => setTimeout(r, 100));

    // Add another note
    const note2Res = await fetch(`${baseUrl}/api/sessions/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ content: 'Ten Seconds In', color: '#2ECC71', timestamp: Date.now() })
    });
    assert.strictEqual(note2Res.status, 201);

    // Stop the timer (this sets elapsed_ms to ~200ms)
    const stopRes = await fetch(`${baseUrl}/api/sessions/${id}/timer/stop`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(stopRes.status, 200);
    const stopData = await stopRes.json();
    // last_run_ms should be ~200-300ms (elapsed_ms only rolls forward on next start)
    assert.ok((stopData.session.last_run_ms || 0) > 100, `last_run_ms should be > 100ms, got ${stopData.session.last_run_ms}`);

    // Export as REAPER CSV
    const exportRes = await fetch(`${baseUrl}/api/sessions/${id}/export?format=reaper`, {
      headers: { 'Cookie': authCookie }
    });
    assert.strictEqual(exportRes.status, 200);
    const csvBody = await exportRes.text();

    // The first note should be at ~00:00:00.XXX (near zero, since it was ~100ms after start)
    // NOT offset by elapsed_ms (~200ms) which would push it to ~00:00:03.XXX
    // The key check: both notes should have small timestamps (seconds, not minutes)
    // If the bug were present, timestamps would be offset by the recording length

    // Parse the CSV to check timestamps
    const lines = csvBody.trim().split('\n');
    // Header line: #,Name,Start,End,Length,Color
    assert.strictEqual(lines[0], '#,Name,Start,End,Length,Color');

    // First data line
    const firstLine = lines[1];
    const firstParts = firstLine.split(',');
    const firstTimestamp = firstParts[2]; // Start time field

    // Second data line  
    const secondLine = lines[2];
    const secondParts = secondLine.split(',');
    const secondTimestamp = secondParts[2];

    console.log('First note timestamp:', firstTimestamp);
    console.log('Second note timestamp:', secondTimestamp);

    // Both timestamps should be small (less than 10 seconds)
    // If the bug were present, they'd be offset by elapsed_ms
    const parseTimestamp = (ts) => {
      const [hms, ms] = ts.split('.');
      const [h, m, s] = hms.split(':').map(Number);
      return h * 3600 + m * 60 + s + (ms ? parseInt(ms) / 1000 : 0);
    };

    const firstSeconds = parseTimestamp(firstTimestamp);
    const secondSeconds = parseTimestamp(secondTimestamp);

    // First note should be ~0.1 seconds (100ms after start)
    assert.ok(firstSeconds < 5, `First note timestamp ${firstSeconds}s should be < 5s (bug would add elapsed_ms)`);
    
    // Second note should be ~0.2 seconds (200ms after start)
    assert.ok(secondSeconds < 5, `Second note timestamp ${secondSeconds}s should be < 5s (bug would add elapsed_ms)`);
    
    // Second note should be after first note
    assert.ok(secondSeconds > firstSeconds, 'Second note should be after first note');
  });

  test('Timer mode export: REAPER CSV format with timer notes', async () => {
    // Create a new timer session
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ name: 'Timer REAPER Test' })
    });
    const { id } = await createRes.json();

    // Start timer
    await fetch(`${baseUrl}/api/sessions/${id}/timer/start`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    await new Promise(r => setTimeout(r, 50));

    // Add note
    await fetch(`${baseUrl}/api/sessions/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ content: 'Marker Note', color: '#3498DB', timestamp: Date.now() })
    });

    // Stop timer
    await fetch(`${baseUrl}/api/sessions/${id}/timer/stop`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    // Export
    const exportRes = await fetch(`${baseUrl}/api/sessions/${id}/export?format=reaper`, {
      headers: { 'Cookie': authCookie }
    });
    const csvBody = await exportRes.text();

    assert.strictEqual(exportRes.status, 200);
    assert.ok(csvBody.includes('#,Name,Start,End,Length,Color'));
    assert.ok(csvBody.includes('M1,"Marker Note"'));
    assert.ok(csvBody.includes('3498DB'));
  });

  test('Timer mode export: EDL format with timer notes', async () => {
    // Create a new timer session
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ name: 'Timer EDL Test' })
    });
    const { id } = await createRes.json();

    // Start timer
    await fetch(`${baseUrl}/api/sessions/${id}/timer/start`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    await new Promise(r => setTimeout(r, 50));

    // Add note
    await fetch(`${baseUrl}/api/sessions/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ content: 'EDL Marker', color: '#F1C40F', timestamp: Date.now() })
    });

    // Stop timer
    await fetch(`${baseUrl}/api/sessions/${id}/timer/stop`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    // Export as EDL
    const exportRes = await fetch(`${baseUrl}/api/sessions/${id}/export?format=edl&fps=24`, {
      headers: { 'Cookie': authCookie }
    });
    const edlBody = await exportRes.text();

    assert.strictEqual(exportRes.status, 200);
    assert.ok(edlBody.includes('TITLE: Timer EDL Test'));
    assert.ok(edlBody.includes('|C:ResolveColorYellow |M:EDL Marker |D:1'));
    // Timecode should be in the first second (not offset by elapsed_ms)
    assert.ok(edlBody.includes('00:00:00:'));
  });

  test('Timer mode export: Audition CSV format with timer notes', async () => {
    // Create a new timer session
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ name: 'Timer Audition Test' })
    });
    const { id } = await createRes.json();

    // Start timer
    await fetch(`${baseUrl}/api/sessions/${id}/timer/start`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    await new Promise(r => setTimeout(r, 50));

    // Add note
    await fetch(`${baseUrl}/api/sessions/${id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cookie': authCookie },
      body: JSON.stringify({ content: 'Audition Cue', timestamp: Date.now() })
    });

    // Stop timer
    await fetch(`${baseUrl}/api/sessions/${id}/timer/stop`, {
      method: 'POST',
      headers: { 'Cookie': authCookie }
    });

    // Export as Audition
    const exportRes = await fetch(`${baseUrl}/api/sessions/${id}/export?format=audition`, {
      headers: { 'Cookie': authCookie }
    });
    const auditionBody = await exportRes.text();

    assert.strictEqual(exportRes.status, 200);
    assert.ok(auditionBody.includes('Name\tStart\tDuration\tTime Format\tType\tDescription'));
    assert.ok(auditionBody.includes('Audition Cue'));
    // Timestamp should be in the first second (not offset by elapsed_ms)
    assert.ok(auditionBody.includes('00:00:00.'));
  });
});
