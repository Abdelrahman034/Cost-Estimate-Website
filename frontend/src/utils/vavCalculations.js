/**
 * vavCalculations.js
 * Mirrors the "VAV Schedule" sheet logic from Bid_Template_Commercial_v2.6.xlsx
 *
 * Excel column map (sheet rows 4–36, totals row 37):
 *   B  = item          (auto-increment line number — display only)
 *   C  = building      (building / area label)
 *   D  = idTag         (VAV box tag / ID)
 *   E  = fanCfm        (design airflow)
 *   F  = dia           (inlet diameter — informational)
 *   G  = pricePerCfm   ($/CFM — optional driver for unit cost)
 *   H  = unitCost      (box material cost)
 *   I  = controls      (controls / actuator cost)
 *   J  = other         (other material cost)
 *   K  = miscParts     = SUM(H:J) * 0.1           → 10% misc-parts uplift
 *   L  = totalMaterial = ROUND(SUM(H:K), -1)      → rounded to nearest $10
 *   M  = labor         (manual labor $ input)
 *   N  = matPlusLab    = L + M
 *   O  = notes
 *
 * Totals row (37):
 *   E37 = SUM(fanCfm)        H37 = SUM(unitCost)   I37 = SUM(controls)
 *   J37 = SUM(other)         K37 = SUM(miscParts)  L37 = SUM(totalMaterial)
 *   M37 = ROUND(SUM(labor), -1)
 *   N37 = ROUND(SUM(matPlusLab), -1)
 *
 * Note on Unit Cost (col H): in the workbook H is entered manually, but the
 * adjacent "Price/Cfm" (col G) is the intended driver. Here, when pricePerCfm
 * is provided (> 0) the unit cost is derived as fanCfm × pricePerCfm; otherwise
 * the manually-entered unitCost is used. This is backward-compatible with the
 * sheet (leave pricePerCfm blank to type unit cost directly).
 */

// ─── Default config (mirror Excel constant cells) ────────────────────────────
export const DEFAULT_MISC_PCT = 0.10;   // K = SUM(H:J) * 0.1  → 10%

// ─── Helpers ──────────────────────────────────────────────────────────────────
const num = (v) => (parseFloat(v) || 0);
const round2 = (v) => Math.round(v * 100) / 100;
const roundTo10 = (v) => Math.round(v / 10) * 10;   // Excel ROUND(x, -1)

/**
 * Effective unit cost (Excel col H).
 * Derived from price/CFM when supplied, else the manual unit cost.
 */
export function resolveUnitCost(row) {
  const cfm   = num(row.fanCfm);
  const price = num(row.pricePerCfm);
  if (price > 0) return round2(cfm * price);
  return num(row.unitCost);
}

// ─── Single-row calculation ─────────────────────────────────────────────────
/**
 * @param {Object} row
 *   fanCfm, pricePerCfm, unitCost, controls, other, labor
 * @param {Object} settings { miscPct }
 * @returns {{ unitCost, miscParts, totalMaterial, matPlusLab }}
 */
export function calculateVavRow(row, settings = {}) {
  const { miscPct = DEFAULT_MISC_PCT } = settings;

  const H = resolveUnitCost(row);   // unit cost
  const I = num(row.controls);
  const J = num(row.other);
  const M = num(row.labor);

  // K = SUM(H:J) * miscPct
  const miscParts = round2((H + I + J) * miscPct);
  // L = ROUND(SUM(H:K), -1)
  const totalMaterial = roundTo10(H + I + J + miscParts);
  // N = L + M
  const matPlusLab = round2(totalMaterial + M);

  return {
    unitCost:      round2(H),
    controls:      round2(I),
    other:         round2(J),
    miscParts,
    totalMaterial,
    labor:         round2(M),
    matPlusLab,
  };
}

/** True when a row has any cost data worth calculating/saving. */
export function isVavRowFilled(row) {
  return (
    num(row.fanCfm) > 0 ||
    num(row.unitCost) > 0 ||
    num(row.pricePerCfm) > 0 ||
    num(row.controls) > 0 ||
    num(row.other) > 0 ||
    num(row.labor) > 0 ||
    !!(row.idTag && String(row.idTag).trim())
  );
}

// ─── Batch (all rows) + totals (Excel row 37) ────────────────────────────────
/**
 * @param {Array}  rows
 * @param {Object} settings { miscPct }
 * @returns {{ rows: Array, totals: Object }}
 */
export function calculateVavBatch(rows, settings = {}) {
  const results = rows.map((r) => calculateVavRow(r, settings));

  const sum = (key) => results.reduce((s, r) => s + (r[key] || 0), 0);
  const sumIn = (key) => rows.reduce((s, r) => s + num(r[key]), 0);

  const totalLaborRaw      = sum('labor');
  const totalMatPlusLabRaw = sum('matPlusLab');

  const totals = {
    totalCfm:        round2(sumIn('fanCfm')),                 // E37
    totalUnitCost:   round2(sum('unitCost')),                 // H37
    totalControls:   round2(sum('controls')),                 // I37
    totalOther:      round2(sum('other')),                    // J37
    totalMiscParts:  round2(sum('miscParts')),                // K37
    totalMaterial:   round2(sum('totalMaterial')),            // L37
    totalLabor:      roundTo10(totalLaborRaw),                // M37 ROUND(,-1)
    totalMatPlusLab: roundTo10(totalMatPlusLabRaw),           // N37 ROUND(,-1)
  };

  return { rows: results, totals };
}
