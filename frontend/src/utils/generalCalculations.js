/**
 * General Items Calculation Engine
 * Ported from Excel workbook — "General" sheet
 *
 * Each section is an independent calculator that produces:
 *   { baseCost, incCost, totalCost, [section-specific fields] }
 *
 * All section results roll up into the summary table (rows 4-14 in Excel).
 *
 * Cross-module inputs required (from project context or manual entry):
 *   directJobCost        — sum of all mat+labor from scheduling modules  (Permitting)
 *   scheduleLaborCost    — sum of labor from scheduling modules ONLY      (Logistics, Travel)
 *                          Excel: SUM(Summary!E11,E12,E13,E14,E15,E17,E18)
 *   totalLaborCost       — grand total labor incl. general items          (Rentals)
 *                          Excel: Summary!E23
 *                          In practice falls back to scheduleLaborCost if not provided.
 *   totalTons            — total installed cooling capacity (tons)        (Warranty)
 *   totalUnits           — total installed units count                    (Warranty)
 *   grillCount           — total diffusers/grills count                   (Air Balance)
 */

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function r2(n) { return Math.round(n * 100) / 100; }
function r0(n) { return Math.round(n); }

/**
 * Excel-style FLOOR MATCH — returns value at largest breakpoint ≤ lookup.
 * table: [[threshold, value], ...]
 */
function floorMatch(table, lookup) {
  const t = Number(lookup) || 0;
  const sorted = [...table].sort((a, b) => a[0] - b[0]);
  let result = sorted[0][1];
  for (const [threshold, value] of sorted) {
    if (t >= threshold) result = value;
    else break;
  }
  return result;
}

// ─── DEFAULTS ────────────────────────────────────────────────────────────────

export const DEFAULTS = {
  permitting: {
    required:         'Yes',
    incRate:          0.10,        // 10%
    minBaseCost:      175,         // $175 floor
    basePct:          0.005,       // 0.5% of direct job cost
  },
  fieldLogistics: {
    required:         'Yes',
    logisticsRate:    0.06,        // 6% of labor (=$45k/$750k — H27/H29)
    incRate:          0,
  },
  craneNew: {
    required:         'No',
    liftedUnitCount:  0,
    extraLiftDays:    0,
    sizeCategory:     'Small',     // Small | Med | Large | Max
    unitsPerDay:      8,           // max lifts per day
    incRate:          0,
  },
  demolition: {
    required:         'No',
    splitsToDemoCount:     0,
    rtusToDemoCount:       0,
    cranedUnitCount:       0,
    xlDuctRuns:            0,
    lDuctRuns:             0,
    mDuctRuns:             0,
    sDuctRuns:             0,
    partialDuctDiscount:   0,      // fraction, e.g. 0.10 = 10% discount
    incRate:               0,
  },
  rentals: {
    required:         'Yes',
    incRate:          0,
  },
  airBalance: {
    required:         'Yes',
    mercuryProvided:  'No',
    systemsToBalance: 0,
    perSystemRate:    450,         // $450/system
    perGrillRate:     45,          // $45/grill
    mercuryDivisor:   3,           // ÷3 when Mercury provides balancing
    incRate:          0,
  },
  warranty: {
    required:         'Yes',
    perTonRate:       10,          // $10/ton
    perUnitRate:      50,          // $50/unit
    incRate:          0,
  },
  teamTravel: {
    required:         'No',
    perDiemRate:      0.15,        // 15% of labor
    accommodationRate:0.20,        // 20% of labor
    incRate:          0,
  },
};

// ─── REFERENCE TABLES ────────────────────────────────────────────────────────

/**
 * Crane table — source: Excel G37:J40
 * category → { desc, craneSize, pricePerDay }
 */
export const CRANE_TABLE = [
  { category: 'Small', desc: '<= 5 ton',       craneSize: 19,  pricePerDay: 750  },
  { category: 'Med',   desc: '<= 10 ton',      craneSize: 40,  pricePerDay: 1500 },
  { category: 'Large', desc: '<= 25 ton',      craneSize: 80,  pricePerDay: 3500 },
  { category: 'Max',   desc: '> 25 ton/chiller', craneSize: 120, pricePerDay: 4500 },
];

/**
 * Duct demo price table — source: Excel G52:I55
 * size → pricePerRun
 */
