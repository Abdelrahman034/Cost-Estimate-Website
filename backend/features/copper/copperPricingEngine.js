/**
 * copperPricingEngine.js
 * ============================================================
 * COPPER PRICING ENGINE — Dynamic LME-based HVAC Copper Costing
 * ============================================================
 *
 * Supports: Split Systems, Wall-Mounted Splits, VRV, AHU with CU
 * Copper types: Type K, L, M (hard / soft)
 *
 * CALIBRATION NOTES
 * -----------------
 * Original table built from Grainger ACR copper prices (−10% trade
 * discount) at an implied LME baseline of ~$4.25 / lb.
 *
 * Raw copper content is ~20–30 % of retail tube price (the rest is
 * mill drawing, distribution markup, and overhead).  When LME moves,
 * only the raw copper portion of the retail price changes; thus the
 * delta formula is:
 *
 *   Δ_material_per_ft  = weight_lb_per_ft × (LME_new − LME_baseline)
 *   new_retail_per_ft  = baseline_retail_per_ft + Δ_material_per_ft
 *
 * For lump-sum installed prices (Split / Wall / AHU), only the
 * material fraction scales with LME; labour stays fixed:
 *
 *   new_total = baseline_total ×
 *               [1 + copper_fraction × (LME_new/LME_baseline − 1)]
 *               × safety_factor
 *
 * USER-ADJUSTABLE PARAMETERS (see DEFAULT_PARAMS):
 *   1. lmeCopperPrice    — current LME spot price in $/lb
 *   2. safetyFactor      — per-equipment-type contingency multiplier
 *   3. copperFraction    — (advanced) fraction of installed cost that
 *                          scales with copper price; calibrated defaults
 *                          are provided for each equipment / tonnage.
 *
 * ============================================================
 */

'use strict';

// ──────────────────────────────────────────────────────────────
// 0.  DB-INJECTABLE DATA STORE
// ──────────────────────────────────────────────────────────────
//
// copperDataLoader calls loadTables(tables) at startup after fetching
// from PostgreSQL.  When _dbTables is set, all calculation functions
// use it; otherwise they fall back to the hardcoded constants below.
//
// This means:
//   • All calculation logic is UNCHANGED — only the data source differs.
//   • If the DB is empty or unreachable, the engine works as before.
//   • After an admin updates a spec, calling loadTables(newTables) makes
//     the change live instantly (no restart required).

let _dbTables = null;

/**
 * Inject DB-loaded reference tables into the engine.
 * Pass null to revert to hardcoded defaults.
 * @param {object|null} tables
 */
function loadTables(tables) {
  _dbTables = tables || null;
}

/**
 * Internal helper — returns the active data tables.
 * Merges DB tables over hardcoded constants so partial DB data still works.
 */
function _d() {
  if (!_dbTables) {
    return {
      PIPE_WEIGHTS,
      DISTRIBUTION_FACTORS,
      VRV_BASELINE_PRICES_PER_FT,
      INSULATION_COSTS_PER_FT,
      BASELINE_PRICES,
      VRV_BLENDED_CONFIGS,
      EQUIPMENT_PIPE_CONFIGS,
      VRV_BLENDED_INSULATION_PER_FT,
    };
  }
  return {
    PIPE_WEIGHTS:               _dbTables.PIPE_WEIGHTS               || PIPE_WEIGHTS,
    DISTRIBUTION_FACTORS:       _dbTables.DISTRIBUTION_FACTORS       || DISTRIBUTION_FACTORS,
    VRV_BASELINE_PRICES_PER_FT: _dbTables.VRV_BASELINE_PRICES_PER_FT || VRV_BASELINE_PRICES_PER_FT,
    INSULATION_COSTS_PER_FT:    _dbTables.INSULATION_COSTS_PER_FT    || INSULATION_COSTS_PER_FT,
    BASELINE_PRICES:            _dbTables.BASELINE_PRICES             || BASELINE_PRICES,
    VRV_BLENDED_CONFIGS:        _dbTables.VRV_BLENDED_CONFIGS         || VRV_BLENDED_CONFIGS,
    EQUIPMENT_PIPE_CONFIGS:     _dbTables.EQUIPMENT_PIPE_CONFIGS      || EQUIPMENT_PIPE_CONFIGS,
    VRV_BLENDED_INSULATION_PER_FT: _dbTables.VRV_BLENDED_INSULATION_PER_FT || VRV_BLENDED_INSULATION_PER_FT,
  };
}

// ──────────────────────────────────────────────────────────────
// 1.  USER-CONFIGURABLE DEFAULTS
// ──────────────────────────────────────────────────────────────

