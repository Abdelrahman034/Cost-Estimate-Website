/**
 * SQLite Database Service
 * Uses better-sqlite3 — synchronous, zero-config, single file
 * Database file: backend/data/estimator.db  (auto-created on first run)
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'estimator.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let _db = null;

function getDB() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');  // Better concurrent read performance
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    -- Projects table
    CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      location    TEXT,
      owner       TEXT,
      gc          TEXT,
      bid_date    TEXT,
      company_name    TEXT,
      company_address TEXT,
      company_phone   TEXT,
      company_email   TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    -- Estimates table — stores duct rows per project
    CREATE TABLE IF NOT EXISTS estimates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      module      TEXT NOT NULL DEFAULT 'metal_duct',
      rows_json   TEXT NOT NULL DEFAULT '[]',
      prices_json TEXT NOT NULL DEFAULT '{}',
      totals_json TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );

    -- Price history — log of AI price fetches
    CREATE TABLE IF NOT EXISTS price_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      prices_json TEXT NOT NULL,
      source      TEXT DEFAULT 'groq_ai',
      fetched_at  TEXT DEFAULT (datetime('now'))
    );

    -- Saved proposals
    CREATE TABLE IF NOT EXISTS proposals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      filename    TEXT,
      total_bid   REAL,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
const projects = {
  getAll() {
    return getDB().prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM estimates e WHERE e.project_id = p.id) as estimate_count
      FROM projects p ORDER BY p.updated_at DESC
    `).all();
  },

  getById(id) {
    return getDB().prepare('SELECT * FROM projects WHERE id = ?').get(id);
  },

  create(data) {
    const stmt = getDB().prepare(`
      INSERT INTO projects (name, location, owner, gc, bid_date, company_name, company_address, company_phone, company_email)
      VALUES (@name, @location, @owner, @gc, @bid_date, @company_name, @company_address, @company_phone, @company_email)
    `);
    const result = stmt.run({
      name:            data.projectName     || data.name     || 'Untitled Project',
      location:        data.location        || '',
      owner:           data.owner           || '',
      gc:              data.gc              || '',
      bid_date:        data.bidDate         || data.bid_date || '',
      company_name:    data.companyName     || data.company_name    || '',
      company_address: data.companyAddress  || data.company_address || '',
      company_phone:   data.companyPhone    || data.company_phone   || '',
      company_email:   data.companyEmail    || data.company_email   || '',
    });
    return projects.getById(result.lastInsertRowid);
  },

  update(id, data) {
    getDB().prepare(`
      UPDATE projects SET
        name            = @name,
        location        = @location,
        owner           = @owner,
        gc              = @gc,
        bid_date        = @bid_date,
        company_name    = @company_name,
        company_address = @company_address,
        company_phone   = @company_phone,
        company_email   = @company_email,
        updated_at      = datetime('now')
      WHERE id = @id
    `).run({
      id,
      name:            data.projectName     || data.name     || '',
      location:        data.location        || '',
      owner:           data.owner           || '',
      gc:              data.gc              || '',
      bid_date:        data.bidDate         || data.bid_date || '',
      company_name:    data.companyName     || data.company_name    || '',
      company_address: data.companyAddress  || data.company_address || '',
      company_phone:   data.companyPhone    || data.company_phone   || '',
      company_email:   data.companyEmail    || data.company_email   || '',
    });
    return projects.getById(id);
  },

  delete(id) {
    return getDB().prepare('DELETE FROM projects WHERE id = ?').run(id);
  },
};

// ─── ESTIMATES ────────────────────────────────────────────────────────────────
const estimates = {
  getByProject(projectId) {
    return getDB().prepare('SELECT * FROM estimates WHERE project_id = ? ORDER BY module').all(projectId);
  },

  getByProjectAndModule(projectId, module) {
    return getDB().prepare(
      'SELECT * FROM estimates WHERE project_id = ? AND module = ?'
    ).get(projectId, module);
  },

  upsert(projectId, module, rows, prices, totals) {
    const existing = estimates.getByProjectAndModule(projectId, module);
    if (existing) {
      getDB().prepare(`
        UPDATE estimates SET rows_json = ?, prices_json = ?, totals_json = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(JSON.stringify(rows), JSON.stringify(prices), JSON.stringify(totals), existing.id);
      return { ...existing, rows_json: JSON.stringify(rows) };
    } else {
      const result = getDB().prepare(`
        INSERT INTO estimates (project_id, module, rows_json, prices_json, totals_json)
        VALUES (?, ?, ?, ?, ?)
      `).run(projectId, module, JSON.stringify(rows), JSON.stringify(prices), JSON.stringify(totals));
      return { id: result.lastInsertRowid, project_id: projectId, module };
    }
  },

  parse(estimate) {
    if (!estimate) return null;
    return {
      ...estimate,
      rows:   JSON.parse(estimate.rows_json   || '[]'),
      prices: JSON.parse(estimate.prices_json || '{}'),
      totals: JSON.parse(estimate.totals_json || '{}'),
    };
  },
};

// ─── PRICE HISTORY ────────────────────────────────────────────────────────────
const priceHistory = {
  save(pricesData) {
    getDB().prepare(
      'INSERT INTO price_history (prices_json) VALUES (?)'
    ).run(JSON.stringify(pricesData));
  },

  getLatest() {
    const row = getDB().prepare(
      'SELECT * FROM price_history ORDER BY fetched_at DESC LIMIT 1'
    ).get();
    if (!row) return null;
    return { ...JSON.parse(row.prices_json), savedAt: row.fetched_at };
  },

  getAll(limit = 30) {
    return getDB().prepare(
      'SELECT id, source, fetched_at FROM price_history ORDER BY fetched_at DESC LIMIT ?'
    ).all(limit);
  },
};

// ─── PROPOSALS ────────────────────────────────────────────────────────────────
const proposals = {
  save(projectId, filename, totalBid) {
    return getDB().prepare(
      'INSERT INTO proposals (project_id, filename, total_bid) VALUES (?, ?, ?)'
    ).run(projectId, filename, totalBid);
  },

  getByProject(projectId) {
    return getDB().prepare(
      'SELECT * FROM proposals WHERE project_id = ? ORDER BY created_at DESC'
    ).all(projectId);
  },
};

module.exports = { getDB, projects, estimates, priceHistory, proposals };
