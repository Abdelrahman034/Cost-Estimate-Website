/**
 * Summary Sheet Calculation Engine
 * Ported from Excel workbook — "Summary" sheet
 *
 * Two bid models:
 *   1. Mercury Operations Model  (overhead-based) — rows 28–33
 *   2. Base Profit Calculator    (margin-based)   — rows 36–41
 *
 * Global settings:
 *   jobSector   — 'Commercial' | 'Public' | 'Multi Family'
 *   margin      — 'L' | 'M' | 'H'
 *   quickTurn   — 'y' | 'n'  (y → labor × 1.4)
 *   region      — region name → labor multiplier from REGION_TABLE
 *   coolingTons — total installed tons (for $/ton metrics)
 */

const r2   = n => Math.round(n * 100) / 100;
const r10  = n => Math.round(n / 10) * 10;
const r100 = n => Math.round(n / 100) * 100;

function floorMatch(pairs, lookup) {
  const t = Number(lookup) || 0;
  const sorted = [...pairs].sort((a, b) => a[0] - b[0]);
  let result = sorted[0][1];
  for (const [threshold, value] of sorted) {
    if (t >= threshold) result = value;
    else break;
  }
  return result;
}

// ─── REGION TABLE ─────────────────────────────────────────────────────────────
// Source: Excel V10:W18
export const REGION_TABLE = [
  { region: 'West',        multiplier: 1.10 },
  { region: 'San Antonio', multiplier: 1.00 },
  { region: 'Austin',      multiplier: 1.15 },
  { region: 'DFW',         multiplier: 1.10 },
  { region: 'Houston',     multiplier: 1.00 },
  { region: 'Panhandle',   multiplier: 1.10 },
  { region: 'South Texas', multiplier: 0.90 },
  { region: 'East Texas',  multiplier: 1.10 },
  { region: 'North Texas', multiplier: 1.10 },
  { region: 'Other',       multiplier: 1.00 },
];
export const REGIONS = REGION_TABLE.map(r => r.region);

// ─── MARGIN PRESETS ────────────────────────────────────────────────────────────
// Default adjustments (overridable by admin via companySettings.marginL/M/H)
export const DEFAULT_MARGIN_ADJ = { L: -0.02, M: 0.00, H: 0.02 };
export const MARGIN_PRESETS = { L: 0.18, M: 0.20, H: 0.22 }; // kept for legacy reference

// Margin adjustment to Target EOY Net — Source: Excel M16:N18
export const MARGIN_ADJ      = { L: -0.02, M: 0, H: 0.02 };
export const TARGET_EOY_NET  = 0.10;

// ─── FIXED OVERHEAD TABLE ─────────────────────────────────────────────────────
// Source: Excel R17:T43
// FLOOR-MATCH totalLabor (E23) against T col (labor estimates) → R col (fixed OH $)
const FIXED_OVERHEAD_TABLE = [
  [      0, 1000], [   3500, 1000], [   5250, 1100], [   8750, 1200],
  [  15000, 1300], [  21000, 1350], [  24000, 1400], [  27000, 1600],
  [  29700, 1700], [  32400, 1800], [  35100, 1900],
  [  37800, 2000], [  37500, 2100], [  40000, 2200], [  42500, 2300],
  [  45000, 2400], [  47500, 2500], [  50000, 2600], [  52500, 2700],
  [  55000, 2800], [  57500, 2900], [  60000, 3000], [  62500, 3100],
  [ 500000, 3200], [1000000, 4000], [1500000, 6000],
];

// ─── SMALL-JOB TAX ADD ────────────────────────────────────────────────────────
// Source: Excel N29:N34 — tiered additions when total cost is small
function calcSmallJobAdd(totalCost) {
  const c = Number(totalCost) || 0;
  if (c > 75000) return 0;
  if (c >= 50000) return 0.01;
  if (c >= 25000) return 0.02;
  if (c >= 15000) return 0.03;
  if (c >= 10000) return 0.05;
  if (c >=  5000) return 0.09;
  if (c >      0) return 0.12;
  return 0;
}