/** Default parameters — override at call-time or via the frontend. */
const DEFAULT_PARAMS = {
  /** Current LME copper spot price in $/lb */
  lmeCopperPrice: 4.25,

  /**
   * Safety / contingency multiplier per equipment type.
   * 1.10 = add 10 % on top of the calculated price.
   */
  safetyFactors: {
    split:       1.10,
    wallMounted: 1.10,
    vrv:         1.15,
    ahuWithCU:   1.15,
  },

  /**
   * (Advanced) Fraction of the installed lump-sum price that is
   * copper material — this fraction scales with LME.
   * Labour, fittings, startup, etc. are in (1 − copperFraction).
   * Calibrated from the original table at BASELINE_LME = $4.25/lb.
   */
  copperFractions: {
    split: {
      0:  0.31,   // small unit, ~15 ft avg run
      5:  0.44,   // 5-ton,  ~50 ft avg run
      10: 0.56,   // 10-ton, ~50 ft avg run
      20: 0.45,   // 20-ton, ~65 ft avg run (larger building)
      50: 0.50,   // 50-ton, ~80 ft avg run
      75: 0.55,   // 75-ton, ~90 ft avg run
    },
    wallMounted: {
      0:  0.31, 5:  0.44, 10: 0.56,
      20: 0.45, 50: 0.50, 75: 0.55,
    },
    ahuWithCU: {
      0:  0.35, 5:  0.40, 10: 0.45,
      20: 0.50, 50: 0.55, 75: 0.60,
    },
    /**
     * VRV per-tonnage blended $/ft price is ALL material (no labour).
     * copperFraction = fraction that tracks LME directly.
     * Based on calibration: raw copper ≈ 25 % of Grainger retail,
     * but mill + distributor surcharges lift effective pass-through
     * to ~40–50 %.  Default: 0.45.
     */
    vrv: {
      0:  0.45, 5:  0.45, 10: 0.45,
      20: 0.45, 50: 0.45, 75: 0.45,
    },
  },
};


// ──────────────────────────────────────────────────────────────
// 2.  CALIBRATION CONSTANTS
// ──────────────────────────────────────────────────────────────

/**
 * Implied baseline LME price used when the original table was built.
 * Reverse-engineered from Grainger ACR copper prices at distribution
 * factor ≈ 3.75–3.93 × for mid-range sizes (7/8" – 1-5/8").
 */
const BASELINE_LME = 4.25; // $/lb

/**
 * ACR / Type L copper tube weights per foot (lb/ft) — ASTM B88 / B280.
 * K: heavy wall  |  L: medium wall (most common HVAC)  |  M: light wall
 *
 * "Soft" vs "Hard" affects workability, not weight or price per foot —
 * weight is determined by the type (K / L / M) alone.
 */
const PIPE_WEIGHTS = {
  '3/8"':   { K: 0.198, L: 0.145, M: 0.126 },
  '1/2"':   { K: 0.269, L: 0.198, M: 0.153 },
  '5/8"':   { K: 0.344, L: 0.285, M: 0.220 },
  '3/4"':   { K: 0.481, L: 0.362, M: 0.285 },
  '7/8"':   { K: 0.641, L: 0.455, M: 0.362 },
  '1-1/8"': { K: 0.839, L: 0.655, M: 0.516 },
  '1-3/8"': { K: 1.040, L: 0.884, M: 0.694 },
  '1-5/8"': { K: 1.360, L: 1.140, M: 0.901 },
  '2-1/8"': { K: 2.060, L: 1.750, M: 1.460 },
  '2-5/8"': { K: 2.930, L: 2.480, M: 2.000 },
};

/**
 * Grainger retail distribution factors — calibrated at BASELINE_LME.
 * distribution_factor[size] = Grainger_price / (weight_L × BASELINE_LME)
 *
 * This encodes: mill premium + Grainger markup + waste allowance.
 * The factor is size-dependent because per-foot tooling costs differ.
 */
const DISTRIBUTION_FACTORS = {
  '3/8"':   4.868,
  '1/2"':   4.753,
  '5/8"':   3.302,
  '3/4"':   3.380,
  '7/8"':   3.930,
  '1-1/8"': 3.413,
  '1-3/8"': 3.445,   // interpolated between 1-1/8" and 1-5/8"
  '1-5/8"': 3.447,
  '2-1/8"': 4.303,
  '2-5/8"': 4.250,   // extrapolated
};

/**
 * Baseline VRV pipe prices per foot — from Grainger at −10 % trade
 * discount, at BASELINE_LME = $4.25/lb.
 */
const VRV_BASELINE_PRICES_PER_FT = {
  '3/8"':   3.00,
  '1/2"':   4.00,
  '5/8"':   4.00,
  '3/4"':   5.20,
  '7/8"':   7.60,
  '1-1/8"': 9.50,
  '1-3/8"': 12.88,  // interpolated
  '1-5/8"': 16.70,
  '2-1/8"': 32.00,
};

/**
 * Insulation costs per foot — sourced from Grainger, NOT copper-linked.
 * These stay FIXED regardless of LME changes.
 */
