/**
 * HVAC Duct Calculation Engine
 * Ported from Excel workbook (Metal Duct sheet)
 * All formulas preserve the original Excel logic
 */

// ─── GAUGE SELECTION ────────────────────────────────────────────────────────
// Source: Metal Duct sheet gauge selection logic (SMACNA standard)
// IF(OR(C9<=12),26, IF(OR(C9<=30),24, IF(OR(C9<=42),22, IF(OR(C9<=60),20,18))))

export function selectGauge(maxDimension) {
  const d = Number(maxDimension);
  if (d <= 12) return 26;
  if (d <= 30) return 24;
  if (d <= 42) return 22;
  if (d <= 60) return 20;
  return 18;
}

// ─── GAUGE WEIGHT (from Ahmed Square Duct and Ahmed Round Duct tabs) ──────────
// Weight per area (kg/m2) for different gauges - Galvanized Steel
// Source: Ahmed Sheet calculations in workbook
export const WEIGHT_PER_AREA_BY_GAUGE = {
  22: 6.86,  // kg/m2, thickness: 0.8534 mm
  24: 5.64,  // kg/m2, thickness: 0.701 mm
  26: 4.42,  // kg/m2, thickness: 0.5512 mm
  28: 3.81,  // kg/m2, thickness: 0.475 mm (round duct)
};

// Legacy constant for backward compatibility (lbs/sqft)
export const GAUGE_WEIGHT = {
  26: 0.906,
  24: 1.156,
  22: 1.406,
  20: 1.656,
  18: 2.156,
};

