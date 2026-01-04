export function createSession(db, { name, timestamp_mode = 'clock' }) {
  const stmt = db.prepare('INSERT INTO sessions (name, timestamp_mode) VALUES (?, ?)');
  const result = stmt.run(name, timestamp_mode);
  return result.lastInsertRowid;
}

export function getSession(db, id) {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ?');
  return stmt.get(id);
}

export function listSessions(db) {
  const stmt = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC');
  return stmt.all();
}

export function updateSession(db, id, updates) {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = fields.map(field => `${field} = ?`).join(', ');
  const stmt = db.prepare(`UPDATE sessions SET ${setClause} WHERE id = ?`);
  return stmt.run(...values, id);
}

export function deleteSession(db, id) {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  return stmt.run(id);
}