export const DUCT_DEMO_TABLE = {
  xl: 1200,  // > 25 ton
  l:   800,  // 10–25 ton
  m:   600,  // 5–10 ton
  s:   400,  // < 5 ton
};

/**
 * Rentals lookup table — source: Excel G73:L78
 * FLOOR MATCH on labor cost → staff, lift counts, lift costs
 * Columns: [laborThreshold, staff, scissorLifts, matLifts, scissorCost$, matLiftCost$]
 */
export const RENTALS_TABLE = [
  { threshold:      0, staff:  2, scissorLifts: 1, matLifts: 1, scissorCost:  1500, matLiftCost:   900 },
  { threshold:  18000, staff:  3, scissorLifts: 1, matLifts: 1, scissorCost:  2000, matLiftCost:  1250 },
  { threshold:  72000, staff:  3, scissorLifts: 1, matLifts: 1, scissorCost:  3500, matLiftCost:  2300 },
  { threshold: 144000, staff:  6, scissorLifts: 2, matLifts: 2, scissorCost:  7000, matLiftCost:  4600 },
  { threshold: 288000, staff:  9, scissorLifts: 3, matLifts: 3, scissorCost: 10500, matLiftCost:  6900 },
  { threshold: 432000, staff: 12, scissorLifts: 4, matLifts: 4, scissorCost: 20000, matLiftCost: 13400 },
];

// ─── SECTION CALCULATORS ─────────────────────────────────────────────────────

/**
 * 1. PERMITTING
 * Excel rows 16-23
 * Base = MAX(directJobCost × 0.5%, $175)
 * Inc  = Base × incRate
 * Total = Base + Inc
 */
export function calcPermitting({ required, directJobCost, incRate, basePct, minBaseCost } = {}) {
  const req    = (required ?? DEFAULTS.permitting.required) === 'Yes';
  const cost   = Number(directJobCost) || 0;
  const rate   = Number(incRate   ?? DEFAULTS.permitting.incRate);
  const pct    = Number(basePct   ?? DEFAULTS.permitting.basePct);
  const floor  = Number(minBaseCost ?? DEFAULTS.permitting.minBaseCost);

  if (!req) return { required: 'No', directJobCost: cost, baseCost: 0, incCost: 0, totalCost: 0 };

  const baseCost = r2(Math.max(cost * pct, floor));
  const incCost  = r2(baseCost * rate);
  const totalCost = r2(baseCost + incCost);

  return { required: 'Yes', directJobCost: cost, basePct: pct, minBaseCost: floor, baseCost, incRate: rate, incCost, totalCost };
}

/**
 * 2. FIELD LOGISTICS
 * Excel rows 25-33
 * Rate = 6% (derived from reference table: $45k / $750k labor est)
 * Base = Labor Total × Rate
 */
export function calcFieldLogistics({ required, totalLaborCost, logisticsRate, incRate } = {}) {
  const req  = (required ?? DEFAULTS.fieldLogistics.required) === 'Yes';
  const lab  = Number(totalLaborCost) || 0;
  const rate = Number(logisticsRate ?? DEFAULTS.fieldLogistics.logisticsRate);
  const ir   = Number(incRate ?? DEFAULTS.fieldLogistics.incRate);

  if (!req) return { required: 'No', totalLaborCost: lab, baseCost: 0, incCost: 0, totalCost: 0 };

  const baseCost  = r2(lab * rate);
  const incCost   = r2(baseCost * ir);
  const totalCost = r2(baseCost + incCost);

  return { required: 'Yes', totalLaborCost: lab, logisticsRate: rate, baseCost, incRate: ir, incCost, totalCost };
}

/**
 * 3. CRANE SERVICE — NEW UNITS
 * Excel rows 35-48
 * Days = ROUNDUP(liftedCount / 8, 0) + extraDays
 * Base = IF(required, pricePerDay × days, 0)
 */