const INSULATION_COSTS_PER_FT = {
  '3/8"':   1.00,
  '1/2"':   1.00,
  '5/8"':   1.00,
  '3/4"':   1.20,
  '7/8"':   1.25,
  '1-1/8"': 1.50,
  '1-3/8"': 1.75,
  '1-5/8"': 2.00,
  '2-1/8"': 2.50,
  '2-5/8"': 3.00,
};

/**
 * Standard refrigerant line configurations per equipment type & tonnage.
 * pipe sizes follow ASHRAE / manufacturer recommendations.
 * avgLengthShort: assumed average run for <100 ft category (ft)
 * avgLengthLong : 1.5 × short (matches the 1.5 × price ratio in table)
 */
const EQUIPMENT_PIPE_CONFIGS = {
  split: {
    0:  { liquid: '3/8"', suction: '1/2"',   avgLengthShort: 15,  avgLengthLong: 22.5 },
    5:  { liquid: '3/8"', suction: '7/8"',   avgLengthShort: 50,  avgLengthLong: 75   },
    10: { liquid: '1/2"', suction: '1-1/8"', avgLengthShort: 50,  avgLengthLong: 75   },
    20: { liquid: '5/8"', suction: '1-3/8"', avgLengthShort: 65,  avgLengthLong: 97.5 },
    50: { liquid: '7/8"', suction: '1-5/8"', avgLengthShort: 80,  avgLengthLong: 120  },
    75: { liquid: '1-1/8"', suction: '2-1/8"', avgLengthShort: 90, avgLengthLong: 135 },
  },
  wallMounted: {
    0:  { liquid: '3/8"', suction: '1/2"',   avgLengthShort: 15,  avgLengthLong: 22.5 },
    5:  { liquid: '3/8"', suction: '7/8"',   avgLengthShort: 50,  avgLengthLong: 75   },
    10: { liquid: '1/2"', suction: '1-1/8"', avgLengthShort: 50,  avgLengthLong: 75   },
    20: { liquid: '5/8"', suction: '1-3/8"', avgLengthShort: 65,  avgLengthLong: 97.5 },
    50: { liquid: '7/8"', suction: '1-5/8"', avgLengthShort: 80,  avgLengthLong: 120  },
    75: { liquid: '1-1/8"', suction: '2-1/8"', avgLengthShort: 90, avgLengthLong: 135 },
  },
  ahuWithCU: {
    0:  { liquid: '3/8"', suction: '3/4"',   avgLengthShort: 10,  avgLengthLong: 15   },
    5:  { liquid: '3/8"', suction: '3/4"',   avgLengthShort: 15,  avgLengthLong: 22.5 },
    10: { liquid: '1/2"', suction: '7/8"',   avgLengthShort: 20,  avgLengthLong: 30   },
    20: { liquid: '5/8"', suction: '1-1/8"', avgLengthShort: 25,  avgLengthLong: 37.5 },
    50: { liquid: '7/8"', suction: '1-5/8"', avgLengthShort: 40,  avgLengthLong: 60   },
    75: { liquid: '1-1/8"', suction: '2-1/8"', avgLengthShort: 55, avgLengthLong: 82.5},
  },
};

/**
 * VRV blended per-ft $/ft — baseline values at LME = $4.25/lb.
 * blendedWeightPerFt: reverse-engineered total copper lb/ft (all pipes)
 * used for the delta-formula: Δ_price = blendedWeight × ΔLME
 *
 * Derived as: weight = baseline_$/ft / (BASELINE_LME × avg_dist_factor)
 * where avg_dist_factor for 7/8"–1-5/8" range ≈ 3.597
 */
const VRV_BLENDED_CONFIGS = {
  0:  { basePerFt: 5.200,  blendedWeightPerFt: 0.340 },
  5:  { basePerFt: 8.125,  blendedWeightPerFt: 0.532 },
  10: { basePerFt: 12.090, blendedWeightPerFt: 0.791 },
  20: { basePerFt: 18.330, blendedWeightPerFt: 1.199 },
  50: { basePerFt: 33.280, blendedWeightPerFt: 2.177 },
  75: { basePerFt: 43.225, blendedWeightPerFt: 2.828 },
};

/**
 * VRV refrigerant supplemental charge — $/ft-ton (R454 baseline).
 * Not copper-linked; treat as fixed for now.
 */
const VRV_REFRIGERANT_PER_FT_TON = 0.9236;

/**
 * Blended insulation cost per foot for VRV systems by tonnage bracket.
 * Represents the weighted-average of all branch + header line sizes.
 * Fixed (not LME-linked) — sourced from Grainger foam pipe insulation.
 */
const VRV_BLENDED_INSULATION_PER_FT = {
  0:  1.00,
  5:  1.25,
  10: 1.50,
  20: 1.75,
  50: 2.00,
  75: 2.50,
};

