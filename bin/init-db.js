import { initDb } from '../services/db.js';

try {
  initDb();
  process.exit(0);
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}