// Round duct pricing table — extracted directly from Excel Metal Duct sheet (AP column, data_only).
// Formula: AP = AO × (1 + AP3_buffer=0.5), where AO = AM/3 + AN/5 (3-ft and 5-ft raw costs).
// Excel uses exact MATCH on diameter; we interpolate between known sizes for flexibility.
export const ROUND_DUCT_PRICE_PER_FT = [
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

export const SHEET_METAL_COST_PER_LB = 4.0;

// Workbook labor and cost constants
export const SHEET_METAL_LABOR_RATE = 23.0; // $/ft
export const DUCT_WRAP_LABOR_COST = 4.0; // $/ft (insulation labor)
export const DUCT_WRAP_MATERIAL_COST = 1.25; // $/ft2
export const FLEX_DUCT_LABOR_SHORT = 40.0; // $/run (length <= 5 ft)
export const FLEX_DUCT_LABOR_LONG = 80.0; // $/run (length > 5 ft)
export const MAX_FLEX_DUCT_LEN = 5.0; // Ft
export const OFFTAKE_COST = 20.0; // $/run
export const VD_COST = 25.0; // $/run (Volume Damper)
export const INTERNAL_INSULATION_UPLIFT = 0.40; // 40% cost increase for internal insulation

function roundToNearest(value, step = 10) {
  return Math.round(value / step) * step;
}

// Excel uses ROUNDUP (not ROUND) for labor: =ROUNDUP(labor_sum, -1)
function roundUpToNearest(value, step = 10) {
  return Math.ceil(value / step) * step;
}

// Square duct incidentals = 20% (U2 in Excel)
// Round  duct incidentals = 25% (V2 in Excel) — different rate
export const SQUARE_DUCT_INCIDENTALS_PCT = 0.20;
export const ROUND_DUCT_INCIDENTALS_PCT  = 0.25;

function interpolateRoundDuctRate(size) {
  const d = Number(size);
  if (!Number.isFinite(d) || d <= 0) return 0;

  const exact = ROUND_DUCT_PRICE_PER_FT.find((entry) => entry.size === d);
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
// Source: =IF(ISERROR(FIND("*",$E4)),"x","")  → round if no "*", rect if "*"
export function detectShape(sizeString) {
  if (!sizeString) return null;
  return sizeString.includes('x') || sizeString.includes('X') || sizeString.includes('*')
    ? 'rectangular'
    : 'round';
}

// Normalize size notation: "24x12", "24X12", "24*12" → { width: 24, height: 12 }
export function parseSize(sizeString) {
  if (!sizeString) return null;
  const s = sizeString.trim().toLowerCase();

  // Round duct: "12", "12rd", "12r", "12 rd"
  if (!s.includes('x') && !s.includes('*')) {
    const d = parseFloat(s);
    if (!isNaN(d)) return { type: 'round', diameter: d };
  }

  // Rectangular duct: "24x12", "24*12"
  const parts = s.split(/[x*]/);
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (!isNaN(w) && !isNaN(h)) return { type: 'rectangular', width: w, height: h };
  }

  return null;
}

// ─── SURFACE AREA CALCULATION ─────────────────────────────────────────────────
// Source: Metal Duct sheet surface area formula
// Round:       A = π × d × L / 144        (convert to sqft)
// Rectangular: A = 2(W + H) × L / 144     (convert to sqft)

export function calculateSurfaceArea(sizeString, linearFeet) {
  const parsed = parseSize(sizeString);
  if (!parsed) return 0;

  const lf = Number(linearFeet) || 0;

  if (parsed.type === 'round') {
    // π × diameter(in) × length(in) / 144
    return (Math.PI * parsed.diameter * lf * 12) / 144;
  }

  if (parsed.type === 'rectangular') {
    // 2 × (W + H) inches × length(in) / 144
    return (2 * (parsed.width + parsed.height) * lf * 12) / 144;
  }

  return 0;
}

// ─── MAX DIMENSION (for gauge selection) ──────────────────────────────────────
export function getMaxDimension(sizeString) {
  const parsed = parseSize(sizeString);
  if (!parsed) return 0;
  if (parsed.type === 'round') return parsed.diameter;
  return Math.max(parsed.width, parsed.height);
}

// ─── WASTE FACTOR ─────────────────────────────────────────────────────────────
// Source: =K4*(1+$L$2)  — standard 10% fabrication waste
export const DEFAULT_WASTE_FACTOR = 0.10;

export function applyWasteFactor(quantity, wasteFactor = DEFAULT_WASTE_FACTOR) {
  return quantity * (1 + wasteFactor);
}

// ─── WEIGHT CALCULATION ───────────────────────────────────────────────────────
// Source: Ahmed Square Duct and Ahmed Round Duct tabs (weight/area formula)
// Weight (kg) = Area (m²) × Weight/Area (kg/m²)
export function calculateWeight(surfaceAreaSqFt, gauge) {
  // Get weight per area (kg/m²) from Ahmed sheets based on gauge
  const weightPerAreaKgM2 = WEIGHT_PER_AREA_BY_GAUGE[gauge] || WEIGHT_PER_AREA_BY_GAUGE[26];
  
  // Convert surface area from sqft to m² (1 sqft = 0.092903 m²)
  const surfaceAreaM2 = surfaceAreaSqFt * 0.092903;
  
  // Calculate weight in kg: Area(m²) × Weight/Area(kg/m²)
  const weightKg = surfaceAreaM2 * weightPerAreaKgM2;
  
  // Convert to lbs for backward compatibility (1 kg = 2.20462 lbs)
  return weightKg * 2.20462;
}

// ─── LABOR HOURS ──────────────────────────────────────────────────────────────
// Labor factors (hours per sqft) by gauge — from workbook production rates
export const LABOR_FACTOR_BY_GAUGE = {
  26: 0.045,
  24: 0.050,
  22: 0.058,
  20: 0.068,
  18: 0.082,
};

export function calculateLaborHours(surfaceAreaSqFt, gauge, difficultyFactor = 1.0) {
  const factor = LABOR_FACTOR_BY_GAUGE[gauge] || 0.05;
  return surfaceAreaSqFt * factor * difficultyFactor;
}

// ─── FITTING ALLOWANCE ────────────────────────────────────────────────────────
// Source: Multipliers from workbook fitting tables
export const FITTING_MULTIPLIERS = {
  elbow: 1.8,
  tee: 2.2,
  reducer: 1.4,
  offset: 1.6,
  transition: 1.5,
  cap: 0.5,
};

// ─── FULL DUCT LINE ITEM CALCULATION ─────────────────────────────────────────
/**
 * Calculate all costs for a single duct run
 * @param {Object} row - { size, linearFeet, ductType, fittings, insulated, internalInsulation, flexDuct, vd, offtake, difficultyFactor, wasteFactor }
 * @param {Object} prices - { sheetMetalCostPerLb, laborRate, insulationPerSqFt, ... }
 * @returns {Object} Full cost breakdown
 */
export function calculateDuctLineItem(row, prices = {}) {
  const {
    size = '',
    linearFeet = 0,
    ductType = 'supply',
    fittings = [],
    insulated = false,
    internalInsulation = false,
    flexDuct = false,
    vd = false,
    offtake = false,
    difficultyFactor = 1.0,
    wasteFactor = DEFAULT_WASTE_FACTOR,
  } = row;

  // ── Resolve every setting with its exact Excel parameter reference ──────────
  const {
    laborRate              = 68.00,                      // $/hr — for fitting labor only
    insulationPerSqFt      = DUCT_WRAP_MATERIAL_COST,    // AC7  = 1.25 $/ft²
    sheetMetalCostPerLb,                                 // AC6  = 4.00 $/lb
    sheetMetalLbsPerFt2,                                 // AC5  = 1.24967 lbs/ft²
    sheetMetalLaborPerFt,                                // AC9  = 23 $/LF
    ductWrapLaborPerFt,                                  // AC8  = 4 $/LF
    flexDuctLaborShort,                                  // AC10 = 40 $/run
    flexDuctLaborLong,                                   // AC11 = 80 $/run
    maxFlexDuctLen,                                      // AC13 = 5 ft
    offtakeCost,                                         // AC12 = 20 $/run  (goes to LABOR, not material)
    vdCost,                                              // T4   = 25 $/each (material); 0.5× goes to labor
    internalInsulationUplift,                            // AC14 = 0.40 (40 %)
    incidentalsPct,                                      // U2   = 0.20 — square duct
    roundDuctIncidentalsPct,                             // V2   = 0.25 — round duct
  } = prices;

  // ── Scale factor (mirrors Excel E2 "Scale - Ft/Unit") ───────────────────
  // User may type measurements in mm, inches, or any drawing unit.
  // measureScaleFactor converts that raw value to actual feet.
  // Default 1.0 = user is already entering feet (backward-compatible).
  const measureScaleFactor = (prices.measureScaleFactor != null && prices.measureScaleFactor > 0)
    ? prices.measureScaleFactor
    : 1.0;

  const sheetMetalCost   = sheetMetalCostPerLb    ?? SHEET_METAL_COST_PER_LB;   // AC6
  const weightLbsPerSqFt = sheetMetalLbsPerFt2    ?? 1.24967;                   // AC5
  const laborRatePerFt   = sheetMetalLaborPerFt   ?? SHEET_METAL_LABOR_RATE;    // AC9
  const ductWrapLabor    = ductWrapLaborPerFt      ?? DUCT_WRAP_LABOR_COST;      // AC8
  const flexShort        = flexDuctLaborShort      ?? FLEX_DUCT_LABOR_SHORT;     // AC10
  const flexLong         = flexDuctLaborLong       ?? FLEX_DUCT_LABOR_LONG;      // AC11
  const maxFlexLen       = maxFlexDuctLen          ?? MAX_FLEX_DUCT_LEN;         // AC13
  const offtakeCostVal   = offtakeCost             !== undefined ? offtakeCost             : OFFTAKE_COST;           // AC12
  const vdCostDefault    = vdCost                  !== undefined ? vdCost                  : VD_COST;
  const internalUplift   = internalInsulationUplift !== undefined ? internalInsulationUplift : INTERNAL_INSULATION_UPLIFT; // AC14
  const sqIncRate        = incidentalsPct           !== undefined ? incidentalsPct           : SQUARE_DUCT_INCIDENTALS_PCT; // U2
  const rdIncRate        = roundDuctIncidentalsPct  !== undefined ? roundDuctIncidentalsPct  : ROUND_DUCT_INCIDENTALS_PCT;  // V2

  // ── Core geometry ────────────────────────────────────────────────────────
  // Apply scale factor: converts user's raw input (mm, in, custom unit…) → actual feet
  // Mirrors Excel: J4 = $E$2 × D4  (Calc. Length = Scale × Sheet Measurement)
  const lf               = (Number(linearFeet) || 0) * measureScaleFactor;
  const maxDim           = getMaxDimension(size);
  const gauge            = selectGauge(maxDim);
  const shape            = detectShape(size);

  // N4: Excel uses J4 directly for area — NO waste factor.
  // When flex is checked (I4="y"): area = M4 × MAX(0, J4 - AC13)
  //   → the flex portion is pre-fab tubing; only the rigid sheet metal section is estimated.
  // When no flex: area = M4 × J4
  // Source: =IF(E4="",0, M4*IF(I4="y",MAX(0,J4-$AC$13),J4))
  const rigidLf          = flexDuct ? Math.max(0, lf - maxFlexLen) : lf;
  const surfaceArea      = calculateSurfaceArea(size, rigidLf);   // sheet metal area only (N4)

  // O4: weight = AC5 × N4  (lbs/ft² × base area, no waste)
  const weight           = surfaceArea * weightLbsPerSqFt;
  // Labor hours: informational / workforce planning (not used for $ cost)
  const laborHours       = calculateLaborHours(surfaceArea, gauge, difficultyFactor);

  // ── Material costs ───────────────────────────────────────────────────────
  // P4: square duct material = ROUND(weight × $/lb, -1)
  // Q4: round duct material  = price_table(diameter) × LF
  const ductMaterialCost = shape === 'round'
    ? interpolateRoundDuctRate(maxDim) * lf
    : roundToNearest(weight * sheetMetalCost, 10);

  // R4: insulation material = N4 × AC7  (base area × $/ft², NOT waste-included)
  const insulationCost = insulated ? surfaceArea * insulationPerSqFt : 0;

  // Internal insulation uplift (AC14): uplift on base duct material cost (website extension)
  const internalInsulationCost = (internalInsulation && ductMaterialCost > 0)
    ? ductMaterialCost * internalUplift : 0;

  // S4: flex duct material — costed on the flex portion length (min of lf and maxFlexLen)
  // Labor for flex is a fixed $/run charge (AC10 short / AC11 long) based on total run length
  let flexDuctCost      = 0;
  let flexDuctLaborCost = 0;
  if (flexDuct && lf > 0) {
    const flexLf      = Math.min(lf, maxFlexLen);   // flex material up to AC13 ft
    flexDuctCost      = flexLf * 2.0;               // $2/ft flex tubing material
    flexDuctLaborCost = lf > maxFlexLen ? flexLong : flexShort;  // AC10/AC11
  }

  // T4: VD material = 25 if VD checked AND offtake NOT checked (Excel: IF(H="x",IF(G="x",0,25),0))
  const vdMaterialCost = (vd && !offtake) ? vdCostDefault : 0;

  // Fittings (website extension — not in base Excel)
  let fittingMaterialCost = 0;
  let fittingLaborHours   = 0;
  for (const fitting of fittings) {
    const multiplier   = FITTING_MULTIPLIERS[fitting.type] || 1.5;
    const fittingArea  = calculateSurfaceArea(size, 1) * multiplier;
    fittingMaterialCost += fittingArea * sheetMetalCost * (fitting.qty || 1);
    fittingLaborHours   += fittingArea * (LABOR_FACTOR_BY_GAUGE[gauge] || 0.05) * (fitting.qty || 1);
  }

  // U4 (square) / V4 (round): incidentals = SUM(P,R,S,T) × rate
  // Base = duct material + insulation + flex + VD material (same as Excel SUM(P4,R4,S4,T4))
  const incidentalsBase = ductMaterialCost + insulationCost + flexDuctCost + vdMaterialCost;
  const incidentalsRate = shape === 'round' ? rdIncRate : sqIncRate;
  const incidentalsCost = Math.round(incidentalsBase * incidentalsRate);

  // W4: Total material = SUM(P:U) — offtake is NOT in material (it goes to labor per Excel X4)
  const totalMaterialCost = ductMaterialCost + insulationCost + internalInsulationCost
    + flexDuctCost + vdMaterialCost + incidentalsCost + fittingMaterialCost;

  // ── Labor costs ──────────────────────────────────────────────────────────
  // X4: ROUNDUP(J4×AC9 + IF(insulated, AC8×J4, 0) + IF(offtake, AC12, 0) + IF(vd, 0.5×25, 0), -1)
  // Labor uses FULL J4 (entire run length) — not the flex-deducted rigidLf.
  // Hanging, sealing, and installing labour covers the whole run regardless of flex portion.
  const sheetMetalLaborRaw  = lf * laborRatePerFt;                        // J4 × AC9 (full run)
  const insulationLaborRaw  = insulated ? lf * ductWrapLabor : 0;          // AC8 × J4 (full run)
  const offtakeLaborRaw     = offtake   ? offtakeCostVal : 0;              // AC12 in labor
  const vdLaborRaw          = vd        ? 0.5 * vdCostDefault : 0;        // 0.5 × 25 in labor
  const fittingLaborCost    = fittingLaborHours * laborRate;               // extra for fittings

  // Excel ROUNDUP(...,-1) applied to the combined duct labor before adding flex+fittings
  const baseDuctLaborCost = roundUpToNearest(
    sheetMetalLaborRaw + insulationLaborRaw + offtakeLaborRaw + vdLaborRaw, 10
  );
  const totalLaborHours = laborHours + fittingLaborHours;
  const totalLaborCost  = baseDuctLaborCost + flexDuctLaborCost + fittingLaborCost;

  const totalCost = totalMaterialCost + totalLaborCost;

  return {
    size,
    shape,
    gauge,
    linearFeet: lf,                                           // actual feet (after scale)
    rawLinearFeet: Number(linearFeet) || 0,                   // what the user typed
    rigidLinearFeet:      rigidLf,
    surfaceArea:          Math.round(surfaceArea          * 100) / 100,
    surfaceAreaWithWaste: Math.round(surfaceArea          * 100) / 100,  // alias — no waste in Excel N4
    weight:               Math.round(weight               *  10) /  10,
    laborHours:           Math.round(totalLaborHours      *  10) /  10,
    ductMaterialCost:        Math.round(ductMaterialCost        * 100) / 100,
    insulationCost:          Math.round(insulationCost          * 100) / 100,
    internalInsulationCost:  Math.round(internalInsulationCost  * 100) / 100,
    flexDuctCost:            Math.round(flexDuctCost            * 100) / 100,
    vdCost:                  Math.round(vdMaterialCost          * 100) / 100,
    offtakeCost:             Math.round(offtakeLaborRaw         * 100) / 100,
    incidentalsCost:         Math.round(incidentalsCost         * 100) / 100,
    fittingMaterialCost:     Math.round(fittingMaterialCost     * 100) / 100,
    insulationLaborCost:     Math.round(insulationLaborRaw      * 100) / 100,
    flexDuctLaborCost:       Math.round(flexDuctLaborCost       * 100) / 100,
    vdLaborCost:             Math.round(vdLaborRaw              * 100) / 100,
    laborCost:               Math.round(totalLaborCost          * 100) / 100,
    totalMaterialCost:       Math.round(totalMaterialCost       * 100) / 100,
    totalCost:               Math.round(totalCost               * 100) / 100,
  };
}

// ─── BATCH CALCULATION ────────────────────────────────────────────────────────
export function calculateDuctBatch(rows, prices = {}) {
  const results = rows.map((row, i) => ({
    id: row.id || `row-${i}`,
    ...row,
    ...calculateDuctLineItem(row, prices),
  }));

  const totals = results.reduce(
    (acc, r) => ({
      linearFeet: acc.linearFeet + r.linearFeet,
      surfaceArea: acc.surfaceArea + r.surfaceArea,
      weight: acc.weight + r.weight,
      laborHours: acc.laborHours + r.laborHours,
      materialCost: acc.materialCost + r.totalMaterialCost,
      laborCost: acc.laborCost + r.laborCost,
      insulationCost: acc.insulationCost + r.insulationCost,
      internalInsulationCost: acc.internalInsulationCost + r.internalInsulationCost,
      incidentalsCost: acc.incidentalsCost + r.incidentalsCost,
      flexDuctCost: acc.flexDuctCost + r.flexDuctCost,
      vdCost: acc.vdCost + r.vdCost,
      offtakeCost: acc.offtakeCost + r.offtakeCost,
      totalCost: acc.totalCost + r.totalCost,
    }),
    {
      linearFeet: 0,
      surfaceArea: 0,
      weight: 0,
      laborHours: 0,
      materialCost: 0,
      laborCost: 0,
      insulationCost: 0,
      internalInsulationCost: 0,
      incidentalsCost: 0,
      flexDuctCost: 0,
      vdCost: 0,
      offtakeCost: 0,
      totalCost: 0,
    }
  );

  // Round all totals
  Object.keys(totals).forEach((k) => {
    totals[k] = Math.round(totals[k] * 100) / 100;
  });

  return { rows: results, totals };
}

// ─── OVERHEAD & MARGIN ────────────────────────────────────────────────────────
// Source: OverheadCalculator sheet
export function applyOverheadAndMargin(directCost, overheadPct = 0.15, profitPct = 0.10) {
  const overhead = directCost * overheadPct;
  const subtotal = directCost + overhead;
  const profit = subtotal * profitPct;
  const total = subtotal + profit;
  return {
    directCost: Math.round(directCost * 100) / 100,
    overhead: Math.round(overhead * 100) / 100,
    subtotal: Math.round(subtotal * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// ─── SUMMARY ROLL-UP ─────────────────────────────────────────────────────────
// Source: Summary sheet formula: =ROUND(D23*($H$29)+E23*($H$30),-1)
// Final Cost = Labor Cost + Material Cost (rounded to nearest 10)
export function rollUpSummary(modules) {
  const total = modules.reduce(
    (acc, m) => ({
      materialCost: acc.materialCost + (m.materialCost || 0),
      laborCost: acc.laborCost + (m.laborCost || 0),
      laborHours: acc.laborHours + (m.laborHours || 0),
    }),
    { materialCost: 0, laborCost: 0, laborHours: 0 }
  );

  const directCost = total.materialCost + total.laborCost;
  // Round to nearest 10 (as per Excel formula)
  const rounded = Math.round(directCost / 10) * 10;

  return {
    ...total,
    directCost: rounded,
    modules,
  };
}
