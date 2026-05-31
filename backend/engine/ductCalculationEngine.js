// ─────────────────────────────────────────────────────────────────────────────
// ductCalculationEngine.js
//
// Server-side HVAC Metal Duct estimation engine.
// Ported from the Excel workbook "Metal Duct" sheet and SMACNA standards.
//
// RULES:
//   1. No Express/Prisma imports — pure calculation logic only.
//   2. Every function is deterministic: same input → same output.
//   3. Frontend calls POST /api/calculate { module: 'METAL_DUCT', rows, prices }
//      and receives the full result. It does NOT run any cost math.
//
// Sources:
//   Gauge selection:    SMACNA HVAC Duct Construction Standards 4th Ed., Tables 1-2 & 3-1
//   Material thickness: ASTM A653 (galvanized), A568 (black steel), A240 (SS), B209 (aluminum)
//   Densities:          Standard engineering references
// ─────────────────────────────────────────────────────────────────────────────

'use strict';

// ─── DUCT MATERIAL OPTIONS ────────────────────────────────────────────────────
const DUCT_MATERIAL_OPTIONS = [
  { value: 'galvanized',   label: 'Galvanized Steel',  short: 'Galv.' },
  { value: 'blackSteel',   label: 'Black Steel',        short: 'Black' },
  { value: 'stainless304', label: 'Stainless 304',      short: 'SS304' },
  { value: 'stainless316', label: 'Stainless 316',      short: 'SS316' },
  { value: 'aluminum',     label: 'Aluminum 3003',      short: 'Alum.' },
];

// ─── GAUGE THICKNESS BY MATERIAL (mm) ────────────────────────────────────────
// Sources:
//   Galvanized: ASTM A653 / SMACNA G-60 nominal thickness (includes zinc coating)
//   Black Steel: ASTM A568 Manufacturer's Standard Gauge (uncoated)
//   Stainless:   ASTM A240 (304 & 316 share same nominal gauge thicknesses)
//   Aluminum:    ASTM B209, Alloy 3003-H14 (AWG / Brown & Sharpe gauge)
const GAUGE_THICKNESS_MM = {
  galvanized:   { 18: 1.310, 20: 1.006, 22: 0.853, 24: 0.701, 26: 0.551, 28: 0.475, 30: 0.399 },
  blackSteel:   { 18: 1.214, 20: 0.912, 22: 0.759, 24: 0.607, 26: 0.455, 28: 0.378, 30: 0.305 },
  stainless304: { 18: 1.270, 20: 0.953, 22: 0.795, 24: 0.635, 26: 0.478, 28: 0.396 },
  stainless316: { 18: 1.270, 20: 0.953, 22: 0.795, 24: 0.635, 26: 0.478, 28: 0.396 },
  aluminum:     { 18: 1.024, 20: 0.813, 22: 0.643, 24: 0.511, 26: 0.404, 28: 0.320 },
};

// ─── MATERIAL DENSITY (kg/m³) ─────────────────────────────────────────────────
const MATERIAL_DENSITY_KG_M3 = {
  galvanized:   7850,
  blackSteel:   7850,
  stainless304: 7930,
  stainless316: 8030,
  aluminum:     2730,
};

// ─── ZINC COATING WEIGHT OFFSET (kg/m²) ──────────────────────────────────────
// SMACNA G-60 coating: 60 g/m² per side = 0.12 kg/m² total
const ZINC_OFFSET_KG_M2 = {
  galvanized:   0.12,
  blackSteel:   0,
  stainless304: 0,
  stainless316: 0,
  aluminum:     0,
};

// ─── GAUGE SELECTION — SMACNA 1" WG (250 Pa) ─────────────────────────────────
// Rectangular: by max duct dimension (in). Round: by diameter — one grade lighter.
// Source: SMACNA HVAC Duct Construction Standards 4th Ed., Tables 1-2 & 3-1
function selectGauge(maxDimension, shape = 'rectangular') {
  const d = Number(maxDimension);
  if (shape === 'round') {
    if (d <=  8) return 26;
    if (d <= 14) return 24;
    if (d <= 26) return 22;
    if (d <= 50) return 20;
    return 18;
  }
  if (d <= 12) return 26;
  if (d <= 30) return 24;
  if (d <= 42) return 22;
  if (d <= 60) return 20;
  return 18;
}

