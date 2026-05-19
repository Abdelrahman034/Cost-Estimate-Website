/**
 * SQLite Database Service
 * Uses better-sqlite3 — synchronous, zero-config, single file
 * Database file: backend/data/estimator.db  (auto-created on first run)
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'estimator.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let _db = null;

function getDB() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS price_history (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      prices_json TEXT NOT NULL,
      source      TEXT DEFAULT 'groq_ai',
      fetched_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
      filename    TEXT,
      total_bid   REAL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      company    TEXT DEFAULT '',
      email      TEXT DEFAULT '',
      phone      TEXT DEFAULT '',
      notes      TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rfqs (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id        INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      title             TEXT NOT NULL DEFAULT 'RFQ',
      project_name      TEXT DEFAULT '',
      items_json        TEXT NOT NULL DEFAULT '[]',
      supplier_ids_json TEXT NOT NULL DEFAULT '[]',
      status            TEXT NOT NULL DEFAULT 'draft',
      created_at        TEXT DEFAULT (datetime('now')),
      updated_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supplier_quotes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_id      INTEGER NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      lines_json  TEXT NOT NULL DEFAULT '[]',
      subtotal    REAL DEFAULT 0,
      notes       TEXT DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'pending',
      received_at TEXT,
      created_at  TEXT DEFAULT (datetime('now')),
      updated_at  TEXT DEFAULT (datetime('now'))
    );
  `);
}

// PROJECTS
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

// ESTIMATES
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

// PRICE HISTORY
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

// PROPOSALS
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

// SUPPLIERS
const suppliers = {
  getAll() {
    return getDB().prepare('SELECT * FROM suppliers ORDER BY company, name').all();
  },
  getById(id) {
    return getDB().prepare('SELECT * FROM suppliers WHERE id = ?').get(id);
  },
  create(data) {
    const result = getDB().prepare(`
      INSERT INTO suppliers (name, company, email, phone, notes)
      VALUES (@name, @company, @email, @phone, @notes)
    `).run({
      name:    data.name    || '',
      company: data.company || '',
      email:   data.email   || '',
      phone:   data.phone   || '',
      notes:   data.notes   || '',
    });
    return suppliers.getById(result.lastInsertRowid);
  },
  update(id, data) {
    getDB().prepare(`
      UPDATE suppliers SET name=@name, company=@company, email=@email,
        phone=@phone, notes=@notes, updated_at=datetime('now')
      WHERE id=@id
    `).run({ id, name: data.name||'', company: data.company||'', email: data.email||'', phone: data.phone||'', notes: data.notes||'' });
    return suppliers.getById(id);
  },
  delete(id) {
    return getDB().prepare('DELETE FROM suppliers WHERE id=?').run(id);
  },
};

// RFQs
const rfqs = {
  getAll(projectId) {
    if (projectId) {
      return getDB().prepare('SELECT * FROM rfqs WHERE project_id=? ORDER BY created_at DESC').all(projectId);
    }
    return getDB().prepare('SELECT * FROM rfqs ORDER BY created_at DESC').all();
  },
  getById(id) {
    return getDB().prepare('SELECT * FROM rfqs WHERE id=?').get(id);
  },
  create(data) {
    const result = getDB().prepare(`
      INSERT INTO rfqs (project_id, title, project_name, items_json, supplier_ids_json, status)
      VALUES (@project_id, @title, @project_name, @items_json, @supplier_ids_json, @status)
    `).run({
      project_id:        data.projectId       || null,
      title:             data.title           || 'RFQ',
      project_name:      data.projectName     || '',
      items_json:        JSON.stringify(data.items       || []),
      supplier_ids_json: JSON.stringify(data.supplierIds || []),
      status:            data.status          || 'draft',
    });
    return rfqs.parse(rfqs.getById(result.lastInsertRowid));
  },
  update(id, data) {
    getDB().prepare(`
      UPDATE rfqs SET title=@title, project_name=@project_name,
        items_json=@items_json, supplier_ids_json=@supplier_ids_json,
        status=@status, updated_at=datetime('now')
      WHERE id=@id
    `).run({
      id,
      title:             data.title           || '',
      project_name:      data.projectName     || '',
      items_json:        JSON.stringify(data.items       || []),
      supplier_ids_json: JSON.stringify(data.supplierIds || []),
      status:            data.status          || 'draft',
    });
    return rfqs.parse(rfqs.getById(id));
  },
  delete(id) {
    return getDB().prepare('DELETE FROM rfqs WHERE id=?').run(id);
  },
  parse(rfq) {
    if (!rfq) return null;
    return {
      ...rfq,
      items:       JSON.parse(rfq.items_json        || '[]'),
      supplierIds: JSON.parse(rfq.supplier_ids_json || '[]'),
    };
  },
};

// SUPPLIER QUOTES
const supplierQuotes = {
  getByRfq(rfqId) {
    return getDB().prepare('SELECT * FROM supplier_quotes WHERE rfq_id=? ORDER BY supplier_id').all(rfqId)
      .map(q => ({ ...q, lines: JSON.parse(q.lines_json || '[]') }));
  },
  upsert(rfqId, supplierId, data) {
    const existing = getDB().prepare(
      'SELECT id FROM supplier_quotes WHERE rfq_id=? AND supplier_id=?'
    ).get(rfqId, supplierId);
    const linesJson = JSON.stringify(data.lines || []);
    if (existing) {
      getDB().prepare(`
        UPDATE supplier_quotes SET lines_json=?, subtotal=?, notes=?, status=?,
          received_at=?, updated_at=datetime('now')
        WHERE id=?
      `).run(linesJson, data.subtotal||0, data.notes||'', data.status||'pending', data.receivedAt||null, existing.id);
    } else {
      getDB().prepare(`
        INSERT INTO supplier_quotes (rfq_id, supplier_id, lines_json, subtotal, notes, status, received_at)
        VALUES (?,?,?,?,?,?,?)
      `).run(rfqId, supplierId, linesJson, data.subtotal||0, data.notes||'', data.status||'pending', data.receivedAt||null);
    }
    return supplierQuotes.getByRfq(rfqId).find(q => q.supplier_id == supplierId);
  },
};

module.exports = { getDB, projects, estimates, priceHistory, proposals, suppliers, rfqs, supplierQuotes };
