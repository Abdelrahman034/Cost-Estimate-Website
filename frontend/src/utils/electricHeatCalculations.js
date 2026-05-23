/**
 * electricHeatCalculations.js
 * Mirrors the "Electric Heat Sched" sheet logic from Bid_Template_Commercial_v2.6.xlsx
 *
 * Excel formula mapping:
 *   F (Misc Parts)      = E * $F$2          → miscParts = unitCost * miscPct
 *   G (Total Materials) = F + E             → totalMaterial = unitCost + miscParts
 *   H (Labor)           = manual input
 *   I (Mat+Lab)         = G + H             → matPlusLab = totalMaterial + labor
 *
 *   Totals row:  Labor & Mat+Lab rounded to nearest 10  (ROUND(...,-1))
 */

// ─── Default config ────────────────────────────────────────────────────────────
export const DEFAULT_MISC_PCT = 0.20;   // $F$2 = 20 %

// ─── Single-row calculation ────────────────────────────────────────────────────
/**
 * @param {{ unitCost: number, labor: number }} row
 * @param {{ miscPct: number }} settings
 * @returns {{ miscParts, totalMaterial, matPlusLab }}
 */
export function calculateElectricHeatRow(row, settings) {
  const { unitCost = 0, labor = 0 } = row;
  const { miscPct = DEFAULT_MISC_PCT } = settings;

  const miscParts     = unitCost * miscPct;
  const totalMaterial = unitCost + miscParts;
  const matPlusLab    = totalMaterial + labor;

  return { miscParts, totalMaterial, matPlusLab };
}

// ─── Batch (all rows) ──────────────────────────────────────────────────────────
/**
 * @param {Array}  rows
 * @param {object} settings
 * @returns {{ rows: Array, totals: object }}
 */
export function calculateElectricHeatBatch(rows, settings) {
  const calcRows = rows.map((r) => calculateElectricHeatRow(r, settings));

  const sum = (key) => calcRows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
  const sumInput = (key) => rows.reduce((acc, r) => acc + (parseFloat(r[key]) || 0), 0);

  const totalLaborRaw    = sumInput('labor');
  const totalMatPlusRaw  = sum('totalMaterial') + totalLaborRaw;

  const totals = {
    totalKw:          sumInput('kw'),
    totalUnitCost:    sumInput('unitCost'),
    totalMiscParts:   sum('miscParts'),
    totalMaterial:    sum('totalMaterial'),
    totalLabor:       Math.round(totalLaborRaw   / 10) * 10,   // ROUND(,-1)
    totalMatPlusLab:  Math.round(totalMatPlusRaw / 10) * 10,   // ROUND(,-1)
  };

  return { rows: calcRows, totals };
}
