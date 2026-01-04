import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const app = express();
const port = process.env.PORT || 3000;
const dbPath = join(process.cwd(), 'dev.db');
const db = new DatabaseSync(dbPath);

app.use(express.json());

app.get('/', (req, res) => {
  res.send('Recording Notes API - Barebones Prototype');
});

// Health check or API status
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', database: dbPath });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

export { app, db };
export default app;
