/**
 * seed-demo.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Populates the SQLite database with realistic demo projects, estimates, and
 * proposals so the Admin Analytics Dashboard shows meaningful data.
 *
 * Run:  node backend/scripts/seed-demo.js
 *   or  npm run seed:demo   (from project root)
 *
 * Safe to re-run — clears only records whose name starts with "[DEMO]".
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH  = path.join(DATA_DIR, 'estimator.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Ensure schema exists ────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, location TEXT, owner TEXT, gc TEXT, bid_date TEXT,
    company_name TEXT, company_address TEXT, company_phone TEXT, company_email TEXT,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    module TEXT NOT NULL DEFAULT 'metal_duct',
    rows_json TEXT NOT NULL DEFAULT '[]',
    prices_json TEXT NOT NULL DEFAULT '{}',
    totals_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT, total_bid REAL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const j  = (x) => JSON.stringify(x);
const daysAgo = (n) => {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const bidDate = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function insertProject(data) {
  const r = db.prepare(`
    INSERT INTO projects (name, location, owner, gc, bid_date, company_name,
      company_address, company_phone, company_email, created_at, updated_at)
    VALUES (@name,@location,@owner,@gc,@bid_date,@company_name,
      @company_address,@company_phone,@company_email,@created_at,@updated_at)
  `).run(data);
  return r.lastInsertRowid;
}

function insertEstimate(projectId, module, rows, prices, totals) {
  db.prepare(`
    INSERT INTO estimates (project_id, module, rows_json, prices_json, totals_json)
    VALUES (?,?,?,?,?)
  `).run(projectId, module, j(rows), j(prices), j(totals));
}

function insertProposal(projectId, filename, totalBid) {
  db.prepare(`INSERT INTO proposals (project_id, filename, total_bid) VALUES (?,?,?)`)
    .run(projectId, filename, totalBid);
}

// ─── Clear existing demo records ─────────────────────────────────────────────
console.log('🧹  Clearing previous [DEMO] records…');
const demoProjects = db.prepare(`SELECT id FROM projects WHERE name LIKE '[DEMO]%'`).all();
for (const p of demoProjects) {
  db.prepare('DELETE FROM projects WHERE id = ?').run(p.id);
}
console.log(`   Removed ${demoProjects.length} old demo project(s).`);

// ─── Demo project definitions ────────────────────────────────────────────────
//
// Each project includes:
//   • Realistic project name, location (Texas metro), GC, owner, bid date
//   • Per-module estimate totals (what the Admin Analytics reads)
//   • A final proposal (total_bid) for margin calculation
//
const DEMO_PROJECTS = [

  // ── 1. Large Office Building — San Antonio ──
  {
    meta: {
      name:            '[DEMO] Silverstone Corporate Center – Phase 2',
      location:        'San Antonio, TX',
      owner:           'Silverstone Properties LLC',
      gc:              'Bartlett Cocke General Contractors',
      bid_date:        bidDate(14),
      company_name:    'Your HVAC Company',
      company_address: '1234 Trade Center Dr, San Antonio, TX 78230',
      company_phone:   '(210) 555-0182',
      company_email:   'estimating@yourhvac.com',
      created_at:      `${daysAgo(5)} 09:14:00`,
      updated_at:      `${daysAgo(2)} 14:30:00`,
    },
    modules: {
      unit_schedule: {
        rows: [
          { id:'p-1', name:'RTU-1 (Lobby)',   coolTons:10, ownerProvided:'', baseCostPerTon:850, quotedEquipCost:null, accessories:{ standardCurb:'x', economizer:'x', thermostat:'x', pvcCond:'x' } },
          { id:'p-2', name:'RTU-2 (2nd Fl)',  coolTons:15, ownerProvided:'', baseCostPerTon:820, quotedEquipCost:null, accessories:{ standardCurb:'x', economizer:'x', thermostat:'x', pvcCond:'x' } },
          { id:'p-3', name:'RTU-3 (3rd Fl)',  coolTons:15, ownerProvided:'', baseCostPerTon:820, quotedEquipCost:null, accessories:{ standardCurb:'x', economizer:'x', thermostat:'x', pvcCond:'x' } },
          { id:'p-4', name:'RTU-4 (Conf Rm)', coolTons:7.5,ownerProvided:'', baseCostPerTon:900, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x', pvcCond:'x' } },
          { id:'sp-1',name:'AHU-1 (Server)',  coolTons:2,  ownerProvided:'', baseCostPerTon:1200,quotedEquipCost:null, accessories:{ condenserRails:'x', thermostat:'x', pvcCond:'x' } },
          { id:'sp-2',name:'AHU-2 (IT Rm)',   coolTons:3,  ownerProvided:'', baseCostPerTon:1100,quotedEquipCost:null, accessories:{ condenserRails:'x', thermostat:'x', pvcCond:'x' } },
        ],
        totals: { totalMaterial: 87400, totalLabor: 23600, totalCost: 111000 },
      },
      metal_duct: {
        rows: [
          { id:'d-1',  size:'24*12', linearFeet:120, flexDuct:false, insulation:true,  liner:false },
          { id:'d-2',  size:'20*10', linearFeet:85,  flexDuct:false, insulation:true,  liner:false },
          { id:'d-3',  size:'18*10', linearFeet:65,  flexDuct:false, insulation:false, liner:false },
          { id:'d-4',  size:'16*8',  linearFeet:95,  flexDuct:false, insulation:true,  liner:false },
          { id:'d-5',  size:'14*8',  linearFeet:110, flexDuct:false, insulation:true,  liner:false },
          { id:'d-6',  size:'12*8',  linearFeet:75,  flexDuct:false, insulation:false, liner:false },
          { id:'d-7',  size:'10*8',  linearFeet:60,  flexDuct:true,  insulation:false, liner:false },
          { id:'d-8',  size:'8*8',   linearFeet:45,  flexDuct:true,  insulation:false, liner:false },
          { id:'d-9',  size:'12',    linearFeet:35,  flexDuct:false, insulation:true,  liner:false },
          { id:'d-10', size:'10',    linearFeet:30,  flexDuct:false, insulation:false, liner:false },
        ],
        totals: { totalMaterial: 38200, totalLabor: 19400, totalCost: 57600 },
      },
      diffuser: {
        rows: [
          { id:'df-1', typeId:'24x24-4way', qty:18, sheetrock:false, quotedPrice:0 },
          { id:'df-2', typeId:'12x12-2way', qty:12, sheetrock:false, quotedPrice:0 },
          { id:'df-3', typeId:'24x24-4way', qty:6,  sheetrock:true,  quotedPrice:0 },
          { id:'df-4', typeId:'linear-bar', qty:8,  sheetrock:false, quotedPrice:0 },
        ],
        totals: { totalMaterial: 9200, totalLabor: 3800, totalCost: 13000 },
      },
      fan_schedule: {
        rows: [
          { id:'f-1', name:'EF-1 (Restroom 1F)', type:'Upblast Exhaust Fan', cfm:800,  mount:'Roof', drive:'Direct Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x' } },
          { id:'f-2', name:'EF-2 (Restroom 2F)', type:'Upblast Exhaust Fan', cfm:800,  mount:'Roof', drive:'Direct Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x' } },
          { id:'f-3', name:'EF-3 (Restroom 3F)', type:'Upblast Exhaust Fan', cfm:800,  mount:'Roof', drive:'Direct Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x' } },
          { id:'f-4', name:'SF-1 (Lobby Supply)', type:'Inline Centrifugal Fan', cfm:2400, mount:'Ceiling', drive:'Belt Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', flexConnection:'x' } },
        ],
        totals: { totalMaterial: 14600, totalLabor: 5200, totalCost: 19800 },
      },
      elec_heat: {
        rows: [
          { id:'eh-1', name:'UH-1 (Main Entrance)',  kw:5, qty:1, unitPrice:0 },
          { id:'eh-2', name:'UH-2 (Side Entrance)',  kw:3, qty:1, unitPrice:0 },
          { id:'eh-3', name:'UH-3 (Loading Dock)',   kw:8, qty:1, unitPrice:0 },
        ],
        totals: { totalMaterial: 4800, totalLabor: 2100, totalCost: 6900 },
      },
    },
    proposalBid: 245000,
  },

  // ── 2. Retail Strip Center — Houston ──
  {
    meta: {
      name:            '[DEMO] Westgate Retail Plaza – HVAC New Construction',
      location:        'Houston, TX',
      owner:           'Westgate Development Group',
      gc:              'Turner Construction',
      bid_date:        bidDate(21),
      company_name:    'Your HVAC Company',
      company_address: '1234 Trade Center Dr, San Antonio, TX 78230',
      company_phone:   '(210) 555-0182',
      company_email:   'estimating@yourhvac.com',
      created_at:      `${daysAgo(18)} 08:00:00`,
      updated_at:      `${daysAgo(15)} 11:20:00`,
    },
    modules: {
      unit_schedule: {
        rows: [
          { id:'p-1', name:'RTU-1 (Anchor)',   coolTons:20, ownerProvided:'', baseCostPerTon:780, quotedEquipCost:null, accessories:{ standardCurb:'x', economizer:'x', thermostat:'x' } },
          { id:'p-2', name:'RTU-2 (Suite A)',  coolTons:10, ownerProvided:'', baseCostPerTon:850, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x' } },
          { id:'p-3', name:'RTU-3 (Suite B)',  coolTons:10, ownerProvided:'', baseCostPerTon:850, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x' } },
          { id:'p-4', name:'RTU-4 (Suite C)',  coolTons:7.5,ownerProvided:'', baseCostPerTon:900, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x' } },
          { id:'p-5', name:'RTU-5 (Suite D)',  coolTons:5,  ownerProvided:'', baseCostPerTon:950, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x' } },
        ],
        totals: { totalMaterial: 68500, totalLabor: 18200, totalCost: 86700 },
      },
      metal_duct: {
        rows: [
          { id:'d-1', size:'24*14', linearFeet:180, flexDuct:false, insulation:true,  liner:false },
          { id:'d-2', size:'20*12', linearFeet:130, flexDuct:false, insulation:true,  liner:false },
          { id:'d-3', size:'16*10', linearFeet:95,  flexDuct:false, insulation:true,  liner:false },
          { id:'d-4', size:'12*8',  linearFeet:75,  flexDuct:false, insulation:false, liner:false },
          { id:'d-5', size:'10',    linearFeet:55,  flexDuct:true,  insulation:false, liner:false },
        ],
        totals: { totalMaterial: 28400, totalLabor: 14600, totalCost: 43000 },
      },
      diffuser: {
        rows: [
          { id:'df-1', typeId:'24x24-4way', qty:24, sheetrock:false, quotedPrice:0 },
          { id:'df-2', typeId:'12x12-2way', qty:16, sheetrock:false, quotedPrice:0 },
        ],
        totals: { totalMaterial: 7800, totalLabor: 3100, totalCost: 10900 },
      },
      fan_schedule: {
        rows: [
          { id:'f-1', name:'EF-1 (Restroom)', type:'Upblast Exhaust Fan', cfm:600, mount:'Roof', drive:'Direct Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x' } },
          { id:'f-2', name:'EF-2 (Kitchen)',  type:'Upblast Exhaust Fan', cfm:1200,mount:'Roof', drive:'Direct Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x' } },
        ],
        totals: { totalMaterial: 7200, totalLabor: 2800, totalCost: 10000 },
      },
      elec_heat: {
        rows: [
          { id:'eh-1', name:'UH-1 (Entry)', kw:5, qty:2, unitPrice:0 },
        ],
        totals: { totalMaterial: 2400, totalLabor: 900, totalCost: 3300 },
      },
    },
    proposalBid: 178000,
  },

  // ── 3. Medical Office — San Antonio ──
  {
    meta: {
      name:            '[DEMO] Northeast Medical Pavilion – HVAC Renovation',
      location:        'San Antonio, TX',
      owner:           'Northeast Health Systems',
      gc:              'Hensel Phelps Construction',
      bid_date:        bidDate(7),
      company_name:    'Your HVAC Company',
      company_address: '1234 Trade Center Dr, San Antonio, TX 78230',
      company_phone:   '(210) 555-0182',
      company_email:   'estimating@yourhvac.com',
      created_at:      `${daysAgo(32)} 10:30:00`,
      updated_at:      `${daysAgo(30)} 16:45:00`,
    },
    modules: {
      unit_schedule: {
        rows: [
          { id:'p-1', name:'AHU-1 (OR Suite)',    coolTons:20, ownerProvided:'', baseCostPerTon:950, quotedEquipCost:null, accessories:{ standardCurb:'x', economizer:'x', thermostat:'x', pvcCond:'x', smokeDetectors:'2' } },
          { id:'p-2', name:'AHU-2 (Recovery)',    coolTons:15, ownerProvided:'', baseCostPerTon:920, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x', pvcCond:'x', smokeDetectors:'2' } },
          { id:'p-3', name:'AHU-3 (Clinic Wing)', coolTons:12.5,ownerProvided:'', baseCostPerTon:900,quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x', pvcCond:'x' } },
          { id:'sp-1',name:'FCU-1 (IT Room)',     coolTons:2,  ownerProvided:'', baseCostPerTon:1300,quotedEquipCost:null, accessories:{ condenserRails:'x', thermostat:'x' } },
        ],
        totals: { totalMaterial: 105000, totalLabor: 28500, totalCost: 133500 },
      },
      metal_duct: {
        rows: [
          { id:'d-1', size:'30*14', linearFeet:95,  flexDuct:false, insulation:true, liner:true  },
          { id:'d-2', size:'24*12', linearFeet:140, flexDuct:false, insulation:true, liner:true  },
          { id:'d-3', size:'20*10', linearFeet:120, flexDuct:false, insulation:true, liner:false },
          { id:'d-4', size:'16*8',  linearFeet:85,  flexDuct:false, insulation:true, liner:false },
          { id:'d-5', size:'14*8',  linearFeet:60,  flexDuct:false, insulation:true, liner:false },
          { id:'d-6', size:'12',    linearFeet:45,  flexDuct:false, insulation:true, liner:false },
          { id:'d-7', size:'10',    linearFeet:30,  flexDuct:true,  insulation:false,liner:false },
        ],
        totals: { totalMaterial: 52400, totalLabor: 26800, totalCost: 79200 },
      },
      diffuser: {
        rows: [
          { id:'df-1', typeId:'24x24-4way', qty:30, sheetrock:false, quotedPrice:0 },
          { id:'df-2', typeId:'12x12-2way', qty:20, sheetrock:false, quotedPrice:0 },
          { id:'df-3', typeId:'linear-bar', qty:12, sheetrock:false, quotedPrice:0 },
        ],
        totals: { totalMaterial: 13600, totalLabor: 5200, totalCost: 18800 },
      },
      fan_schedule: {
        rows: [
          { id:'f-1', name:'EF-1 (OR Exhaust)',   type:'Upblast Exhaust Fan', cfm:1500,mount:'Roof',   drive:'Belt Drive',   ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x', vfd:'x' } },
          { id:'f-2', name:'EF-2 (Lab Exhaust)',  type:'Inline Centrifugal Fan', cfm:800, mount:'Roof', drive:'Direct Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x' } },
          { id:'f-3', name:'SF-1 (Isolation Rm)', type:'Inline Centrifugal Fan', cfm:600, mount:'Wall', drive:'Direct Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', flexConnection:'x' } },
        ],
        totals: { totalMaterial: 18200, totalLabor: 7400, totalCost: 25600 },
      },
      elec_heat: {
        rows: [
          { id:'eh-1', name:'UH-1 (Ambulance Bay)', kw:10, qty:2, unitPrice:0 },
          { id:'eh-2', name:'UH-2 (Main Entry)',    kw:5,  qty:1, unitPrice:0 },
        ],
        totals: { totalMaterial: 7200, totalLabor: 2800, totalCost: 10000 },
      },
    },
    proposalBid: 316000,
  },

  // ── 4. Retail / Restaurant — Houston (no proposal yet — in pipeline) ──
  {
    meta: {
      name:            '[DEMO] Galleria Market Food Hall – HVAC',
      location:        'Houston, TX',
      owner:           'Galleria Market Partners',
      gc:              'McCarthy Building Companies',
      bid_date:        bidDate(30),
      company_name:    'Your HVAC Company',
      company_address: '1234 Trade Center Dr, San Antonio, TX 78230',
      company_phone:   '(210) 555-0182',
      company_email:   'estimating@yourhvac.com',
      created_at:      `${daysAgo(4)} 13:00:00`,
      updated_at:      `${daysAgo(1)} 09:10:00`,
    },
    modules: {
      unit_schedule: {
        rows: [
          { id:'p-1', name:'RTU-1 (Food Court)', coolTons:25, ownerProvided:'', baseCostPerTon:760, quotedEquipCost:null, accessories:{ standardCurb:'x', economizer:'x', thermostat:'x' } },
          { id:'p-2', name:'RTU-2 (Vendor A)',   coolTons:7.5,ownerProvided:'', baseCostPerTon:900, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x' } },
          { id:'p-3', name:'RTU-3 (Vendor B)',   coolTons:7.5,ownerProvided:'', baseCostPerTon:900, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x' } },
          { id:'p-4', name:'RTU-4 (Prep Area)',  coolTons:10, ownerProvided:'', baseCostPerTon:850, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x' } },
        ],
        totals: { totalMaterial: 58400, totalLabor: 16200, totalCost: 74600 },
      },
      metal_duct: {
        rows: [
          { id:'d-1', size:'28*14', linearFeet:160, flexDuct:false, insulation:true,  liner:false },
          { id:'d-2', size:'20*10', linearFeet:110, flexDuct:false, insulation:true,  liner:false },
          { id:'d-3', size:'16*8',  linearFeet:80,  flexDuct:false, insulation:false, liner:false },
          { id:'d-4', size:'12',    linearFeet:50,  flexDuct:true,  insulation:false, liner:false },
        ],
        totals: { totalMaterial: 24600, totalLabor: 12400, totalCost: 37000 },
      },
      diffuser: {
        rows: [
          { id:'df-1', typeId:'24x24-4way', qty:20, sheetrock:false, quotedPrice:0 },
          { id:'df-2', typeId:'linear-bar', qty:14, sheetrock:false, quotedPrice:0 },
        ],
        totals: { totalMaterial: 8400, totalLabor: 3200, totalCost: 11600 },
      },
      fan_schedule: {
        rows: [
          { id:'f-1', name:'EF-1 (Kitchen Hood)', type:'Upblast Exhaust Fan', cfm:2000,mount:'Roof', drive:'Belt Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x', vfd:'x' } },
          { id:'f-2', name:'EF-2 (Prep Exhaust)', type:'Upblast Exhaust Fan', cfm:1000,mount:'Roof', drive:'Direct Drive',ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x' } },
        ],
        totals: { totalMaterial: 10400, totalLabor: 4200, totalCost: 14600 },
      },
      elec_heat: {
        rows: [
          { id:'eh-1', name:'UH-1 (Service Entry)', kw:5, qty:2, unitPrice:0 },
        ],
        totals: { totalMaterial: 2400, totalLabor: 900, totalCost: 3300 },
      },
    },
    proposalBid: null, // still in pipeline — no proposal yet
  },

  // ── 5. Office — Dallas ──
  {
    meta: {
      name:            '[DEMO] Uptown Executive Suites – HVAC Fit-Out',
      location:        'Dallas, TX',
      owner:           'Uptown Realty Holdings',
      gc:              'Balfour Beatty Construction',
      bid_date:        bidDate(45),
      company_name:    'Your HVAC Company',
      company_address: '1234 Trade Center Dr, San Antonio, TX 78230',
      company_phone:   '(210) 555-0182',
      company_email:   'estimating@yourhvac.com',
      created_at:      `${daysAgo(60)} 09:00:00`,
      updated_at:      `${daysAgo(58)} 10:00:00`,
    },
    modules: {
      unit_schedule: {
        rows: [
          { id:'p-1', name:'RTU-1 (Suite 100)', coolTons:10, ownerProvided:'', baseCostPerTon:850, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x', economizer:'x' } },
          { id:'p-2', name:'RTU-2 (Suite 200)', coolTons:10, ownerProvided:'', baseCostPerTon:850, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x', economizer:'x' } },
          { id:'p-3', name:'RTU-3 (Suite 300)', coolTons:7.5,ownerProvided:'', baseCostPerTon:900, quotedEquipCost:null, accessories:{ standardCurb:'x', thermostat:'x' } },
          { id:'sp-1',name:'AHU-1 (Data Rm)',   coolTons:3,  ownerProvided:'', baseCostPerTon:1100,quotedEquipCost:null, accessories:{ condenserRails:'x', thermostat:'x' } },
        ],
        totals: { totalMaterial: 72400, totalLabor: 19600, totalCost: 92000 },
      },
      metal_duct: {
        rows: [
          { id:'d-1', size:'22*12', linearFeet:110, flexDuct:false, insulation:true,  liner:false },
          { id:'d-2', size:'18*10', linearFeet:85,  flexDuct:false, insulation:true,  liner:false },
          { id:'d-3', size:'14*8',  linearFeet:70,  flexDuct:false, insulation:false, liner:false },
          { id:'d-4', size:'12*6',  linearFeet:55,  flexDuct:false, insulation:false, liner:false },
          { id:'d-5', size:'10',    linearFeet:40,  flexDuct:true,  insulation:false, liner:false },
        ],
        totals: { totalMaterial: 22800, totalLabor: 11600, totalCost: 34400 },
      },
      diffuser: {
        rows: [
          { id:'df-1', typeId:'24x24-4way', qty:16, sheetrock:false, quotedPrice:0 },
          { id:'df-2', typeId:'12x12-2way', qty:10, sheetrock:false, quotedPrice:0 },
        ],
        totals: { totalMaterial: 6200, totalLabor: 2600, totalCost: 8800 },
      },
      fan_schedule: {
        rows: [
          { id:'f-1', name:'EF-1 (Restrooms)', type:'Upblast Exhaust Fan', cfm:700, mount:'Roof', drive:'Direct Drive', ownerProvided:'', unitPrice:0, accessories:{ disconnectSwitch:'x', backdraftDamper:'x', curb:'x' } },
        ],
        totals: { totalMaterial: 4800, totalLabor: 1800, totalCost: 6600 },
      },
      elec_heat: {
        rows: [
          { id:'eh-1', name:'UH-1 (Lobby Entry)', kw:3, qty:1, unitPrice:0 },
        ],
        totals: { totalMaterial: 1200, totalLabor: 500, totalCost: 1700 },
      },
    },
    proposalBid: 158000,
  },
];

// ─── Insert all demo projects ─────────────────────────────────────────────────
console.log('\n🏗️  Seeding demo projects…\n');

for (const proj of DEMO_PROJECTS) {
  const pid = insertProject(proj.meta);

  // Estimates
  for (const [module, data] of Object.entries(proj.modules)) {
    insertEstimate(pid, module, data.rows, {}, data.totals);
  }

  // Proposal
  if (proj.proposalBid) {
    const filename = `${proj.meta.name.replace(/\[DEMO\]\s*/,'').replace(/[^a-zA-Z0-9]/g,'-')}-Proposal.pdf`;
    insertProposal(pid, filename, proj.proposalBid);
  }

  const totalDirect = Object.values(proj.modules).reduce((s, m) => s + m.totals.totalCost, 0);
  const margin = proj.proposalBid
    ? (((proj.proposalBid - totalDirect) / proj.proposalBid) * 100).toFixed(1)
    : '—';

  console.log(`  ✅  ${proj.meta.name}`);
  console.log(`       Location: ${proj.meta.location}  |  GC: ${proj.meta.gc}`);
  console.log(`       Direct cost: $${totalDirect.toLocaleString()}  |  Bid: ${proj.proposalBid ? '$' + proj.proposalBid.toLocaleString() : 'Pipeline'}  |  Margin: ${margin}%`);
  console.log();
}

console.log('─'.repeat(60));
console.log('✅  Demo seed complete!');
console.log('   Open the app and go to Admin Analytics to see the data.');
console.log('   Navigate to /demo-setup in the app to load demo rows');
console.log('   into every estimating module for the live demo.\n');

db.close();