/** Baseline lump-sum installed prices from original Excel table. */
const BASELINE_PRICES = {
  split: {
    0:  { copperL_short: 1128,  copperL_long: 1692,  copperRoll_short: 564,   copperRoll_long: 846   },
    5:  { copperL_short: 1208,  copperL_long: 1812,  copperRoll_short: 604,   copperRoll_long: 906   },
    10: { copperL_short: 1208,  copperL_long: 1812,  copperRoll_short: 604,   copperRoll_long: 906   },
    20: { copperL_short: 3216,  copperL_long: 4824,  copperRoll_short: 1608,  copperRoll_long: 2412  },
    50: { copperL_short: 4496,  copperL_long: 6744,  copperRoll_short: 2248,  copperRoll_long: 3372  },
    75: { copperL_short: 6096,  copperL_long: 9144,  copperRoll_short: 3048,  copperRoll_long: 4572  },
  },
  wallMounted: {
    0:  { copperL_short: 1128,  copperL_long: 1692,  copperRoll_short: 564,   copperRoll_long: 846   },
    5:  { copperL_short: 1208,  copperL_long: 1812,  copperRoll_short: 604,   copperRoll_long: 906   },
    10: { copperL_short: 1208,  copperL_long: 1812,  copperRoll_short: 604,   copperRoll_long: 906   },
    20: { copperL_short: 3216,  copperL_long: 4824,  copperRoll_short: 1608,  copperRoll_long: 2412  },
    50: { copperL_short: 4496,  copperL_long: 6744,  copperRoll_short: 2248,  copperRoll_long: 3372  },
    75: { copperL_short: 6096,  copperL_long: 9144,  copperRoll_short: 3048,  copperRoll_long: 4572  },
  },
  ahuWithCU: {
    0:  { short: 360,   long: 540  },
    5:  { short: 360,   long: 540  },
    10: { short: 440,   long: 660  },
    20: { short: 520,   long: 780  },
    50: { short: 680,   long: 1020 },
    75: { short: 880,   long: 1320 },
  },
  refrigerant: {
    split: {
      0:  { short: 280,    long: 420    },
      5:  { short: 280,    long: 140    },
      10: { short: 420,    long: 630    },
      20: { short: 630,    long: 945    },
      50: { short: 1225,   long: 1837.5 },
      75: { short: 2450,   long: 3675   },
    },
  },
};


// ──────────────────────────────────────────────────────────────
// 3.  CORE CALCULATION FUNCTIONS
// ──────────────────────────────────────────────────────────────

/**
 * Calculate the adjusted per-foot price for a specific VRV pipe size.
 *
 * Formula (physically exact):
 *   new_price = baseline_price + weight × (LME_new − LME_baseline)
 *   adjusted  = new_price × safety_factor   (optional insulation added)
 *
 * @param {string}  pipeSize         — e.g. '7/8"'
 * @param {string}  copperType       — 'K' | 'L' | 'M'   (default 'L')
 * @param {number}  lmePrice         — current LME $/lb
 * @param {boolean} includeInsulation
 * @param {number}  safetyFactor     — contingency multiplier
 * @returns {PipeCostResult}
 *
 * @typedef {Object} PipeCostResult
 * @property {string}  pipeSize
 * @property {string}  copperType
 * @property {number}  weightPerFt          — lb/ft
 * @property {number}  baselinePricePerFt   — original Grainger price $/ft
 * @property {number}  copperDeltaPerFt     — change due to LME shift $/ft
 * @property {number}  adjustedCopperPerFt  — copper pipe cost after adjustment
 * @property {number}  insulationPerFt      — insulation cost $/ft (fixed)
 * @property {number}  totalPerFt           — (copper + insulation) × safety
 * @property {number}  lmePrice
 * @property {number}  safetyFactor
 */
function calcVRVPipePerFt(
  pipeSize,
  copperType = 'L',
  lmePrice = BASELINE_LME,
  includeInsulation = true,
  safetyFactor = 1.0,
) {
  const { PIPE_WEIGHTS: PW, VRV_BASELINE_PRICES_PER_FT: VBP, INSULATION_COSTS_PER_FT: INS } = _d();

  const weights = PW[pipeSize];
  if (!weights) throw new Error(`Unknown pipe size: "${pipeSize}"`);
  if (!weights[copperType]) throw new Error(`Unknown copper type: "${copperType}"`);

  const baselineWeightL = PW[pipeSize]['L'];     // calibration ref
  const actualWeight    = weights[copperType];

  // Type premium: K costs more (heavier), M costs less.
  // We scale the baseline Type-L price by the weight ratio.
  const typePremiumFactor = actualWeight / baselineWeightL;

  const baselinePricePerFt = (VBP[pipeSize] || 0) * typePremiumFactor;
  const lmeDelta           = lmePrice - BASELINE_LME;

  // Only the raw copper content portion changes with LME.
  const copperDeltaPerFt   = actualWeight * lmeDelta;
  const adjustedCopperPerFt = baselinePricePerFt + copperDeltaPerFt;

  const insulationPerFt = includeInsulation
    ? (INS[pipeSize] || 0)
    : 0;

  const totalPerFt = Math.round((adjustedCopperPerFt + insulationPerFt) * safetyFactor * 100) / 100;

  return {
    pipeSize,
    copperType,
    weightPerFt:         round2(actualWeight),
    baselinePricePerFt:  round2(baselinePricePerFt),
    copperDeltaPerFt:    round2(copperDeltaPerFt),
    adjustedCopperPerFt: round2(adjustedCopperPerFt),
    insulationPerFt:     round2(insulationPerFt),
    totalPerFt,
    lmePrice,
    safetyFactor,
    lmeBaseline:         BASELINE_LME,
  };
}