export function calcCraneNew({ required, liftedUnitCount, extraLiftDays, sizeCategory, unitsPerDay, incRate } = {}) {
  const req   = (required ?? DEFAULTS.craneNew.required).toLowerCase() === 'yes';
  const count = Number(liftedUnitCount ?? DEFAULTS.craneNew.liftedUnitCount);
  const extra = Number(extraLiftDays   ?? DEFAULTS.craneNew.extraLiftDays);
  const upd   = Number(unitsPerDay     ?? DEFAULTS.craneNew.unitsPerDay);
  const ir    = Number(incRate         ?? DEFAULTS.craneNew.incRate);
  const cat   = sizeCategory ?? DEFAULTS.craneNew.sizeCategory;

  const crane   = CRANE_TABLE.find(c => c.category === cat) ?? CRANE_TABLE[0];
  const days    = req ? Math.ceil(count / upd) + extra : 0;
  const baseCost  = req ? r2(crane.pricePerDay * days) : 0;
  const incCost   = r2(baseCost * ir);
  const totalCost = r2(baseCost + incCost);

  return {
    required: req ? 'Yes' : 'No',
    liftedUnitCount: count, extraLiftDays: extra,
    sizeCategory: cat,
    craneDesc: crane.desc, craneSize: crane.craneSize, cranePricePerDay: crane.pricePerDay,
    daysRequired: days,
    baseCost, incRate: ir, incCost, totalCost,
  };
}

/**
 * 4. DEMOLITION
 * Excel rows 50-68
 * Unit Demo = RTUs×$400 + Splits×$600 + crane surcharge
 * Duct Demo = SUMPRODUCT(counts × prices) × (1 - discount)
 * Base = IF(required, unit_demo + duct_demo_net, 0)
 */
export function calcDemolition({
  required, splitsToDemoCount, rtusToDemoCount, cranedUnitCount,
  xlDuctRuns, lDuctRuns, mDuctRuns, sDuctRuns,
  partialDuctDiscount, incRate,
} = {}) {
  const req      = (required ?? DEFAULTS.demolition.required).toLowerCase() === 'yes';
  const splits   = Number(splitsToDemoCount    ?? DEFAULTS.demolition.splitsToDemoCount);
  const rtus     = Number(rtusToDemoCount      ?? DEFAULTS.demolition.rtusToDemoCount);
  const craned   = Number(cranedUnitCount      ?? DEFAULTS.demolition.cranedUnitCount);
  const xl       = Number(xlDuctRuns           ?? DEFAULTS.demolition.xlDuctRuns);
  const l        = Number(lDuctRuns            ?? DEFAULTS.demolition.lDuctRuns);
  const m        = Number(mDuctRuns            ?? DEFAULTS.demolition.mDuctRuns);
  const s        = Number(sDuctRuns            ?? DEFAULTS.demolition.sDuctRuns);
  const discount = Number(partialDuctDiscount  ?? DEFAULTS.demolition.partialDuctDiscount);
  const ir       = Number(incRate              ?? DEFAULTS.demolition.incRate);

  // Unit demo cost: RTU×400 + Split×600 + crane surcharge
  // Excel D61: =D54*400+D53*600+IF(D56=0,0,IF(D56>5,1500,800))
  const craneSurcharge = craned === 0 ? 0 : craned > 5 ? 1500 : 800;
  const unitDemoCost   = r2(rtus * 400 + splits * 600 + craneSurcharge);

  // Duct demo: SUMPRODUCT
  const ductDemoCost = r2(xl * DUCT_DEMO_TABLE.xl + l * DUCT_DEMO_TABLE.l + m * DUCT_DEMO_TABLE.m + s * DUCT_DEMO_TABLE.s);
  const ductDemoNet  = r2(ductDemoCost * (1 - discount));

  const baseCost  = req ? r2(unitDemoCost + ductDemoNet) : 0;
  const incCost   = r2(baseCost * ir);
  const totalCost = r2(baseCost + incCost);

  return {
    required: req ? 'Yes' : 'No',
    splits, rtus, craned, xl, l, m, s, discount,
    craneSurcharge, unitDemoCost, ductDemoCost, ductDemoNet,
    baseCost, incRate: ir, incCost, totalCost,
  };
}

/**
 * 5. RENTALS
 * Excel rows 70-82
 * Uses FLOOR MATCH on labor cost → scissor lift $ + material lift $
 */