// ─── SCHEDULE ROWS ────────────────────────────────────────────────────────────
// Mirrors Excel rows 10-20
export const SCHEDULE_ROWS = [
  { key: 'general',   label: 'General' },
  { key: 'unit',      label: 'Unit' },
  { key: 'vav',       label: 'VAV' },
  { key: 'heater',    label: 'Heater' },
  { key: 'fan',       label: 'Fan' },
  { key: 'louver',    label: 'Louver / Fire Damper' },
  { key: 'duct',       label: 'Metal Duct' },
  { key: 'diffusers',  label: 'Diffusers' },
  { key: 'copperPipe', label: 'Copper Pipe' },
  { key: 'mfLiving',  label: 'MF Living Units' },
  { key: 'mfCommon',  label: 'MF Common Area Duct Board / Flex' },
];

// ─── MAIN CALCULATION ─────────────────────────────────────────────────────────
// Default sector config (used when admin hasn't customised)
export const DEFAULT_SECTOR_CONFIG = {
  Commercial:   { matTaxPct: 0.0825, bidAddPct: 0.00,  notes: '' },
  Public:       { matTaxPct: 0.00,   bidAddPct: 0.005, notes: 'No material tax; +0.5% bid add' },
  'Multi Family':{ matTaxPct: 0.0825, bidAddPct: 0.00,  notes: '' },
};

