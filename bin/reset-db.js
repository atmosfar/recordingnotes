import { resetDbInstance, initDb } from './db.js';
import { getConfig, SETTINGS_DIR } from './config.js';
import { unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const config = getConfig();
const dbPath = config.RECNOTES_DB_PATH || join(SETTINGS_DIR, 'default.db');

if (existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log('Deleted:', dbPath);
} else {
  console.log('No existing database found at:', dbPath);
}

resetDbInstance();
initDb();
console.log('Database re-initialized.');
process.exit(0);
