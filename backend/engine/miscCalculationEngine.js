'use strict';
/**
 * miscCalculationEngine.js
 *
 * Backend ports of the frontend utility calc functions for:
 *   • Diffuser Schedule   (diffuserCalculations.js)
 *   • Electric Heat       (electricHeatCalculations.js)
 *   • General Items       (generalCalculations.js)
 *
 * All functions are pure (deterministic, no I/O).
 * Registered in calculateService.js MODULE_BATCH_MAP.
 */

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const r2    = n => Math.round(n * 100) / 100;
const r10   = n => Math.round(n / 10) * 10;
const r100  = n => Math.round(n / 100) * 100;

// ─────────────────────────────────────────────────────────────────────────────
// DIFFUSER SCHEDULE
// Source: frontend/src/utils/diffuserCalculations.js
// ─────────────────────────────────────────────────────────────────────────────

const DIFFUSER_TYPES = [
  { id: 'sq_xl',   label: 'Square >24×24',  installHrs: 2.0, defaultPrice: 180 },
  { id: 'sq_l',    label: 'Square =24×24',  installHrs: 1.6, defaultPrice: 102 },
  { id: 'sq_m',    label: 'Square >12×12',  installHrs: 1.6, defaultPrice:  85 },
  { id: 'sq_s',    label: 'Square =12×12',  installHrs: 1.5, defaultPrice:  65 },
  { id: 'sq_xs',   label: 'Square <12×12',  installHrs: 1.5, defaultPrice:  55 },
  { id: 'slot_48', label: 'Slot 48″',        installHrs: 2.5, defaultPrice: 250 },
  { id: 'slot_24', label: 'Slot 24″',        installHrs: 2.5, defaultPrice: 160 },
  { id: 'other',   label: 'Other',           installHrs: 1.6, defaultPrice: 102 },
];

const DEFAULT_GRD_RATE   = 25;
const DEFAULT_MISC_PCT   = 0.10;
const DEFAULT_FRAME_COST = 25;

function getDiffuserType(id) {
  return DIFFUSER_TYPES.find(t => t.id === id) ?? null;
}

function calcDiffuserRow(row, settings = {}) {
  const { typeId = '', qty = 0, sheetrock = false, quotedPrice = 0, customPrice = 0 } = row;
  const {
    grdRate             = DEFAULT_GRD_RATE,
    miscPct             = DEFAULT_MISC_PCT,
    frameCost           = DEFAULT_FRAME_COST,
    marketPrices        = {},
    installHrsOverrides = null,
  } = settings;

  const type = getDiffuserType(typeId);
  const q    = Number(qty) || 0;

  if (!type || !q) {
    return { typeId, qty: q, estUnitPrice: 0, framePrice: 0, miscMat: 0,
             laborPerUnit: 0, effectiveUnitPrice: 0,
             totalMat: 0, totalLabor: 0, total: 0, priceSource: 'none' };
  }

  let estUnitPrice = 0, priceSource = 'table';
  if (quotedPrice > 0) {
    estUnitPrice = 0; priceSource = 'quoted';
  } else if (customPrice > 0) {
    estUnitPrice = customPrice; priceSource = 'custom';
  } else if (marketPrices[typeId] > 0) {
    estUnitPrice = marketPrices[typeId]; priceSource = 'market';
  } else {
    estUnitPrice = type.defaultPrice;
  }

  const framePrice         = (quotedPrice > 0) ? 0 : (sheetrock ? frameCost : 0);
  const effectiveUnitPrice = quotedPrice > 0 ? quotedPrice : estUnitPrice;
  const miscMat            = (effectiveUnitPrice + framePrice) * miscPct;

  const effectiveInstallHrs = installHrsOverrides?.[typeId] ?? type.installHrs;
  const laborPerUnit        = effectiveInstallHrs * grdRate;
  const unitMaterialCost    = effectiveUnitPrice + framePrice + miscMat;
  const totalMat            = unitMaterialCost * q;
  const totalLabor          = laborPerUnit * q;
  const total               = totalMat + totalLabor;

  return {
    typeId, qty: q,
    estUnitPrice:     r2(estUnitPrice),
    framePrice:       r2(framePrice),
    miscMat:          r2(miscMat),
    installHrs:       effectiveInstallHrs,
    laborPerUnit:     r2(laborPerUnit),
    effectiveUnitPrice: r2(effectiveUnitPrice),
    unitMaterialCost: r2(unitMaterialCost),
    totalMat:         r2(totalMat),
    totalLabor:       r2(totalLabor),
    total:            r2(total),
    priceSource,
  };
}