/**
 * Calculate blended VRV cost per foot for a whole system by tonnage.
 *
 * Uses the pre-calibrated blendedWeightPerFt for each tonnage bracket
 * (all pipe sizes + insulation rolled into one composite $/ft).
 *
 * @param {number} tonnage       — 0 | 5 | 10 | 20 | 50 | 75
 * @param {number} lmePrice      — current LME $/lb
 * @param {number} safetyFactor
 * @param {number} [copperFractionOverride]  — optional override (0–1)
 * @returns {VRVBlendedResult}
 */
function calcVRVBlendedPerFt(
  tonnage,
  lmePrice = BASELINE_LME,
  safetyFactor = 1.0,
  copperFractionOverride = null,
) {
  const { VRV_BLENDED_CONFIGS: VBC } = _d();
  const cfg = VBC[tonnage];
  if (!cfg) throw new Error(`Unknown VRV tonnage: ${tonnage}`);

  const copperFraction = copperFractionOverride
    ?? DEFAULT_PARAMS.copperFractions.vrv[tonnage]
    ?? 0.45;

  const lmeRatio         = lmePrice / BASELINE_LME;
  const adjustmentFactor = 1 + copperFraction * (lmeRatio - 1);
  const adjustedPerFt    = round2(cfg.basePerFt * adjustmentFactor * safetyFactor);

  return {
    tonnage,
    lmePrice,
    basePerFt:       cfg.basePerFt,
    blendedWeightPerFt: cfg.blendedWeightPerFt,
    copperFraction,
    lmeRatio:        round4(lmeRatio),
    adjustmentFactor: round4(adjustmentFactor),
    adjustedPerFt,
    safetyFactor,
  };
}

/**
 * Calculate total VRV system copper cost for a given run length.
 *
 * @param {number} tonnage
 * @param {number} totalRunFt   — total pipe run length in feet
 * @param {number} lmePrice
 * @param {number} safetyFactor
 * @param {number} [copperFractionOverride]
 * @returns {VRVTotalResult}
 */
function calcVRVTotalCost(
  tonnage,
  totalRunFt,
  lmePrice = BASELINE_LME,
  safetyFactor = 1.0,
  copperFractionOverride = null,
) {
  const perFt = calcVRVBlendedPerFt(tonnage, lmePrice, safetyFactor, copperFractionOverride);
  return {
    ...perFt,
    totalRunFt,
    totalCost: Math.round(perFt.adjustedPerFt * totalRunFt),
  };
}

/**
 * Calculate installed price for a Split or Wall-Mounted split system.
 *
 * Formula:
 *   new_price = baseline × [1 + cf × (LME/LME_base − 1)] × safetyFactor
 *   where cf = copperFraction for that tonnage (fraction of installed
 *              price that is copper material at Grainger prices)
 *
 * copperRoll prices = 0.5 × copperL prices (pre-made line sets with
 * smaller standard pipe sizes, less labour per foot).
 *
 * @param {'split'|'wallMounted'} equipType
 * @param {number}  tonnage        — 0 | 5 | 10 | 20 | 50 | 75
 * @param {boolean} isLongRun      — false = <100 ft | true = ≥100 ft
 * @param {'copperL'|'copperRoll'} lineSetType
 * @param {string}  copperType     — 'K' | 'L' | 'M' (affects weight; L is default)
 * @param {number}  lmePrice
 * @param {number}  safetyFactor
 * @param {number}  [copperFractionOverride]
 * @returns {LumpSumResult}
 */
