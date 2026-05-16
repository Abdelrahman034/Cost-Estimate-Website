/**
 * Diffuser Schedule Calculation Engine
 * Ported from Excel workbook — Diffuser Schedule sheet
 *
 * Column map (Excel → JS):
 *   D  = type          (user selects)
 *   E  = sheetrock     (boolean — adds $25 frame)
 *   F  = quotedPrice   (user-entered override; if > 0 replaces estimated price)
 *   G  = estUnitPrice  = IF(F>0, 0, LOOKUP(type))
 *   H  = framePrice    = IF(F>0, 0, IF(sheetrock, 25, 0))
 *   I  = miscMat       = SUM(F,G,H) × miscPct  (10%)
 *   J  = laborPerUnit  = LOOKUP(type).installHrs × grdRate
 *   K  = qty           (user input)
 *   L  = totalMat      = IF(F>0, (F+I), (G+H+I)) × qty
 *   M  = totalLabor    = J × qty
 *   N  = total         = L + M
 *
 * Totals (row 24):
 *   L24 = SUM(L)
 *   M24 = ROUND(SUM(M), -1)    ← Excel rounds to nearest 10
 *   N24 = ROUND(SUM(N), -1)
 */

// ─── LOOKUP TABLE ────────────────────────────────────────────────────────────
// Source: Excel R4:T11 (Type, Install hrs, Unit price)
// These are the DEFAULT estimated prices — user can override per-row (quoted price)
// or replace entirely with live market prices fetched from Greenheck / Titus.
export const DIFFUSER_TYPES = [
  { id: 'sq_xl',   label: 'Square >24×24  (>576 in²)',  installHrs: 2.0, defaultPrice: 180 },
  { id: 'sq_l',    label: 'Square =24×24  (576 in²)',   installHrs: 1.6, defaultPrice: 102 },
  { id: 'sq_m',    label: 'Square >12×12  (>144 in²)',  installHrs: 1.6, defaultPrice:  85 },
  { id: 'sq_s',    label: 'Square =12×12  (144 in²)',   installHrs: 1.5, defaultPrice:  65 },
  { id: 'sq_xs',   label: 'Square <12×12  (<144 in²)',  installHrs: 1.5, defaultPrice:  55 },
  { id: 'slot_48', label: 'Slot 48″ (4 ft)',             installHrs: 2.5, defaultPrice: 250 },
  { id: 'slot_24', label: 'Slot 24″ (2 ft)',             installHrs: 2.5, defaultPrice: 160 },
  { id: 'other',   label: 'Other',                       installHrs: 1.6, defaultPrice: 102 },
];

export function getDiffuserType(typeId) {
  return DIFFUSER_TYPES.find((t) => t.id === typeId) ?? null;
}

// ─── GLOBAL DEFAULTS ─────────────────────────────────────────────────────────
export const DEFAULT_GRD_RATE    = 25;   // $/hr  — T2 in Excel ("Rate $/hr")
export const DEFAULT_MISC_PCT    = 0.10; // 10%   — J2 in Excel ("Misc Materials")
export const DEFAULT_FRAME_COST  = 25;   // $      — H column when sheetrock = true

// ─── SINGLE ROW CALCULATION ──────────────────────────────────────────────────
/**
 * @param {Object} row
 *   typeId       - string key into DIFFUSER_TYPES
 *   qty          - number
 *   sheetrock    - boolean  (adds $25 frame, col H)
 *   quotedPrice  - number   (0 = use estimated; >0 = overrides market price)
 *   customPrice  - number   (0 = use table default; >0 = user-defined table price)
 *
 * @param {Object} settings
 *   grdRate      - $/hr installation rate  (default 25)
 *   miscPct      - misc materials fraction (default 0.10)
 *   frameCost    - sheetrock frame cost    (default 25)
 *   marketPrices - { [typeId]: number }    optional fetched market prices
 *
 * @returns {Object} full cost breakdown
 */
