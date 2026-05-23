/**
 * Fan Schedule Calculation Engine
 * Ported from Excel workbook — "Fan Schedule" sheet
 *
 * Column map (Excel → JS):
 *   C  = id             (user-entered tag/ID)
 *   D  = cfm            (airflow, informational)
 *   E  = fanType        (dropdown — lookup key)
 *   F  = sizeCategory   ('Small' | 'Large' | 'Enormous')
 *   G  = unitCost       (material cost of the fan)
 *   H  = otherCost      (additional material cost)
 *   I  = roofPen        (boolean — roof penetration required)
 *   J  = wallPen        (boolean — wall/concrete penetration required)
 *   K  = penetrations   = IF(roof, $T$5, IF(wall, $T$7, 0))
 *   L  = miscParts      = SUM(G,H) × miscPct  (20%)
 *   M  = totalMaterial  = G + H + K + L
 *   N  = laborInput     (manual override hours — optional)
 *   O  = laborTable     = INDEX/MATCH(fanType, sizeCategory) × laborRate
 *   P  = laborFinal     = IF(N > 0, N, O)
 *   Q  = matPlusLab     = M + P
 *   R  = notes
 *
 * Totals (Excel row 30):
 *   G30 = SUM(G)   H30 = SUM(H)   K30 = SUM(K)   L30 = SUM(L)
 *   M30 = SUM(M)   N30 = ROUND(SUM(N), -1)
 *   O30 = SUM(O)   P30 = SUM(P)
 *   Q30 = ROUND(SUM(Q), -1)
 */

// ─── Fan Types ─────────────────────────────────────────────────────────────────
// Source: Excel Z5:AC11  (fan type × size → labor hours)
// Hours = raw $ value from table ÷ laborRate ($25).
// Excel stores 1500/25 = 60 hrs for HVLS Small, etc.
export const FAN_TYPES = [
  {
    id: 'hvls',
    label: 'HVLS (Big Ass)',
    hours: { Small: 60, Large: 100, Enormous: 140 },  // 1500/25, 2500/25, 3500/25
  },
  {
    id: 'ceiling_std',
    label: 'Ceiling (Standard)',
    hours: { Small: 8, Large: 10, Enormous: 14 },
  },
  {
    id: 'ceiling_exhaust',
    label: 'Ceiling Exhaust',
    hours: { Small: 5, Large: 6, Enormous: 7 },
  },
  {
    id: 'inline_exhaust',
    label: 'Inline Exhaust',
    hours: { Small: 9, Large: 11, Enormous: 14 },
  },
  {
    id: 'roof_mounted',
    label: 'Roof Mounted',
    hours: { Small: 10, Large: 14, Enormous: 20 },
  },
  {
    id: 'shop_exhaust',
    label: 'Shop Exhaust',
    hours: { Small: 12, Large: 16, Enormous: 48 },
  },
  {
    id: 'other',
    label: 'Other',
    hours: { Small: null, Large: null, Enormous: null },  // no table hours — manual entry required
  },
];

export const SIZE_CATEGORIES = ['Small', 'Large', 'Enormous'];

export function getFanType(typeId) {
  return FAN_TYPES.find((t) => t.id === typeId) ?? null;
}

// ─── Defaults (match Excel config cells) ──────────────────────────────────────
export const DEFAULT_ROOF_PEN_COST = 100;   // $T$5  — roof penetration
export const DEFAULT_WALL_PEN_COST = 200;   // $T$7  — wall (concrete) penetration
export const DEFAULT_MISC_PCT      = 0.20;  // $M$3  — 20% misc parts uplift
export const DEFAULT_LABOR_RATE    = 25;    // $AC$3 — $/hr install rate

// ─── Single row calculation ────────────────────────────────────────────────────
/**
 * @param {Object} row
 *   id           - string (fan tag/ID — display only)
 *   cfm          - number (airflow — display only)
 *   fanType      - string (key into FAN_TYPES)
 *   sizeCategory - 'Small' | 'Large' | 'Enormous'
 *   unitCost     - number  (col G)
 *   otherCost    - number  (col H)
 *   roofPen      - boolean (col I)
 *   wallPen      - boolean (col J)
 *   laborInput   - number  (col N — manual hours override; 0 = use table)
 *   notes        - string
 *
 * @param {Object} settings
 *   roofPenCost  - $ per roof penetration  (default 100)
 *   wallPenCost  - $ per wall penetration  (default 200)
 *   miscPct      - misc parts fraction     (default 0.20)
 *   laborRate    - $/hr                   (default 25)
 *
 * @returns {Object} full cost breakdown
 */