function calcSplitCost(
  equipType,
  tonnage,
  isLongRun,
  lineSetType = 'copperL',
  copperType = 'L',
  lmePrice = BASELINE_LME,
  safetyFactor = 1.0,
  copperFractionOverride = null,
) {
  const { BASELINE_PRICES: BP, EQUIPMENT_PIPE_CONFIGS: EPC } = _d();

  const basePrices = BP[equipType];
  if (!basePrices) throw new Error(`Unknown equipment type: "${equipType}"`);
  const row = basePrices[tonnage];
  if (!row) throw new Error(`Unknown tonnage ${tonnage} for ${equipType}`);

  const key        = `${lineSetType}_${isLongRun ? 'long' : 'short'}`;
  const baseline   = row[key];
  if (baseline === undefined) throw new Error(`No baseline price for key: ${key}`);

  // Copper type weight adjustment: Type K is heavier → more copper → higher delta
  const weightRatioToL = copperType === 'L' ? 1
    : copperType === 'K' ? 1.40   // K is ~40% heavier than L on average
    : 0.87;                        // M is ~13% lighter than L on average

  const cf = copperFractionOverride
    ?? DEFAULT_PARAMS.copperFractions[equipType]?.[tonnage]
    ?? 0.45;

  // Adjust copper fraction for copper type (K costs more, M costs less)
  const effectiveCF = cf * weightRatioToL;

  const lmeRatio         = lmePrice / BASELINE_LME;
  const adjustmentFactor = 1 + effectiveCF * (lmeRatio - 1);
  const adjustedTotal    = Math.round(baseline * adjustmentFactor * safetyFactor);

  const pipeConfig = EPC[equipType]?.[tonnage];

  return {
    equipType,
    tonnage,
    isLongRun,
    lineSetType,
    copperType,
    lmePrice,
    lmeBaseline:      BASELINE_LME,
    lmeRatio:         round4(lmeRatio),
    baseline,
    copperFraction:   round4(effectiveCF),
    adjustmentFactor: round4(adjustmentFactor),
    adjustedTotal,
    safetyFactor,
    priceDeltaVsBaseline:   adjustedTotal - baseline,
    priceChangePercent: round2((adjustedTotal / baseline - 1) * 100),
    assumedLiquidLine:  pipeConfig?.liquid  ?? 'N/A',
    assumedSuctionLine: pipeConfig?.suction ?? 'N/A',
    avgLengthFt: isLongRun
      ? pipeConfig?.avgLengthLong  ?? null
      : pipeConfig?.avgLengthShort ?? null,
  };
}

/**
 * Calculate installed price for an AHU with Condensing Unit.
 * Same formula as Split, single pipe category (no Roll variant).
 *
 * @param {number}  tonnage
 * @param {boolean} isLongRun
 * @param {string}  copperType
 * @param {number}  lmePrice
 * @param {number}  safetyFactor
 * @param {number}  [copperFractionOverride]
 * @returns {LumpSumResult}
 */
function calcAHUCost(
  tonnage,
  isLongRun,
  copperType = 'L',
  lmePrice = BASELINE_LME,
  safetyFactor = 1.0,
  copperFractionOverride = null,
) {
  const { BASELINE_PRICES: BP, EQUIPMENT_PIPE_CONFIGS: EPC } = _d();

  const row = BP.ahuWithCU[tonnage];
  if (!row) throw new Error(`Unknown tonnage ${tonnage} for ahuWithCU`);

  const baseline = isLongRun ? row.long : row.short;

  const weightRatioToL = copperType === 'K' ? 1.40 : copperType === 'M' ? 0.87 : 1;
  const cf = copperFractionOverride
    ?? DEFAULT_PARAMS.copperFractions.ahuWithCU[tonnage]
    ?? 0.45;
  const effectiveCF = cf * weightRatioToL;

  const lmeRatio         = lmePrice / BASELINE_LME;
  const adjustmentFactor = 1 + effectiveCF * (lmeRatio - 1);
  const adjustedTotal    = Math.round(baseline * adjustmentFactor * safetyFactor);

  const pipeConfig = EPC.ahuWithCU?.[tonnage];

  return {
    equipType: 'ahuWithCU',
    tonnage,
    isLongRun,
    copperType,
    lmePrice,
    lmeBaseline:      BASELINE_LME,
    lmeRatio:         round4(lmeRatio),
    baseline,
    copperFraction:   round4(effectiveCF),
    adjustmentFactor: round4(adjustmentFactor),
    adjustedTotal,
    safetyFactor,
    priceDeltaVsBaseline: adjustedTotal - baseline,
    priceChangePercent: round2((adjustedTotal / baseline - 1) * 100),
    assumedLiquidLine:  pipeConfig?.liquid  ?? 'N/A',
    assumedSuctionLine: pipeConfig?.suction ?? 'N/A',
    avgLengthFt: isLongRun
      ? pipeConfig?.avgLengthLong  ?? null
      : pipeConfig?.avgLengthShort ?? null,
  };
}

/**
 * Return refrigerant supplemental charge (not LME-dependent).
 *
 * @param {'split'} equipType
 * @param {number}  tonnage
 * @param {boolean} isLongRun
 * @returns {number|null}
 */
function calcRefrigerantCharge(equipType, tonnage, isLongRun) {
  const { BASELINE_PRICES: BP } = _d();
  const row = BP.refrigerant?.[equipType]?.[tonnage];
  if (!row) return null;
  return isLongRun ? row.long : row.short;
}


