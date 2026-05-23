/**
 * reset-demo.js  —  removes all [DEMO] projects from the database.
 * Run:  npm run seed:reset   (from the backend folder)
 */
const path     = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'estimator.db');

try {
  const db      = new Database(DB_PATH);
  const result  = db.prepare("DELETE FROM projects WHERE name LIKE '[DEMO]%'").run();
  db.close();
  console.log(`✅  Removed ${result.changes} demo project(s) from the database.`);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}
