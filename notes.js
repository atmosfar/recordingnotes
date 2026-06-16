export function createNote(db, { content, user_id = null, session_id, timestamp, color = null }) {
  // Accept 'timestamp' from API/WS (now UTC ms) and store as timestamp_ms
  const timestampMs = Math.round(timestamp);
  const stmt = db.prepare(`
    INSERT INTO notes (content, user_id, session_id, timestamp_ms, color)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(content, user_id, session_id, timestampMs, color);
  return result.lastInsertRowid;
}

export function listNotesBySession(db, session_id) {
  const stmt = db.prepare(`
    SELECT * FROM notes 
    WHERE session_id = ? 
    ORDER BY created_at ASC
  `);
  return stmt.all(session_id);
}

export function getNote(db, id) {
  const stmt = db.prepare('SELECT * FROM notes WHERE id = ?');
  return stmt.get(id);
}

export function updateNote(db, id, content) {
  const stmt = db.prepare('UPDATE notes SET content = ? WHERE id = ?');
  return stmt.run(content, id);
}

export function deleteNote(db, id) {
  const stmt = db.prepare('DELETE FROM notes WHERE id = ?');
  return stmt.run(id);
}