/**
 * Calculate copper line-set cost from a user-supplied average run length.
 * Mode 1 ("manual length") — the simpler user-facing input path.
 *
 * For split / wallMounted / ahuWithCU:
 *   Looks up liquid + suction pipe sizes for the tonnage bracket, then
 *   computes per-foot price for each line via calcVRVPipePerFt and
 *   multiplies by avgLengthFt.
 *
 * For vrv:
 *   Uses the pre-calibrated blended $/ft (all branch pipes combined)
 *   plus a fixed blended insulation $/ft for that tonnage bracket.
 *   avgLengthFt should be the TOTAL run (avg per unit × indoor units)
 *   — the caller handles the per-unit multiplier.
 *
 * @param {object} params
 * @param {'split'|'wallMounted'|'ahuWithCU'|'vrv'} params.equipType
 * @param {number} params.tonnage
 * @param {number} params.avgLengthFt   — total run length in feet
 * @param {string} params.copperType    — 'K'|'L'|'M'
 * @param {number} params.lmePrice
 * @param {number} params.safetyFactor
 * @param {boolean} params.includeInsulation
 * @param {number|null} params.copperFractionOverride
 * @returns {{ material, perFt, copperCost, insulationCost,
 *             liquidLine, suctionLine, avgLengthFt, lmeInfo, details }}
 */
function calcManualLengthCost({
  equipType,
  tonnage,
  avgLengthFt,
  copperType = 'L',
  lmePrice = BASELINE_LME,
  safetyFactor = 1.0,
  includeInsulation = true,
  copperFractionOverride = null,
}) {
  const lenFt = Number(avgLengthFt) || 0;
  const { VRV_BLENDED_CONFIGS: VBC, VRV_BLENDED_INSULATION_PER_FT: VBINS, EQUIPMENT_PIPE_CONFIGS: EPC } = _d();

  // Floor-match helper
  function floorMatch(obj) {
    const keys = Object.keys(obj).map(Number).sort((a, b) => a - b);
    let match = keys[0];
    for (const k of keys) { if (tonnage >= k) match = k; else break; }
    return match;
  }

  if (equipType === 'vrv') {
    const matchTon = floorMatch(VBC);
    const blended  = calcVRVBlendedPerFt(matchTon, lmePrice, safetyFactor, copperFractionOverride);
    const insulPft = includeInsulation ? (VBINS[matchTon] || 1.25) : 0;
    const totalPft = round2(blended.adjustedPerFt + insulPft);
    return {
      material:       Math.round(totalPft * lenFt),
      perFt:          totalPft,
      copperCost:     Math.round(blended.adjustedPerFt * lenFt),
      insulationCost: Math.round(insulPft * lenFt),
      liquidLine:     null,
      suctionLine:    null,
      avgLengthFt:    lenFt,
      lmeInfo:        getLMEInfo(lmePrice),
      details:        blended,
    };
  }

  const configTable = EPC[equipType];
  if (!configTable) throw new Error(`Unknown equipType: "${equipType}"`);

  const matchTon  = floorMatch(configTable);
  const pipeCfg   = configTable[matchTon];
  const liqResult = calcVRVPipePerFt(pipeCfg.liquid,  copperType, lmePrice, includeInsulation, safetyFactor);
  const sucResult = calcVRVPipePerFt(pipeCfg.suction, copperType, lmePrice, includeInsulation, safetyFactor);

  const liqCost = Math.round(liqResult.totalPerFt * lenFt);
  const sucCost = Math.round(sucResult.totalPerFt * lenFt);

  return {
    material:       liqCost + sucCost,
    perFt:          round2(liqResult.totalPerFt + sucResult.totalPerFt),
    copperCost:     Math.round((liqResult.adjustedCopperPerFt + sucResult.adjustedCopperPerFt) * lenFt),
    insulationCost: Math.round((liqResult.insulationPerFt     + sucResult.insulationPerFt)     * lenFt),
    liquidLine:     { size: pipeCfg.liquid,  perFt: liqResult.totalPerFt, cost: liqCost },
    suctionLine:    { size: pipeCfg.suction, perFt: sucResult.totalPerFt, cost: sucCost },
    avgLengthFt:    lenFt,
    lmeInfo:        getLMEInfo(lmePrice),
    details:        { liquid: liqResult, suction: sucResult },
  };
}


// ──────────────────────────────────────────────────────────────
// 4.  BULK TABLE GENERATORS
// ──────────────────────────────────────────────────────────────

/**
 * Generate a complete pricing table for a lump-sum equipment type
 * (split, wallMounted, or ahuWithCU) at the given parameters.
 *
 * @param {'split'|'wallMounted'|'ahuWithCU'} equipType
 * @param {number} lmePrice
 * @param {number} safetyFactor
 * @param {string} copperType          — 'K' | 'L' | 'M'
 * @param {Object} [copperFractionMap] — optional per-tonnage override map
 * @returns {Object}  keyed by tonnage → { short, long, [copperL|copperRoll] }
 */