export function calculateDiffuserRow(row, settings = {}) {
  const {
    typeId      = '',
    qty         = 0,
    sheetrock   = false,
    quotedPrice = 0,
    customPrice = 0,
  } = row;

  const {
    grdRate      = DEFAULT_GRD_RATE,
    miscPct      = DEFAULT_MISC_PCT,
    frameCost    = DEFAULT_FRAME_COST,
    marketPrices = {},
  } = settings;

  const type = getDiffuserType(typeId);
  if (!type || !qty) {
    return {
      typeId, qty: Number(qty) || 0,
      estUnitPrice: 0, framePrice: 0, miscMat: 0,
      laborPerUnit: 0, effectiveUnitPrice: 0,
      totalMat: 0, totalLabor: 0, total: 0,
      priceSource: 'none',
    };
  }

  const q = Number(qty) || 0;

  // ── G: estimated / market unit price ─────────────────────────────────────
  // Priority: quotedPrice (F) > customPrice > marketPrice > tableDefault
  // When quotedPrice > 0, G = 0 (Excel: IF(F>0, 0, INDEX(...)))
  let estUnitPrice = 0;
  let priceSource  = 'table';

  if (quotedPrice > 0) {
    // F column is set — quoted price overrides everything; G and H become 0
    estUnitPrice = 0;
    priceSource  = 'quoted';
  } else if (customPrice > 0) {
    estUnitPrice = customPrice;
    priceSource  = 'custom';
  } else if (marketPrices[typeId] > 0) {
    estUnitPrice = marketPrices[typeId];
    priceSource  = 'market';
  } else {
    estUnitPrice = type.defaultPrice;
    priceSource  = 'table';
  }

  // ── H: frame price ────────────────────────────────────────────────────────
  // H4 = IF(F>0, 0, IF(E='x', 25, 0))
  const framePrice = (quotedPrice > 0) ? 0 : (sheetrock ? frameCost : 0);

  // ── Effective unit price (what goes into material total) ──────────────────
  const effectiveUnitPrice = quotedPrice > 0 ? quotedPrice : estUnitPrice;

  // ── I: misc materials = SUM(F,G,H) × miscPct ─────────────────────────────
  // SUM(F,G,H) when F>0 = F+0+0 = F; when F=0 = G+H
  const basePriceForMisc = effectiveUnitPrice + framePrice;
  const miscMat = basePriceForMisc * miscPct;

  // ── J: labor per unit = installHrs × grdRate ─────────────────────────────
  const laborPerUnit = type.installHrs * grdRate;

  // ── L: total material = IF(F>0, (F+I), (G+H+I)) × qty ───────────────────
  const unitMaterialCost = effectiveUnitPrice + framePrice + miscMat;
  const totalMat   = unitMaterialCost * q;

  // ── M: total labor = laborPerUnit × qty ──────────────────────────────────
  const totalLabor = laborPerUnit * q;

  // ── N: total = L + M ─────────────────────────────────────────────────────
  const total = totalMat + totalLabor;

  return {
    typeId,
    qty:              q,
    estUnitPrice:     Math.round(estUnitPrice   * 100) / 100,
    framePrice:       Math.round(framePrice      * 100) / 100,
    miscMat:          Math.round(miscMat         * 100) / 100,
    laborPerUnit:     Math.round(laborPerUnit    * 100) / 100,
    effectiveUnitPrice: Math.round(effectiveUnitPrice * 100) / 100,
    unitMaterialCost: Math.round(unitMaterialCost * 100) / 100,
    totalMat:         Math.round(totalMat        * 100) / 100,
    totalLabor:       Math.round(totalLabor      * 100) / 100,
    total:            Math.round(total           * 100) / 100,
    priceSource,      // 'table' | 'market' | 'custom' | 'quoted'
  };
}

// ─── BATCH CALCULATION ───────────────────────────────────────────────────────
/**
 * Calculate all rows and produce totals matching Excel row 24.
 */
export function calculateDiffuserBatch(rows, settings = {}) {
  const results = rows.map((row) => ({
    id: row.id,
    ...calculateDiffuserRow(row, settings),
  }));

  const rawTotalMat   = results.reduce((s, r) => s + r.totalMat,   0);
  const rawTotalLabor = results.reduce((s, r) => s + r.totalLabor, 0);
  const rawTotal      = results.reduce((s, r) => s + r.total,      0);
  const totalQty      = results.reduce((s, r) => s + r.qty,        0);

  // Excel M24 = ROUND(SUM(M),-1), N24 = ROUND(SUM(N),-1)
  const roundTo10 = (v) => Math.round(v / 10) * 10;

  return {
    rows: results,
    totals: {
      qty:        totalQty,
      totalMat:   Math.round(rawTotalMat   * 100) / 100,
      totalLabor: roundTo10(rawTotalLabor),
      total:      roundTo10(rawTotal),
    },
  };
}