export function calcRentals({ required, totalLaborCost, incRate } = {}) {
  const req = (required ?? DEFAULTS.rentals.required) === 'Yes';
  const lab = Number(totalLaborCost) || 0;
  const ir  = Number(incRate ?? DEFAULTS.rentals.incRate);

  // FLOOR MATCH on labor against RENTALS_TABLE
  const row = floorMatch(
    RENTALS_TABLE.map(r => [r.threshold, r]),
    lab,
  );

  const scissorCost  = row.scissorCost;
  const matLiftCost  = row.matLiftCost;
  const baseCost     = req ? r2(scissorCost + matLiftCost) : 0;
  const incCost      = r2(baseCost * ir);
  const totalCost    = r2(baseCost + incCost);

  return {
    required: req ? 'Yes' : 'No',
    totalLaborCost: lab,
    estimatedStaff:  row.staff,
    scissorLiftCount: row.scissorLifts,
    matLiftCount:    row.matLifts,
    scissorCost,
    matLiftCost,
    baseCost, incRate: ir, incCost, totalCost,
  };
}

/**
 * 6. AIR BALANCING
 * Excel rows 84-94
 * Base = (systems × $450 + grills × $45) ÷ (3 if Mercury, else 1)
 */
export function calcAirBalance({ required, mercuryProvided, systemsToBalance, grillCount, perSystemRate, perGrillRate, mercuryDivisor, incRate } = {}) {
  const req       = (required ?? DEFAULTS.airBalance.required) === 'Yes';
  const mercury   = (mercuryProvided ?? DEFAULTS.airBalance.mercuryProvided) === 'Yes';
  const systems   = Number(systemsToBalance ?? DEFAULTS.airBalance.systemsToBalance);
  const grills    = Number(grillCount) || 0;
  const sysRate   = Number(perSystemRate  ?? DEFAULTS.airBalance.perSystemRate);
  const grillRate = Number(perGrillRate   ?? DEFAULTS.airBalance.perGrillRate);
  const divisor   = Number(mercuryDivisor ?? DEFAULTS.airBalance.mercuryDivisor);
  const ir        = Number(incRate        ?? DEFAULTS.airBalance.incRate);

  // $450/system + $45/grill — no divisor applied
  const rawCost   = systems * sysRate + grills * grillRate;
  const baseCost  = req ? r2(rawCost) : 0;
  const incCost   = r2(baseCost * ir);
  const totalCost = r2(baseCost + incCost);

  return {
    required: req ? 'Yes' : 'No',
    mercuryProvided: mercury ? 'Yes' : 'No',
    tpCertified: !mercury ? 'Yes' : 'No',   // TP Certified = NOT mercury
    systems, grills,
    rawCost: r2(rawCost),
    baseCost, incRate: ir, incCost, totalCost,
  };
}

/**
 * 7. WARRANTY
 * Excel rows 96-104
 * Base = tons × $10 + units × $50
 */
export function calcWarranty({ required, totalTons, totalUnits, perTonRate, perUnitRate, incRate } = {}) {
  const req      = (required ?? DEFAULTS.warranty.required) === 'Yes';
  const tons     = Number(totalTons    || 0);
  const units    = Number(totalUnits   || 0);
  const tonRate  = Number(perTonRate   ?? DEFAULTS.warranty.perTonRate);
  const unitRate = Number(perUnitRate  ?? DEFAULTS.warranty.perUnitRate);
  const ir       = Number(incRate      ?? DEFAULTS.warranty.incRate);

  const baseCost  = req ? r2(tons * tonRate + units * unitRate) : 0;
  const incCost   = r2(baseCost * ir);
  const totalCost = r2(baseCost + incCost);

  return {
    required: req ? 'Yes' : 'No',
    totalTons: tons, totalUnits: units,
    baseCost, incRate: ir, incCost, totalCost,
  };
}

/**
 * 8. TEAM TRAVEL
 * Excel rows 106-115
 * Base = IF(required, labor × (perDiem% + accommodation%), 0)
 */
export function calcTeamTravel({ required, totalLaborCost, perDiemRate, accommodationRate, incRate } = {}) {
  const req     = (required ?? DEFAULTS.teamTravel.required) === 'Yes';
  const lab     = Number(totalLaborCost) || 0;
  const pdRate  = Number(perDiemRate      ?? DEFAULTS.teamTravel.perDiemRate);
  const acRate  = Number(accommodationRate ?? DEFAULTS.teamTravel.accommodationRate);
  const ir      = Number(incRate           ?? DEFAULTS.teamTravel.incRate);

  const baseCost  = req ? r2(lab * (pdRate + acRate)) : 0;
  const incCost   = r2(baseCost * ir);
  const totalCost = r2(baseCost + incCost);

  return {
    required: req ? 'Yes' : 'No',
    totalLaborCost: lab,
    perDiemRate: pdRate, accommodationRate: acRate,
    baseCost, incRate: ir, incCost, totalCost,
  };
}