function generateLumpSumTable(
  equipType,
  lmePrice,
  safetyFactor,
  copperType = 'L',
  copperFractionMap = {},
) {
  const tonnages = [0, 5, 10, 20, 50, 75];
  const table = {};

  tonnages.forEach(ton => {
    const cfOverride = copperFractionMap[ton] ?? null;

    if (equipType === 'ahuWithCU') {
      table[ton] = {
        short: calcAHUCost(ton, false, copperType, lmePrice, safetyFactor, cfOverride),
        long:  calcAHUCost(ton, true,  copperType, lmePrice, safetyFactor, cfOverride),
      };
    } else {
      table[ton] = {
        copperL: {
          short: calcSplitCost(equipType, ton, false, 'copperL', copperType, lmePrice, safetyFactor, cfOverride),
          long:  calcSplitCost(equipType, ton, true,  'copperL', copperType, lmePrice, safetyFactor, cfOverride),
        },
        copperRoll: {
          short: calcSplitCost(equipType, ton, false, 'copperRoll', copperType, lmePrice, safetyFactor, cfOverride),
          long:  calcSplitCost(equipType, ton, true,  'copperRoll', copperType, lmePrice, safetyFactor, cfOverride),
        },
      };
    }
  });

  return table;
}

/**
 * Generate VRV blended $/ft table for all tonnage brackets.
 *
 * @param {number} lmePrice
 * @param {number} safetyFactor
 * @param {Object} [copperFractionMap]
 * @returns {Object}  keyed by tonnage
 */
function generateVRVBlendedTable(lmePrice, safetyFactor, copperFractionMap = {}) {
  const tonnages = [0, 5, 10, 20, 50, 75];
  const table = {};
  tonnages.forEach(ton => {
    table[ton] = calcVRVBlendedPerFt(
      ton, lmePrice, safetyFactor, copperFractionMap[ton] ?? null,
    );
  });
  return table;
}

/**
 * Generate VRV explicit per-size $/ft table.
 *
 * @param {string}  copperType
 * @param {number}  lmePrice
 * @param {boolean} includeInsulation
 * @param {number}  safetyFactor
 * @returns {Object}  keyed by pipe size string
 */
function generateVRVPipeSizeTable(
  copperType = 'L',
  lmePrice = BASELINE_LME,
  includeInsulation = true,
  safetyFactor = 1.0,
) {
  const { VRV_BASELINE_PRICES_PER_FT: VBP } = _d();
  const table = {};
  Object.keys(VBP).forEach(size => {
    table[size] = calcVRVPipePerFt(size, copperType, lmePrice, includeInsulation, safetyFactor);
  });
  return table;
}


// ──────────────────────────────────────────────────────────────
// 5.  UTILITY FUNCTIONS
// ──────────────────────────────────────────────────────────────

/**
 * Returns the LME change details vs baseline.
 * @param {number} currentLME
 * @returns {{ ratio, percentChange, deltaPerLb }}
 */
function getLMEInfo(currentLME) {
  const ratio = currentLME / BASELINE_LME;
  return {
    currentLME,
    baselineLME:    BASELINE_LME,
    ratio:          round4(ratio),
    percentChange:  round2((ratio - 1) * 100),
    deltaPerLb:     round2(currentLME - BASELINE_LME),
  };
}

/**
 * Round to 2 or 4 decimal places.
 */
function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }


// ──────────────────────────────────────────────────────────────
// 6.  EXPORTS
// ──────────────────────────────────────────────────────────────

module.exports = {
  // ── DB injection (called by copperDataLoader at startup / after admin updates)
  loadTables,

  // ── Primary calculation functions ──────────────────────────
  calcVRVPipePerFt,
  calcVRVBlendedPerFt,
  calcVRVTotalCost,
  calcSplitCost,
  calcAHUCost,
  calcRefrigerantCharge,
  calcManualLengthCost,

  // ── Bulk table generators ──────────────────────────────────
  generateLumpSumTable,
  generateVRVBlendedTable,
  generateVRVPipeSizeTable,

  // ── Utilities ──────────────────────────────────────────────
  getLMEInfo,

  // ── Active reference data getters (always returns live / DB-loaded data) ──
  // Use these instead of the raw constants so you always get DB overrides.
  getActiveTables: _d,

  // ── Hardcoded reference data (for frontend dropdowns / display) ────────────
  PIPE_SIZES:            Object.keys(PIPE_WEIGHTS),
  COPPER_TYPES:          ['K', 'L', 'M'],
  EQUIPMENT_TYPES:       ['split', 'wallMounted', 'vrv', 'ahuWithCU'],
  TONNAGES:              [0, 5, 10, 20, 50, 75],
  PIPE_WEIGHTS,
  INSULATION_COSTS_PER_FT,
  VRV_BASELINE_PRICES_PER_FT,
  BASELINE_LME,
  DEFAULT_PARAMS,
};
