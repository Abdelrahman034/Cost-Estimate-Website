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

// Workbook-aligned round duct pricing table from the Metal duct sheet.
// Excel uses exact MATCH on diameter; we interpolate between known sizes for flexibility.
export const ROUND_DUCT_PRICE_PER_FT = [
  { size: 4, rate: 1.92 },
  { size: 5, rate: 2.08 },
  { size: 6, rate: 2.24 },
  { size: 7, rate: 2.44 },
  { size: 8, rate: 2.64 },
  { size: 9, rate: 2.92 },
  { size: 10, rate: 3.20 },
  { size: 12, rate: 3.92 },
  { size: 14, rate: 4.64 },
  { size: 16, rate: 5.52 },
  { size: 18, rate: 6.60 },
  { size: 20, rate: 8.64 },
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

  const {
    laborRate = 68.00,
    insulationPerSqFt = DUCT_WRAP_MATERIAL_COST,
    sheetMetalCostPerLb,
    sheetMetalLbsPerFt2,
    sheetMetalLaborPerFt,
    ductWrapLaborPerFt,
    flexDuctLaborShort,
    flexDuctLaborLong,
    maxFlexDuctLen,
    offtakeCost,
    vdCost,
    internalInsulationUplift,
    incidentalsPct,
  } = prices;

  // Resolve values with fallbacks to module constants
  const sheetMetalCost = sheetMetalCostPerLb ?? SHEET_METAL_COST_PER_LB;
  // Weight per sqft from settings (matches Excel's sheetMetalLbsPerFt2 field)
  const weightLbsPerSqFt = sheetMetalLbsPerFt2 ?? 1.24967;
  // Labor per linear foot from settings (matches Excel's SHEET_METAL_LABOR_RATE)
  const laborRatePerFt = sheetMetalLaborPerFt ?? SHEET_METAL_LABOR_RATE;
  const ductWrapLabor = ductWrapLaborPerFt ?? DUCT_WRAP_LABOR_COST;
  const flexShort = flexDuctLaborShort ?? FLEX_DUCT_LABOR_SHORT;
  const flexLong = flexDuctLaborLong ?? FLEX_DUCT_LABOR_LONG;
  const maxFlexLen = maxFlexDuctLen ?? MAX_FLEX_DUCT_LEN;
  const offtakeCostDefault = (offtakeCost !== undefined) ? offtakeCost : OFFTAKE_COST;
  const vdCostDefault = (vdCost !== undefined) ? vdCost : VD_COST;
  const internalUplift    = (internalInsulationUplift !== undefined) ? internalInsulationUplift : INTERNAL_INSULATION_UPLIFT;
  // Incidentals % — hangers, sealant, hardware. Matches Excel "20%" header column.
  const incidentalsRate   = (incidentalsPct !== undefined) ? incidentalsPct : 0.20;

  // Core calculations
  const maxDim = getMaxDimension(size);
  const gauge = selectGauge(maxDim);
  const shape = detectShape(size);
  const surfaceArea = calculateSurfaceArea(size, linearFeet);          // base area (no waste)
  const surfaceAreaWithWaste = applyWasteFactor(surfaceArea, wasteFactor); // +waste for display & insulation
  // Weight uses BASE area × lbs/sqft from settings — matches Excel (waste not applied to weight)
  const weight = surfaceArea * weightLbsPerSqFt;
  // Labor hours computed from waste-included area for workforce planning (informational)
  const laborHours = calculateLaborHours(surfaceAreaWithWaste, gauge, difficultyFactor);

  // Material cost:
  //   Round duct  → per-LF price table (no change)
  //   Rect duct   → base_area × lbs/sqft × $/lb, rounded to nearest $10 (matches Excel)
  const ductMaterialCost = shape === 'round'
    ? interpolateRoundDuctRate(getMaxDimension(size)) * Number(linearFeet || 0)
    : roundToNearest(weight * sheetMetalCost, 10);

  // Incidentals: hangers, supports, screws, sealant, tape — % of base duct material
  // Source: Excel "Incidentals ($)" column = ductMaterialCost × 20% (shown in header)
  // Rounded to nearest $1 (not $10) so small values like $14 are preserved
  const incidentalsCost = Math.round(ductMaterialCost * incidentalsRate);

  // Fitting cost
  let fittingMaterialCost = 0;
  let fittingLaborHours = 0;
  for (const fitting of fittings) {
    const multiplier = FITTING_MULTIPLIERS[fitting.type] || 1.5;
    const fittingArea = calculateSurfaceArea(size, 1) * multiplier;
    fittingMaterialCost += fittingArea * sheetMetalCost * (fitting.qty || 1);
    fittingLaborHours += fittingArea * (LABOR_FACTOR_BY_GAUGE[gauge] || 0.05) * (fitting.qty || 1);
  }

  // External insulation (duct wrap)
  let insulationCost = insulated ? surfaceAreaWithWaste * insulationPerSqFt : 0;
  let insulationLaborCost = insulated ? surfaceAreaWithWaste * ductWrapLabor : 0;

  // Internal insulation uplift (40% increase on base duct material)
  let internalInsulationCost = 0;
  if (internalInsulation && ductMaterialCost > 0) {
    internalInsulationCost = ductMaterialCost * internalUplift;
  }

  // Flex duct cost and labor
  let flexDuctCost = 0;
  let flexDuctLaborCost = 0;
  if (flexDuct && Number(linearFeet) > 0) {
    flexDuctCost = Number(linearFeet) * 2.0; // $/ft from workbook flex table
    const isLongRun = Number(linearFeet) > maxFlexLen;
    flexDuctLaborCost = isLongRun ? flexLong : flexShort;
  }

  // VD (Volume Damper) cost
  const vdCostValue = vd ? vdCostDefault : 0;

  // Offtake cost
  const offtakeCostValue = offtake ? offtakeCostDefault : 0;

  // Base duct labor cost: per linear foot rate (matches Excel's SHEET_METAL_LABOR_RATE approach)
  // Rounded to nearest $10 to match workbook rounding pattern
  const baseDuctLaborCost = roundToNearest(Number(linearFeet || 0) * laborRatePerFt, 10);
  // Fitting labor still uses hourly rate (fittings are extras, not covered by per-LF rate)
  const fittingLaborCost = fittingLaborHours * laborRate;
  const totalLaborHours = laborHours + fittingLaborHours;

  // Total material and labor
  const totalMaterialCost = ductMaterialCost + incidentalsCost + fittingMaterialCost + insulationCost + internalInsulationCost + flexDuctCost + vdCostValue + offtakeCostValue;
  const totalLaborCost = baseDuctLaborCost + fittingLaborCost + insulationLaborCost + flexDuctLaborCost;
  const totalCost = totalMaterialCost + totalLaborCost;

  return {
    size,
    shape,
    gauge,
    linearFeet: Number(linearFeet),
    surfaceArea: Math.round(surfaceArea * 100) / 100,
    surfaceAreaWithWaste: Math.round(surfaceAreaWithWaste * 100) / 100,
    weight: Math.round(weight * 10) / 10,         // base area × lbs/sqft (matches Excel)
    laborHours: Math.round(totalLaborHours * 10) / 10, // for workforce planning display
    ductMaterialCost: Math.round(ductMaterialCost * 100) / 100,
    incidentalsCost: Math.round(incidentalsCost * 100) / 100,
    internalInsulationCost: Math.round(internalInsulationCost * 100) / 100,
    flexDuctCost: Math.round(flexDuctCost * 100) / 100,
    vdCost: Math.round(vdCostValue * 100) / 100,
    offtakeCost: Math.round(offtakeCostValue * 100) / 100,
    fittingMaterialCost: Math.round(fittingMaterialCost * 100) / 100,
    insulationCost: Math.round(insulationCost * 100) / 100,
    insulationLaborCost: Math.round(insulationLaborCost * 100) / 100,
    flexDuctLaborCost: Math.round(flexDuctLaborCost * 100) / 100,
    laborCost: Math.round(totalLaborCost * 100) / 100,
    totalMaterialCost: Math.round(totalMaterialCost * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
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