export function calculateFanRow(row, settings = {}) {
  const {
    fanType      = '',
    sizeCategory = 'Small',
    unitCost     = 0,
    otherCost    = 0,
    roofPen      = false,
    wallPen      = false,
    laborInput   = 0,
  } = row;

  const {
    roofPenCost = DEFAULT_ROOF_PEN_COST,
    wallPenCost = DEFAULT_WALL_PEN_COST,
    miscPct     = DEFAULT_MISC_PCT,
    laborRate   = DEFAULT_LABOR_RATE,
  } = settings;

  const type = getFanType(fanType);

  // Empty row — no fan type selected
  if (!type) {
    return {
      penetrations: 0, miscParts: 0, totalMaterial: 0,
      laborTable: 0, laborFinal: 0, matPlusLab: 0,
      laborHours: 0,
    };
  }

  const G = Number(unitCost)  || 0;
  const H = Number(otherCost) || 0;

  // ── K: Penetrations ────────────────────────────────────────────────────────
  // =IF(E="","", IF(I="x", $T$5, IF(J="x", $T$7, 0)))
  // Roof takes precedence if both checked
  let K = 0;
  if (roofPen)      K = roofPenCost;
  else if (wallPen) K = wallPenCost;

  // ── L: Misc Parts = (G + H) × miscPct ─────────────────────────────────────
  const L = (G + H) * miscPct;

  // ── M: Total Material = G + H + K + L ─────────────────────────────────────
  const M = G + H + K + L;

  // ── O: Labor (Table) = hours × laborRate ──────────────────────────────────
  // =IFERROR(INDEX(..., MATCH(fanType,...), MATCH(size,...)) * $AC$3, "")
  const tableHours = type.hours?.[sizeCategory] ?? null;
  const O = tableHours !== null ? tableHours * laborRate : 0;

  // ── N: Labor (Input) — manual dollar override ──────────────────────────────
  const N = Number(laborInput) || 0;

  // ── P: Labor Final = IF(N > 0, N, O) ──────────────────────────────────────
  const P = N > 0 ? N : O;

  // ── Q: Mat + Lab = M + P ──────────────────────────────────────────────────
  const Q = M + P;

  return {
    penetrations:  Math.round(K * 100) / 100,
    miscParts:     Math.round(L * 100) / 100,
    totalMaterial: Math.round(M * 100) / 100,
    laborHours:    tableHours,
    laborTable:    Math.round(O * 100) / 100,
    laborInput:    N,
    laborFinal:    Math.round(P * 100) / 100,
    matPlusLab:    Math.round(Q * 100) / 100,
    usedManualLabor: N > 0,
  };
}

// ─── Batch calculation ─────────────────────────────────────────────────────────
/**
 * Calculate all rows and produce totals matching Excel row 30.
 */
export function calculateFanBatch(rows, settings = {}) {
  const results = rows.map((row) => ({
    id: row.id,
    ...calculateFanRow(row, settings),
  }));

  const roundTo10 = (v) => Math.round(v / 10) * 10;

  const sum = (key) => results.reduce((s, r) => s + (r[key] || 0), 0);

  const totalUnitCost    = rows.reduce((s, r) => s + (Number(r.unitCost)  || 0), 0);
  const totalOtherCost   = rows.reduce((s, r) => s + (Number(r.otherCost) || 0), 0);
  const totalPenetrations = sum('penetrations');
  const totalMiscParts    = sum('miscParts');
  const totalMaterial     = sum('totalMaterial');
  const totalLaborInput   = sum('laborInput');
  const totalLaborTable   = sum('laborTable');
  const totalLaborFinal   = sum('laborFinal');
  const totalMatPlusLab   = sum('matPlusLab');

  return {
    rows: results,
    totals: {
      totalUnitCost:    Math.round(totalUnitCost    * 100) / 100,
      totalOtherCost:   Math.round(totalOtherCost   * 100) / 100,
      totalPenetrations:Math.round(totalPenetrations * 100) / 100,
      totalMiscParts:   Math.round(totalMiscParts   * 100) / 100,
      totalMaterial:    Math.round(totalMaterial    * 100) / 100,
      totalLaborInput:  roundTo10(totalLaborInput),   // ROUND(..., -1)
      totalLaborTable:  Math.round(totalLaborTable   * 100) / 100,
      totalLaborFinal:  Math.round(totalLaborFinal   * 100) / 100,
      totalMatPlusLab:  roundTo10(totalMatPlusLab),   // ROUND(..., -1)
    },
  };
}
