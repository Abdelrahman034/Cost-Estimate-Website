const ai = require('./ai/aiService');
const communication = require('./communication/emailService');
const documents = require('./documents/pdfService');

// NOTE: dbService (better-sqlite3 / SQLite) is no longer exported here.
// Price history is now handled by Prisma (PostgreSQL) in routes/prices.js.
// Other legacy SQLite references (analytics, suppliers routes) should be
// migrated individually — see routes/analytics.js and routes/suppliers.js.

module.exports = {
  ...ai,
  ...communication,
  ...documents,
};