/**
 * BATCH — calculates all sections and rolls up into the summary table.
 *
 * @param {Object} inputs  — all user inputs across all sections
 * @param {Object} context — cross-module values: { directJobCost, totalLaborCost, totalTons, totalUnits, grillCount }
 * @param {Array}  freeRows — up to 2 free rows [{ label, matCost, laborCost }]
 *
 * @returns {Object} { sections, summary: { totalMat, totalLabor, grandTotal } }
 */
export function calcGeneralBatch(inputs = {}, context = {}, freeRows = []) {
  const { directJobCost, scheduleLaborCost, totalLaborCost, totalTons, totalUnits, grillCount } = context;

  // Logistics + Travel use schedule-only labor (Excel D28 = specific row sum, not E23)
  // Rentals uses grand total labor (Excel C73 = Summary!E23)
  const laborForLogistics = scheduleLaborCost ?? totalLaborCost ?? 0;
  const laborForRentals   = totalLaborCost    ?? scheduleLaborCost ?? 0;
  const laborForTravel    = scheduleLaborCost ?? totalLaborCost ?? 0;

  const permitting   = calcPermitting({ ...inputs.permitting,   directJobCost });
  const logistics    = calcFieldLogistics({ ...inputs.logistics, totalLaborCost: laborForLogistics });
  const craneNew     = calcCraneNew({ ...inputs.craneNew });
  const demolition   = calcDemolition({ ...inputs.demolition });
  const rentals      = calcRentals({ ...inputs.rentals, totalLaborCost: laborForRentals });
  const airBalance   = calcAirBalance({ ...inputs.airBalance, grillCount });
  const warranty     = calcWarranty({ ...inputs.warranty, totalTons, totalUnits });
  const teamTravel   = calcTeamTravel({ ...inputs.teamTravel, totalLaborCost: laborForTravel });

  // Summary rows — matches Excel rows 4-13
  // Mat or Labor assignment follows Excel column usage (C=Mat, D=Labor)
  const summaryRows = [
    { label: 'Permitting',          mat: permitting.totalCost,  labor: 0 },
    { label: 'Field Logistics',     mat: 0,                     labor: logistics.totalCost },
    { label: 'Crane Service',       mat: craneNew.totalCost,    labor: 0 },
    { label: 'Demolition',          mat: 0,                     labor: demolition.totalCost },
    { label: 'Rentals',             mat: rentals.totalCost,     labor: 0 },
    { label: 'Air Balance',         mat: airBalance.totalCost,  labor: 0 },
    { label: 'Warranty',            mat: 0,                     labor: warranty.totalCost },
    { label: 'Team Travel',         mat: teamTravel.totalCost,  labor: 0 },
    // Free rows
    ...(freeRows[0] ? [{ label: freeRows[0].label || 'NA', mat: Number(freeRows[0].matCost) || 0, labor: Number(freeRows[0].laborCost) || 0 }] : [{ label: 'NA', mat: 0, labor: 0 }]),
    ...(freeRows[1] ? [{ label: freeRows[1].label || 'NA', mat: Number(freeRows[1].matCost) || 0, labor: Number(freeRows[1].laborCost) || 0 }] : [{ label: 'NA', mat: 0, labor: 0 }]),
  ];

  const totalMat   = r2(summaryRows.reduce((s, r) => s + r.mat,   0));
  const totalLabor = r2(summaryRows.reduce((s, r) => s + r.labor, 0));

  return {
    permitting, logistics, craneNew, demolition,
    rentals, airBalance, warranty, teamTravel,
    summaryRows,
    summary: { totalMat, totalLabor, grandTotal: r2(totalMat + totalLabor) },
  };
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export const GENERAL_SECTION_LABELS = {
  permitting:  'Permitting',
  logistics:   'Field Logistics',
  craneNew:    'Crane Service (New Units)',
  demolition:  'Demolition',
  rentals:     'Rentals',
  airBalance:  'Air Balancing',
  warranty:    'Warranty',
  teamTravel:  'Team Travel',
};
