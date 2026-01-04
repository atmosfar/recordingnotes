export function createNote(db, { content, user_id, session_id, timestamp, color = null }) {
  const stmt = db.prepare(`
    INSERT INTO notes (content, user_id, session_id, timestamp, color)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(content, user_id, session_id, timestamp, color);
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