// ─── FLEX DUCT PRICE TABLE ────────────────────────────────────────────────────
// Extracted from Excel Metal Duct sheet (AL18:AN30).
// Formula: AN = AM / 25  ($/25ft roll → $/ft)
// Source: S4 = IF(I4="x", $AC$13 × INDEX($AN$19:$AN$30, MATCH($E4,$AL$19:$AL$30,0)) × 1.25, 0)
const FLEX_DUCT_PRICE_TABLE = [
  { size:  4, per25ft:  48 },
  { size:  5, per25ft:  52 },
  { size:  6, per25ft:  56 },
  { size:  7, per25ft:  61 },
  { size:  8, per25ft:  66 },
  { size:  9, per25ft:  73 },
  { size: 10, per25ft:  80 },
  { size: 12, per25ft:  98 },
  { size: 14, per25ft: 116 },
  { size: 16, per25ft: 138 },
  { size: 18, per25ft: 165 },
  { size: 20, per25ft: 216 },
];

function lookupFlexDuctRate(diameter) {
  const d = Number(diameter);
  const exact = FLEX_DUCT_PRICE_TABLE.find((e) => e.size === d);
  if (exact) return exact.per25ft / 25;
  const sorted = FLEX_DUCT_PRICE_TABLE.slice().sort((a, b) => a.size - b.size);
  for (const entry of sorted) {
    if (entry.size >= d) return entry.per25ft / 25;
  }
  return sorted[sorted.length - 1].per25ft / 25;
}

// ─── ROUND DUCT PRICE TABLE ───────────────────────────────────────────────────
// Extracted directly from Excel Metal Duct sheet (AP column, data_only).
// Formula: AP = AO × (1 + AP3_buffer=0.5), where AO = AM/3 + AN/5
const ROUND_DUCT_PRICE_PER_FT = [
  { size:  3, rate:  2.874 },
  { size:  4, rate:  3.564 },
  { size:  5, rate:  3.618 },
  { size:  6, rate:  3.690 },
  { size:  7, rate:  5.328 },
  { size:  8, rate:  6.060 },
  { size:  9, rate:  8.040 },
  { size: 10, rate:  8.634 },
  { size: 12, rate: 10.668 },
  { size: 14, rate: 14.034 },
  { size: 16, rate: 17.030 },
  { size: 18, rate: 22.210 },
];

// ─── WORKBOOK CONSTANTS ───────────────────────────────────────────────────────
const SHEET_METAL_COST_PER_LB       = 4.0;    // AC6  $/lb
const SHEET_METAL_LABOR_RATE        = 23.0;   // AC9  $/LF
const DUCT_WRAP_LABOR_COST          = 4.0;    // AC8  $/LF
const DUCT_WRAP_MATERIAL_COST       = 1.25;   // AC7  $/ft²
const FLEX_DUCT_LABOR_SHORT         = 40.0;   // AC10 $/run (≤ 5 ft)
const FLEX_DUCT_LABOR_LONG          = 80.0;   // AC11 $/run (> 5 ft)
const MAX_FLEX_DUCT_LEN             = 5.0;    // AC13 ft
const OFFTAKE_COST                  = 20.0;   // AC12 $/run
const VD_COST                       = 25.0;   // T4   $/each
const INTERNAL_INSULATION_UPLIFT    = 0.40;   // AC14 40%
const SQUARE_DUCT_INCIDENTALS_PCT   = 0.20;   // U2
const ROUND_DUCT_INCIDENTALS_PCT    = 0.25;   // V2
const DEFAULT_WASTE_FACTOR          = 0.10;

// ─── FITTING MULTIPLIERS ──────────────────────────────────────────────────────
const FITTING_MULTIPLIERS = {
  elbow:      1.8,
  tee:        2.2,
  reducer:    1.4,
  offset:     1.6,
  transition: 1.5,
  cap:        0.5,
};

// ─── LABOR FACTORS (hours/sqft) by gauge ─────────────────────────────────────
const LABOR_FACTOR_BY_GAUGE = {
  26: 0.045,
  24: 0.050,
  22: 0.058,
  20: 0.068,
  18: 0.082,
};

// ─── UNIT CONVERSIONS ─────────────────────────────────────────────────────────
const UNIT_TO_FT = { ft: 1.0, in: 1 / 12, m: 1 / 0.3048, cm: 1 / 30.48, mm: 1 / 304.8 };

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function roundToNearest(value, step = 10) {
  return Math.round(value / step) * step;
}