function calcDiffuserBatch(rows, settings = {}) {
  const results = rows.map(row => ({ id: row.id, ...calcDiffuserRow(row, settings) }));

  const rawTotalMat   = results.reduce((s, r) => s + r.totalMat,   0);
  const rawTotalLabor = results.reduce((s, r) => s + r.totalLabor, 0);
  const rawTotal      = results.reduce((s, r) => s + r.total,      0);
  const totalQty      = results.reduce((s, r) => s + r.qty,        0);
  const totalHours    = results.reduce((s, r) => s + (r.installHrs || 0) * (r.qty || 0), 0);

  return {
    rows: results,
    totals: {
      qty:        totalQty,
      totalMat:   r2(rawTotalMat),
      totalLabor: r10(rawTotalLabor),
      total:      r10(rawTotal),
      totalHours: Math.round(totalHours * 10) / 10,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ELECTRIC HEAT SCHEDULE
// Source: frontend/src/utils/electricHeatCalculations.js
// ─────────────────────────────────────────────────────────────────────────────

const ELEC_DEFAULT_MISC_PCT = 0.20;

function calcElectricHeatRow(row, settings = {}) {
  const { unitCost = 0, labor = 0 }       = row;
  const { miscPct = ELEC_DEFAULT_MISC_PCT } = settings;

  const miscParts     = r2(unitCost * miscPct);
  const totalMaterial = r2(unitCost + miscParts);
  const matPlusLab    = r2(totalMaterial + Number(labor));
  return { miscParts, totalMaterial, matPlusLab };
}

function calcElectricHeatBatch(rows, settings = {}) {
  const calcRows = rows.map(r => calcElectricHeatRow(r, settings));

  const sum      = key => calcRows.reduce((acc, r) => acc + (r[key] ?? 0), 0);
  const sumInput = key => rows.reduce((acc, r) => acc + (parseFloat(r[key]) || 0), 0);

  const totalLaborRaw   = sumInput('labor');
  const totalMatPlusRaw = sum('totalMaterial') + totalLaborRaw;

  return {
    rows: calcRows,
    totals: {
      totalKw:         sumInput('kw'),
      totalUnitCost:   sumInput('unitCost'),
      totalMiscParts:  r2(sum('miscParts')),
      totalMaterial:   r2(sum('totalMaterial')),
      totalLabor:      r10(totalLaborRaw),
      totalMatPlusLab: r10(totalMatPlusRaw),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERAL ITEMS
// Source: frontend/src/utils/generalCalculations.js
// ─────────────────────────────────────────────────────────────────────────────

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

const CRANE_TABLE = [
  { category: 'Small', pricePerDay:  750 },
  { category: 'Med',   pricePerDay: 1500 },
  { category: 'Large', pricePerDay: 3500 },
  { category: 'Max',   pricePerDay: 4500 },
];

const DUCT_DEMO_TABLE = { xl: 1200, l: 800, m: 600, s: 400 };

const RENTALS_TABLE = [
  { threshold:      0, scissorCost:  1500, matLiftCost:   900 },
  { threshold:  18000, scissorCost:  2000, matLiftCost:  1250 },
  { threshold:  72000, scissorCost:  3500, matLiftCost:  2300 },
  { threshold: 144000, scissorCost:  7000, matLiftCost:  4600 },
  { threshold: 288000, scissorCost: 10500, matLiftCost:  6900 },
  { threshold: 432000, scissorCost: 20000, matLiftCost: 13400 },
];

function calcPermitting({ required, directJobCost, incRate = 0.10, basePct = 0.005, minBaseCost = 175 } = {}) {
  if ((required ?? 'Yes') !== 'Yes') return { totalCost: 0, baseCost: 0, incCost: 0 };
  const baseCost  = r2(Math.max((Number(directJobCost) || 0) * basePct, minBaseCost));
  const incCost   = r2(baseCost * incRate);
  return { baseCost, incCost, totalCost: r2(baseCost + incCost) };
}

function calcFieldLogistics({ required, totalLaborCost, logisticsRate = 0.06, incRate = 0 } = {}) {
  if ((required ?? 'Yes') !== 'Yes') return { totalCost: 0, baseCost: 0, incCost: 0 };
  const baseCost  = r2((Number(totalLaborCost) || 0) * logisticsRate);
  const incCost   = r2(baseCost * incRate);
  return { baseCost, incCost, totalCost: r2(baseCost + incCost) };
}

function calcCraneNew({ required, liftedUnitCount = 0, extraLiftDays = 0, sizeCategory = 'Small', unitsPerDay = 8, incRate = 0 } = {}) {
  if ((required ?? 'No').toLowerCase() !== 'yes') return { totalCost: 0, baseCost: 0, incCost: 0 };
  const crane    = CRANE_TABLE.find(c => c.category === sizeCategory) ?? CRANE_TABLE[0];
  const days     = Math.ceil(Number(liftedUnitCount) / unitsPerDay) + Number(extraLiftDays);
  const baseCost = r2(crane.pricePerDay * days);
  const incCost  = r2(baseCost * incRate);
  return { baseCost, incCost, totalCost: r2(baseCost + incCost) };
}

function calcDemolition({ required, splitsToDemoCount = 0, rtusToDemoCount = 0, cranedUnitCount = 0,
  xlDuctRuns = 0, lDuctRuns = 0, mDuctRuns = 0, sDuctRuns = 0, partialDuctDiscount = 0, incRate = 0 } = {}) {
  if ((required ?? 'No').toLowerCase() !== 'yes') return { totalCost: 0, baseCost: 0, incCost: 0 };
  const craned       = Number(cranedUnitCount);
  const craneSurcharge = craned === 0 ? 0 : craned > 5 ? 1500 : 800;
  const unitDemoCost = r2(Number(rtusToDemoCount) * 400 + Number(splitsToDemoCount) * 600 + craneSurcharge);
  const ductDemoCost = r2(Number(xlDuctRuns) * DUCT_DEMO_TABLE.xl + Number(lDuctRuns) * DUCT_DEMO_TABLE.l
                        + Number(mDuctRuns)  * DUCT_DEMO_TABLE.m  + Number(sDuctRuns) * DUCT_DEMO_TABLE.s);
  const ductDemoNet  = r2(ductDemoCost * (1 - Number(partialDuctDiscount)));
  const baseCost     = r2(unitDemoCost + ductDemoNet);
  const incCost      = r2(baseCost * incRate);
  return { unitDemoCost, ductDemoCost, ductDemoNet, baseCost, incCost, totalCost: r2(baseCost + incCost) };
}

function calcRentals({ required, totalLaborCost, incRate = 0 } = {}) {
  if ((required ?? 'Yes') !== 'Yes') return { totalCost: 0, baseCost: 0, incCost: 0 };
  const row      = floorMatch(RENTALS_TABLE.map(r => [r.threshold, r]), Number(totalLaborCost) || 0);
  const baseCost = r2(row.scissorCost + row.matLiftCost);
  const incCost  = r2(baseCost * incRate);
  return { scissorCost: row.scissorCost, matLiftCost: row.matLiftCost, baseCost, incCost, totalCost: r2(baseCost + incCost) };
}

function calcAirBalance({ required, mercuryProvided, systemsToBalance = 0, grillCount = 0,
  perSystemRate = 450, perGrillRate = 45, mercuryDivisor = 3, incRate = 0 } = {}) {
  if ((required ?? 'Yes') !== 'Yes') return { totalCost: 0, baseCost: 0, incCost: 0 };
  const mercury   = (mercuryProvided ?? 'No') === 'Yes';
  const rawCost   = Number(systemsToBalance) * perSystemRate + Number(grillCount) * perGrillRate;
  const baseCost  = r2(rawCost / (mercury ? mercuryDivisor : 1));
  const incCost   = r2(baseCost * incRate);
  return { baseCost, incCost, totalCost: r2(baseCost + incCost) };
}

function calcWarranty({ required, totalTons = 0, totalUnits = 0, perTonRate = 10, perUnitRate = 50, incRate = 0 } = {}) {
  if ((required ?? 'Yes') !== 'Yes') return { totalCost: 0, baseCost: 0, incCost: 0 };
  const baseCost = r2(Number(totalTons) * perTonRate + Number(totalUnits) * perUnitRate);
  const incCost  = r2(baseCost * incRate);
  return { baseCost, incCost, totalCost: r2(baseCost + incCost) };
}

function calcTeamTravel({ required, totalLaborCost, perDiemRate = 0.15, accommodationRate = 0.20, incRate = 0 } = {}) {
  if ((required ?? 'No') !== 'Yes') return { totalCost: 0, baseCost: 0, incCost: 0 };
  const baseCost = r2((Number(totalLaborCost) || 0) * (perDiemRate + accommodationRate));
  const incCost  = r2(baseCost * incRate);
  return { baseCost, incCost, totalCost: r2(baseCost + incCost) };
}

/**
 * calcGeneralBatch — entry point called by calculateService.js
 *
 * rows   — not used (general items has no row array; inputs live in settings)
 * settings — { inputs: {}, context: {}, freeRows: [] }
 */
function calcGeneralBatch(rows, settings = {}) {
  const { inputs = {}, context = {}, freeRows = [] } = settings;
  const { directJobCost, scheduleLaborCost, totalLaborCost, totalTons, totalUnits, grillCount } = context;

  const laborForLogistics = scheduleLaborCost ?? totalLaborCost ?? 0;
  const laborForRentals   = totalLaborCost    ?? scheduleLaborCost ?? 0;
  const laborForTravel    = scheduleLaborCost ?? totalLaborCost ?? 0;

  const permitting  = calcPermitting({ ...inputs.permitting,  directJobCost });
  const logistics   = calcFieldLogistics({ ...inputs.logistics, totalLaborCost: laborForLogistics });
  const craneNew    = calcCraneNew({ ...inputs.craneNew });
  const demolition  = calcDemolition({ ...inputs.demolition });
  const rentals     = calcRentals({ ...inputs.rentals, totalLaborCost: laborForRentals });
  const airBalance  = calcAirBalance({ ...inputs.airBalance, grillCount });
  const warranty    = calcWarranty({ ...inputs.warranty, totalTons, totalUnits });
  const teamTravel  = calcTeamTravel({ ...inputs.teamTravel, totalLaborCost: laborForTravel });

  const summaryRows = [
    { label: 'Permitting',      mat: permitting.totalCost,  labor: 0 },
    { label: 'Field Logistics', mat: 0,                     labor: logistics.totalCost },
    { label: 'Crane Service',   mat: craneNew.totalCost,    labor: 0 },
    { label: 'Demolition',      mat: 0,                     labor: demolition.totalCost },
    { label: 'Rentals',         mat: rentals.totalCost,     labor: 0 },
    { label: 'Air Balance',     mat: airBalance.totalCost,  labor: 0 },
    { label: 'Warranty',        mat: 0,                     labor: warranty.totalCost },
    { label: 'Team Travel',     mat: teamTravel.totalCost,  labor: 0 },
    ...(freeRows[0] ? [{ label: freeRows[0].label || 'NA', mat: Number(freeRows[0].matCost) || 0, labor: Number(freeRows[0].laborCost) || 0 }] : [{ label: 'NA', mat: 0, labor: 0 }]),
    ...(freeRows[1] ? [{ label: freeRows[1].label || 'NA', mat: Number(freeRows[1].matCost) || 0, labor: Number(freeRows[1].laborCost) || 0 }] : [{ label: 'NA', mat: 0, labor: 0 }]),
  ];

  const totalMat   = r2(summaryRows.reduce((s, r) => s + r.mat,   0));
  const totalLabor = r2(summaryRows.reduce((s, r) => s + r.labor, 0));

  return {
    rows: summaryRows,   // shape expected by calculateService
    totals: {
      totalMaterial: totalMat,
      totalLabor,
      totalCost: r2(totalMat + totalLabor),
    },
    sections: { permitting, logistics, craneNew, demolition, rentals, airBalance, warranty, teamTravel },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // Diffuser
  calcDiffuserRow,
  calcDiffuserBatch,
  DIFFUSER_TYPES,
  // Electric Heat
  calcElectricHeatRow,
  calcElectricHeatBatch,
  // General Items
  calcGeneralBatch,
  calcPermitting,
  calcFieldLogistics,
  calcCraneNew,
  calcDemolition,
  calcRentals,
  calcAirBalance,
  calcWarranty,
  calcTeamTravel,
};