export function calcSummary(schedules = {}, settings = {}, coolingTons = 0, marginAdj = DEFAULT_MARGIN_ADJ, sectorConfig = DEFAULT_SECTOR_CONFIG) {
  const {
    jobSector  = 'Commercial',
    margin     = 'M',
    quickTurn  = 'n',
    region     = 'Houston',
  } = settings;

  // Dynamic margin adjustments (admin-configurable: L/M/H offsets)
  const adj = {
    L: Number(marginAdj?.L ?? DEFAULT_MARGIN_ADJ.L),
    M: Number(marginAdj?.M ?? DEFAULT_MARGIN_ADJ.M),
    H: Number(marginAdj?.H ?? DEFAULT_MARGIN_ADJ.H),
  };

  // Sector rules (admin-configurable)
  const sector = sectorConfig?.[jobSector] ?? DEFAULT_SECTOR_CONFIG[jobSector] ?? DEFAULT_SECTOR_CONFIG.Commercial;
  const sectorMatTaxPct = Number(sector.matTaxPct ?? 0.0825);
  const sectorBidAddPct = Number(sector.bidAddPct ?? 0);

  const tons = Math.max(Number(coolingTons) || 1, 1);

  // Region multiplier — Excel D7
  const regionRow       = REGION_TABLE.find(r => r.region === region) ?? REGION_TABLE[4];
  const laborMultiplier = regionRow.multiplier;
  const quickTurnFactor = quickTurn === 'y' ? 1.4 : 1;

  // Sum raw schedule mat/labor
  let rawMat = 0, rawLabor = 0;
  const rowMetrics = SCHEDULE_ROWS.map(({ key, label }) => {
    const s     = schedules[key] ?? { mat: 0, labor: 0 };
    const mat   = Number(s.mat)   || 0;
    const labor = Number(s.labor) || 0;
    rawMat   += mat;
    rawLabor += labor;
    return { key, label, mat, labor };
  });

  // Base Schedule Total — Excel row 23
  const totalMat   = r2(rawMat);
  const totalLabor = r2(rawLabor * quickTurnFactor * laborMultiplier);  // E23
  const totalCost  = r2(totalMat + totalLabor);                          // F23

  // Per-schedule adjusted metrics
  const rowMetricsFull = rowMetrics.map(r => {
    const mat      = r.mat;
    const laborAdj = r2(r.labor * quickTurnFactor * laborMultiplier);
    const total    = r2(mat + laborAdj);
    return {
      ...r,
      laborAdj,
      total,
      matPerTon:  tons > 0 ? r2(mat      / tons) : 0,
      labPerTon:  tons > 0 ? r2(laborAdj / tons) : 0,
      totPerTon:  tons > 0 ? r2(total    / tons) : 0,
      split:      totalCost > 0 ? r2(total / totalCost) : 0,
    };
  });

  // Tax — Excel D32/D40
  // ROUND(mat × 8.25% + labor × 0%, -1)
  // Sector-configurable: mat tax % and bid addition %
  const taxOnMat  = sectorMatTaxPct;
  const tax       = r10(totalMat * taxOnMat);
  const publicAdd = r2(sectorBidAddPct * totalMat);

  // Fixed overhead lookup — Excel N15
  const fixedOH = floorMatch(FIXED_OVERHEAD_TABLE, totalLabor);

  // Total adjustment — Excel N19 = margin adj + 0.10
  const totalAdj = r2((adj[margin] ?? 0) + TARGET_EOY_NET);

  // ── Mercury Operations Bid — Excel D29 ────────────────────────────────────
  // (fixedOH + labor×0.5 + totalCost) / (1 - totalAdj) + publicAdd
  const VARIABLE_OH_RATE = 0.5;
  const mercuryBid   = r2((fixedOH + totalLabor * VARIABLE_OH_RATE + totalCost) / (1 - totalAdj) + publicAdd);
  const mercuryGP    = r2(mercuryBid - totalCost);
  const mercuryMargin= mercuryBid > 0 ? Math.round(mercuryGP / mercuryBid * 10000) / 10000 : 0;
  const mercuryTax   = tax;
  const mercuryTotal = r2(mercuryBid + mercuryTax);

  // ── Base Profit Calculator — Excel D37 ───────────────────────────────────
  // Boundaries (O24, O25)
  const minBound = r100(totalMat + (1 + 0.8) * totalLabor);  // min labor mult = 0.8
  const maxBound = r100(totalMat + (1 + 2.5) * totalLabor);  // max labor mult = 2.5

  // Selected margin with adds
  const baseMargin   = MARGIN_PRESETS[margin] ?? 0.20;
  const smallJobAdd  = calcSmallJobAdd(totalCost);
  const laborAdd     = totalCost > 0 ? r2(Math.max(0, totalLabor / totalCost - 0.25) * 0.75) : 0;
  const publicAddPct = sectorBidAddPct;
  const selectedMargin = r2(baseMargin + smallJobAdd + laborAdd + publicAddPct);

  // O39 = ROUND(totalCost / (1 - selectedMargin), -2)
  const preTaxBid  = r100(totalCost / (1 - selectedMargin));
  const boundedBid = Math.min(Math.max(preTaxBid, minBound), maxBound);
  const baseBid    = r2(boundedBid + publicAdd);
  const baseGP     = r2(baseBid - totalCost);
  const baseMarginActual = baseBid > 0 ? Math.round(baseGP / baseBid * 10000) / 10000 : 0;
  const baseTax    = tax;
  const baseTotal  = r2(baseBid + baseTax);

  return {
    // Settings
    jobSector, margin, quickTurn, region,
    laborMultiplier, quickTurnFactor, coolingTons: tons,

    // Schedule table
    rowMetrics: rowMetricsFull,
    totalMat, totalLabor, totalCost,
    matPerTon: r2(totalMat / tons),
    laborPerTon: r2(totalLabor / tons),
    totalPerTon: r2(totalCost / tons),

    // Overhead model intermediates
    fixedOH, totalAdj, taxOnMat,

    // Tax + public add
    tax, publicAdd,

    // Boundaries
    minBound, maxBound,

    // Mercury Operations Model
    mercury: {
      bid: mercuryBid, grossProfit: mercuryGP,
      margin: mercuryMargin, tax: mercuryTax, total: mercuryTotal,
      pricePerTon: r2(mercuryBid / tons),
    },

    // Base Profit Calculator
    base: {
      baseMargin, selectedMargin, smallJobAdd, laborAdd,
      preTaxBid, boundedBid,
      bid: baseBid, grossProfit: baseGP,
      margin: baseMarginActual, tax: baseTax, total: baseTotal,
      pricePerTon: r2(baseBid / tons),
    },
  };
}

// Backwards compatibility exports
export function rollUpSummary(modules = []) {
  const materialCost = modules.reduce((s, m) => s + (m.materialCost || 0), 0);
  const laborCost    = modules.reduce((s, m) => s + (m.laborCost    || 0), 0);
  const laborHours   = modules.reduce((s, m) => s + (m.laborHours   || 0), 0);
  return { materialCost, laborCost, laborHours, directCost: materialCost + laborCost };
}
export function applyOverheadAndMargin(directCost, overheadPct = 0.15, profitPct = 0.10) {
  const overhead = directCost * overheadPct;
  const subtotal  = directCost + overhead;
  const profit    = subtotal * profitPct;
  return { directCost, overhead, subtotal, profit, total: subtotal + profit };
}