function roundUpToNearest(value, step = 10) {
  return Math.ceil(value / step) * step;
}

function interpolateRoundDuctRate(size) {
  const d = Number(size);
  if (!Number.isFinite(d) || d <= 0) return 0;
  const exact = ROUND_DUCT_PRICE_PER_FT.find((e) => e.size === d);
  if (exact) return exact.rate;
  const sorted = ROUND_DUCT_PRICE_PER_FT.slice().sort((a, b) => a.size - b.size);
  if (d <= sorted[0].size) return sorted[0].rate;
  if (d >= sorted[sorted.length - 1].size) return sorted[sorted.length - 1].rate;
  for (let i = 0; i < sorted.length - 1; i++) {
    const left = sorted[i];
    const right = sorted[i + 1];
    if (d >= left.size && d <= right.size) {
      const span = right.size - left.size;
      const ratio = span === 0 ? 0 : (d - left.size) / span;
      return left.rate + (right.rate - left.rate) * ratio;
    }
  }
  return sorted[0].rate;
}

// ─── SHAPE DETECTION ──────────────────────────────────────────────────────────
// Source: =IF(ISERROR(FIND("*",$E4)),"x","") → round if no "*", rect if "*"
function detectShape(sizeString) {
  if (!sizeString) return null;
  return sizeString.includes('x') || sizeString.includes('X') || sizeString.includes('*')
    ? 'rectangular'
    : 'round';
}

// Normalize size notation: "24x12", "24X12", "24*12" → { type, width/height or diameter }
function parseSize(sizeString) {
  if (!sizeString) return null;
  const s = String(sizeString).trim().toLowerCase();
  if (!s.includes('x') && !s.includes('*')) {
    const d = parseFloat(s);
    if (!isNaN(d)) return { type: 'round', diameter: d };
  }
  const parts = s.split(/[x*]/);
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (!isNaN(w) && !isNaN(h)) return { type: 'rectangular', width: w, height: h };
  }
  return null;
}

// ─── GEOMETRY ─────────────────────────────────────────────────────────────────
// Round:       A = π × d(in) × L(ft) × 12 / 144  → sqft
// Rectangular: A = 2(W+H)(in) × L(ft) × 12 / 144 → sqft
function calculateSurfaceArea(sizeString, linearFeet) {
  const parsed = parseSize(sizeString);
  if (!parsed) return 0;
  const lf = Number(linearFeet) || 0;
  if (parsed.type === 'round') {
    return (Math.PI * parsed.diameter * lf * 12) / 144;
  }
  if (parsed.type === 'rectangular') {
    return (2 * (parsed.width + parsed.height) * lf * 12) / 144;
  }
  return 0;
}

function getMaxDimension(sizeString) {
  const parsed = parseSize(sizeString);
  if (!parsed) return 0;
  if (parsed.type === 'round') return parsed.diameter;
  return Math.max(parsed.width, parsed.height);
}

// ─── WEIGHT ───────────────────────────────────────────────────────────────────
// Physics: Weight = Volume × Density + zinc coating offset (galvanized only)
function calculateWeight(surfaceAreaSqFt, gauge, ductMaterial = 'galvanized') {
  const thicknessTable = GAUGE_THICKNESS_MM[ductMaterial] || GAUGE_THICKNESS_MM.galvanized;
  const thicknessMm    = thicknessTable[gauge] || thicknessTable[26] || 0.551;
  const density        = MATERIAL_DENSITY_KG_M3[ductMaterial] || 7850;
  const zincOffset     = ZINC_OFFSET_KG_M2[ductMaterial] || 0;
  const surfaceAreaM2  = surfaceAreaSqFt * 0.092903;
  const volumeM3       = surfaceAreaM2 * (thicknessMm / 1000);
  const weightKg       = volumeM3 * density + surfaceAreaM2 * zincOffset;
  return weightKg * 2.20462; // → lbs
}

function getThicknessMm(gauge, ductMaterial = 'galvanized') {
  const table = GAUGE_THICKNESS_MM[ductMaterial] || GAUGE_THICKNESS_MM.galvanized;
  return table[gauge] || null;
}

// ─── LABOR HOURS ──────────────────────────────────────────────────────────────
function calculateLaborHours(surfaceAreaSqFt, gauge, difficultyFactor = 1.0) {
  const factor = LABOR_FACTOR_BY_GAUGE[gauge] || 0.05;
  return surfaceAreaSqFt * factor * difficultyFactor;
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE: Single duct line item calculation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {Object} row   – user inputs
 * @param {Object} prices – pricing overrides from DB / project settings
 * @returns {Object}     – full cost breakdown
 */
function calculateDuctLineItem(row, prices = {}) {
  const {
    size                = '',
    linearFeet          = 0,
    ductMaterial        = 'galvanized',
    ductType            = 'supply',
    fittings            = [],
    insulated           = false,
    internalInsulation  = false,
    flexDuct            = false,
    vd                  = false,
    offtake             = false,
    difficultyFactor    = 1.0,
  } = row;

  // ── Resolve pricing with Excel parameter references ──────────────────────
  const measureScaleFactor  = UNIT_TO_FT[prices.measureUnit] || 1.0;
  const sheetMetalCost      = prices.sheetMetalCostPerLb    != null ? prices.sheetMetalCostPerLb    : SHEET_METAL_COST_PER_LB;
  const laborRatePerFt      = prices.sheetMetalLaborPerFt   != null ? prices.sheetMetalLaborPerFt   : SHEET_METAL_LABOR_RATE;
  const ductWrapLabor       = prices.ductWrapLaborPerFt     != null ? prices.ductWrapLaborPerFt     : DUCT_WRAP_LABOR_COST;
  const insulationPerSqFt   = prices.insulationPerSqFt      != null ? prices.insulationPerSqFt      : DUCT_WRAP_MATERIAL_COST;
  const flexShort           = prices.flexDuctLaborShort     != null ? prices.flexDuctLaborShort     : FLEX_DUCT_LABOR_SHORT;
  const flexLong            = prices.flexDuctLaborLong      != null ? prices.flexDuctLaborLong      : FLEX_DUCT_LABOR_LONG;
  const maxFlexLen          = prices.maxFlexDuctLen         != null ? prices.maxFlexDuctLen         : MAX_FLEX_DUCT_LEN;
  const offtakeCostVal      = prices.offtakeCost            != null ? prices.offtakeCost            : OFFTAKE_COST;
  const vdCostDefault       = prices.vdCost                != null ? prices.vdCost                 : VD_COST;
  const internalUplift      = prices.internalInsulationUplift != null ? prices.internalInsulationUplift : INTERNAL_INSULATION_UPLIFT;
  const sqIncRate           = prices.incidentalsPct         != null ? prices.incidentalsPct         : SQUARE_DUCT_INCIDENTALS_PCT;
  const rdIncRate           = prices.roundDuctIncidentalsPct != null ? prices.roundDuctIncidentalsPct : ROUND_DUCT_INCIDENTALS_PCT;
  const laborRate           = prices.laborRate              != null ? prices.laborRate              : 68.00;

  // ── Geometry ──────────────────────────────────────────────────────────────
  // J4 = $E$2 × D4  (scale factor × sheet measurement)
  const lf          = (Number(linearFeet) || 0) * measureScaleFactor;
  const maxDim      = getMaxDimension(size);
  const shape       = detectShape(size);
  const gauge       = selectGauge(maxDim, shape);

  // N4: flex deduction — only rigid section needs sheet metal estimation
  // Source: =IF(E4="",0, M4*IF(I4="y",MAX(0,J4-$AC$13),J4))
  const rigidLf    = flexDuct ? Math.max(0, lf - maxFlexLen) : lf;
  const surfaceArea = calculateSurfaceArea(size, rigidLf);

  // O4: weight (physics-based)
  const weight      = calculateWeight(surfaceArea, gauge, ductMaterial);
  const laborHours  = calculateLaborHours(surfaceArea, gauge, difficultyFactor);

  // ── Material costs ────────────────────────────────────────────────────────
  // Per-material $/lb override
  const resolvedCostPerLb = (prices.materialCostPerLb && prices.materialCostPerLb[ductMaterial] != null)
    ? prices.materialCostPerLb[ductMaterial]
    : sheetMetalCost;

  // P4/Q4: rectangular → weight × $/lb; round galvanized → price table; round other → weight × $/lb
  const ductMaterialCost = (shape === 'round' && ductMaterial === 'galvanized')
    ? interpolateRoundDuctRate(maxDim) * lf
    : roundToNearest(weight * resolvedCostPerLb, 10);

  // R4: insulation material = N4 × AC7
  const insulationCost = insulated ? surfaceArea * insulationPerSqFt : 0;

  // Internal insulation uplift (AC14)
  const internalInsulationCost = (internalInsulation && ductMaterialCost > 0)
    ? ductMaterialCost * internalUplift : 0;

  // S4: flex duct material — fixed connection cost
  // Source: =IF(I4="x", $AC$13*INDEX($AN$19:$AN$30,MATCH($E4,$AL$19:$AL$30,0),1)*1.25, 0)
  let flexDuctCost      = 0;
  let flexDuctLaborCost = 0;
  if (flexDuct && lf > 0) {
    const flexRatePerFt = lookupFlexDuctRate(maxDim);
    flexDuctCost        = maxFlexLen * flexRatePerFt * 1.25;
    flexDuctLaborCost   = lf > maxFlexLen ? flexLong : flexShort;
  }

  // T4: VD material = vdCost if VD checked AND offtake NOT checked
  // Source: IF(H="x",IF(G="x",0,25),0)
  const vdMaterialCost = (vd && !offtake) ? vdCostDefault : 0;

  // Fittings (website extension — not in base Excel)
  let fittingMaterialCost = 0;
  let fittingLaborHours   = 0;
  for (const fitting of fittings) {
    const multiplier  = FITTING_MULTIPLIERS[fitting.type] || 1.5;
    const fittingArea = calculateSurfaceArea(size, 1) * multiplier;
    fittingMaterialCost += fittingArea * sheetMetalCost * (fitting.qty || 1);
    fittingLaborHours   += fittingArea * (LABOR_FACTOR_BY_GAUGE[gauge] || 0.05) * (fitting.qty || 1);
  }

  // U4/V4: incidentals = SUM(P,R,S,T) × rate
  // Source: SUM(P4,R4,S4,T4) × incidentals rate
  const incidentalsBase  = ductMaterialCost + insulationCost + flexDuctCost + vdMaterialCost;
  const incidentalsRate  = shape === 'round' ? rdIncRate : sqIncRate;
  const incidentalsCost  = Math.round(incidentalsBase * incidentalsRate);

  // W4: Total material = SUM(P:U) — offtake goes to LABOR (X4), not material
  const totalMaterialCost = ductMaterialCost + insulationCost + internalInsulationCost
    + flexDuctCost + vdMaterialCost + incidentalsCost + fittingMaterialCost;

  // ── Labor costs ───────────────────────────────────────────────────────────
  // X4: ROUNDUP(J4×AC9 + IF(insulated, AC8×J4, 0) + IF(offtake, AC12, 0) + IF(vd, 0.5×25, 0), -1)
  // Uses full J4 (entire run length) — not rigidLf
  const sheetMetalLaborRaw = lf * laborRatePerFt;
  const insulationLaborRaw = insulated ? lf * ductWrapLabor : 0;
  const offtakeLaborRaw    = offtake   ? offtakeCostVal : 0;
  const vdLaborRaw         = vd        ? 0.5 * vdCostDefault : 0;
  const fittingLaborCost   = fittingLaborHours * laborRate;

  // Excel ROUNDUP(...,-1) applied to combined base duct labor
  const baseDuctLaborCost = roundUpToNearest(
    sheetMetalLaborRaw + insulationLaborRaw + offtakeLaborRaw + vdLaborRaw, 10,
  );
  const totalLaborHours = laborHours + fittingLaborHours;
  const totalLaborCost  = baseDuctLaborCost + flexDuctLaborCost + fittingLaborCost;

  const totalCost = totalMaterialCost + totalLaborCost;

  const thicknessMm = getThicknessMm(gauge, ductMaterial);

  return {
    size,
    shape,
    gauge,
    ductMaterial,
    ductType,
    thicknessMm,
    linearFeet:            lf,
    rawLinearFeet:         Number(linearFeet) || 0,
    rigidLinearFeet:       rigidLf,
    surfaceArea:           Math.round(surfaceArea          * 100) / 100,
    surfaceAreaWithWaste:  Math.round(surfaceArea          * 100) / 100,  // alias — no waste in Excel N4
    weight:                Math.round(weight               *  10) /  10,
    laborHours:            Math.round(totalLaborHours      *  10) /  10,
    ductMaterialCost:      Math.round(ductMaterialCost     * 100) / 100,
    insulationCost:        Math.round(insulationCost       * 100) / 100,
    internalInsulationCost:Math.round(internalInsulationCost * 100) / 100,
    flexDuctCost:          Math.round(flexDuctCost         * 100) / 100,
    vdCost:                Math.round(vdMaterialCost       * 100) / 100,
    offtakeCost:           Math.round(offtakeLaborRaw      * 100) / 100,
    incidentalsCost:       Math.round(incidentalsCost      * 100) / 100,
    fittingMaterialCost:   Math.round(fittingMaterialCost  * 100) / 100,
    insulationLaborCost:   Math.round(insulationLaborRaw   * 100) / 100,
    flexDuctLaborCost:     Math.round(flexDuctLaborCost    * 100) / 100,
    vdLaborCost:           Math.round(vdLaborRaw           * 100) / 100,
    laborCost:             Math.round(totalLaborCost       * 100) / 100,
    totalMaterialCost:     Math.round(totalMaterialCost    * 100) / 100,
    totalCost:             Math.round(totalCost            * 100) / 100,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH CALCULATOR — receives the full rows array + prices object
// ─────────────────────────────────────────────────────────────────────────────
const ZERO_TOTALS = () => ({
  linearFeet: 0, surfaceArea: 0, weight: 0, laborHours: 0,
  ductMaterialCost: 0, materialCost: 0, laborCost: 0,
  insulationCost: 0, insulationLaborCost: 0, internalInsulationCost: 0,
  incidentalsCost: 0, flexDuctCost: 0, vdCost: 0, offtakeCost: 0, totalCost: 0,
});

function accumulateRow(acc, r) {
  return {
    linearFeet:             acc.linearFeet             + r.linearFeet,
    surfaceArea:            acc.surfaceArea             + r.surfaceArea,
    weight:                 acc.weight                 + r.weight,
    laborHours:             acc.laborHours             + r.laborHours,
    ductMaterialCost:       acc.ductMaterialCost       + r.ductMaterialCost,
    materialCost:           acc.materialCost           + r.totalMaterialCost,
    laborCost:              acc.laborCost              + r.laborCost,
    insulationCost:         acc.insulationCost         + r.insulationCost,
    insulationLaborCost:    acc.insulationLaborCost    + r.insulationLaborCost,
    internalInsulationCost: acc.internalInsulationCost + r.internalInsulationCost,
    incidentalsCost:        acc.incidentalsCost        + r.incidentalsCost,
    flexDuctCost:           acc.flexDuctCost           + r.flexDuctCost,
    vdCost:                 acc.vdCost                 + r.vdCost,
    offtakeCost:            acc.offtakeCost            + r.offtakeCost,
    totalCost:              acc.totalCost              + r.totalCost,
  };
}

function roundTotals(t) {
  const out = {};
  Object.keys(t).forEach((k) => { out[k] = Math.round(t[k] * 100) / 100; });
  return out;
}

/**
 * calcDuctBatch — the entry point called by calculateService.js
 *
 * @param {Array}  rows    – array of row objects (size, linearFeet, flags, etc.)
 * @param {Object} prices  – optional pricing overrides (sheetMetalCostPerLb, etc.)
 * @returns {{ rows, totals, byMaterial }}
 */
function calcDuctBatch(rows, prices = {}) {
  const results = rows.map((row, i) => ({
    id: row.id || `row-${i}`,
    ...row,
    ...calculateDuctLineItem(row, prices),
  }));

  const totals = roundTotals(results.reduce(accumulateRow, ZERO_TOTALS()));

  // Per-material breakdown
  const byMaterial = {};
  for (const r of results) {
    const mat = r.ductMaterial || 'galvanized';
    byMaterial[mat] = accumulateRow(byMaterial[mat] || ZERO_TOTALS(), r);
  }
  Object.keys(byMaterial).forEach((mat) => {
    byMaterial[mat] = roundTotals(byMaterial[mat]);
  });

  return { rows: results, totals, byMaterial };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  calcDuctBatch,
  calculateDuctLineItem,  // exposed for direct use / unit tests
  // Reference data (useful for seeding / admin endpoints)
  DUCT_MATERIAL_OPTIONS,
  FLEX_DUCT_PRICE_TABLE,
  ROUND_DUCT_PRICE_PER_FT,
  GAUGE_THICKNESS_MM,
  LABOR_FACTOR_BY_GAUGE,
  FITTING_MULTIPLIERS,
  // Helpers
  selectGauge,
  detectShape,
  parseSize,
  calculateSurfaceArea,
  getMaxDimension,
  calculateWeight,
  getThicknessMm,
};
