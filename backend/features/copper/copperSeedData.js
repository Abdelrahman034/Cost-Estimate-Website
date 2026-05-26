'use strict';
/**
 * copperSeedData.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Authoritative seed data for copper_pipe_specs and copper_equipment_configs.
 *
 * All values are IDENTICAL to the hardcoded constants in copperPricingEngine.js
 * — this is intentional. The engine will fall back to its own hardcoded data if
 * the DB is empty, so these two sources must stay in sync.
 *
 * Source of truth for calibration values:
 *   - Pipe weights   : ASTM B88 / B280 standard tables
 *   - Dist. factors  : Grainger ACR retail ÷ (weightL × $4.25) at −10% trade
 *   - VRV prices     : Grainger ACR retail at −10% trade discount, LME $4.25/lb
 *   - Insulation     : Grainger foam pipe insulation list prices
 *   - Baseline prices: Excel workbook Unit Sched tab, calibrated to Grainger
 *
 * LME_BASELINE = $4.25 / lb  (all prices in this table assume this baseline)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── 1. Pipe Specs ─────────────────────────────────────────────────────────────
// One entry per nominal pipe size.
// distributionFactor = GraingerRetail_$/ft / (weightL_lb_per_ft × $4.25)
// vrvBaselinePricePerFt = null for 2-5/8" (no standard VRV price in table)

const PIPE_SPECS = [
  {
    nominalSize:           '3/8"',
    sortOrder:             1,
    weightKLbPerFt:        0.198,
    weightLLbPerFt:        0.145,
    weightMLbPerFt:        0.126,
    // 0.145 × $4.25 × 4.868 = $3.00 ≈ Grainger retail (confirms calibration)
    distributionFactor:    4.868,
    vrvBaselinePricePerFt: 3.00,
    insulationCostPerFt:   1.00,
  },
  {
    nominalSize:           '1/2"',
    sortOrder:             2,
    weightKLbPerFt:        0.269,
    weightLLbPerFt:        0.198,
    weightMLbPerFt:        0.153,
    // 0.198 × $4.25 × 4.753 = $4.00
    distributionFactor:    4.753,
    vrvBaselinePricePerFt: 4.00,
    insulationCostPerFt:   1.00,
  },
  {
    nominalSize:           '5/8"',
    sortOrder:             3,
    weightKLbPerFt:        0.344,
    weightLLbPerFt:        0.285,
    weightMLbPerFt:        0.220,
    // 0.285 × $4.25 × 3.302 = $3.998 ≈ $4.00
    distributionFactor:    3.302,
    vrvBaselinePricePerFt: 4.00,
    insulationCostPerFt:   1.00,
  },
  {
    nominalSize:           '3/4"',
    sortOrder:             4,
    weightKLbPerFt:        0.481,
    weightLLbPerFt:        0.362,
    weightMLbPerFt:        0.285,
    // 0.362 × $4.25 × 3.380 = $5.20
    distributionFactor:    3.380,
    vrvBaselinePricePerFt: 5.20,
    insulationCostPerFt:   1.20,
  },
  {
    nominalSize:           '7/8"',
    sortOrder:             5,
    weightKLbPerFt:        0.641,
    weightLLbPerFt:        0.455,
    weightMLbPerFt:        0.362,
    // 0.455 × $4.25 × 3.930 = $7.596 ≈ $7.60
    distributionFactor:    3.930,
    vrvBaselinePricePerFt: 7.60,
    insulationCostPerFt:   1.25,
  },
  {
    nominalSize:           '1-1/8"',
    sortOrder:             6,
    weightKLbPerFt:        0.839,
    weightLLbPerFt:        0.655,
    weightMLbPerFt:        0.516,
    // 0.655 × $4.25 × 3.413 = $9.50
    distributionFactor:    3.413,
    vrvBaselinePricePerFt: 9.50,
    insulationCostPerFt:   1.50,
  },
  {
    nominalSize:           '1-3/8"',
    sortOrder:             7,
    weightKLbPerFt:        1.040,
    weightLLbPerFt:        0.884,
    weightMLbPerFt:        0.694,
    // 0.884 × $4.25 × 3.445 = $12.94 ≈ $12.88 (interpolated between 1-1/8" and 1-5/8")
    distributionFactor:    3.445,
    vrvBaselinePricePerFt: 12.88,
    insulationCostPerFt:   1.75,
  },
  {
    nominalSize:           '1-5/8"',
    sortOrder:             8,
    weightKLbPerFt:        1.360,
    weightLLbPerFt:        1.140,
    weightMLbPerFt:        0.901,
    // 1.140 × $4.25 × 3.447 = $16.71 ≈ $16.70
    distributionFactor:    3.447,
    vrvBaselinePricePerFt: 16.70,
    insulationCostPerFt:   2.00,
  },
  {
    nominalSize:           '2-1/8"',
    sortOrder:             9,
    weightKLbPerFt:        2.060,
    weightLLbPerFt:        1.750,
    weightMLbPerFt:        1.460,
    // 1.750 × $4.25 × 4.303 = $31.99 ≈ $32.00
    distributionFactor:    4.303,
    vrvBaselinePricePerFt: 32.00,
    insulationCostPerFt:   2.50,
  },
  {
    nominalSize:           '2-5/8"',
    sortOrder:             10,
    weightKLbPerFt:        2.930,
    weightLLbPerFt:        2.480,
    weightMLbPerFt:        2.000,
    // 2.480 × $4.25 × 4.250 = $44.77 (extrapolated; no standard VRV price)
    distributionFactor:    4.250,
    vrvBaselinePricePerFt: null,   // no VRV baseline for this size
    insulationCostPerFt:   3.00,
  },
];

// ── 2. Equipment Configs ──────────────────────────────────────────────────────
// One entry per (equipType × tonnage bracket).
//
// Baseline prices are Grainger-calibrated installed costs at LME $4.25/lb.
// copperL     = hard-drawn / soft Type L straight lengths; field-fabricated
// copperRoll  = pre-made ACR line set; copperRoll = 0.50 × copperL
// avgLengthFt = assumed average run length for that bracket (used in bracket mode)

const EQUIPMENT_CONFIGS = [
  // ── SPLIT SYSTEMS ──────────────────────────────────────────────────────────
  // Pipe configs mirror ASHRAE refrigerant line sizing recommendations.
  // Baseline prices from Excel Unit Sched at LME $4.25/lb, Grainger −10%.
  {
    equipType: 'split', tonnage: 0,
    liquidPipeSize: '3/8"', suctionPipeSize: '1/2"',
    avgLengthShortFt: 15, avgLengthLongFt: 22.5,
    baselineCopperLShort: 1128, baselineCopperLLong: 1692,
    baselineCopperRollShort: 564, baselineCopperRollLong: 846,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'split', tonnage: 5,
    liquidPipeSize: '3/8"', suctionPipeSize: '7/8"',
    avgLengthShortFt: 50, avgLengthLongFt: 75,
    baselineCopperLShort: 1208, baselineCopperLLong: 1812,
    baselineCopperRollShort: 604, baselineCopperRollLong: 906,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'split', tonnage: 10,
    liquidPipeSize: '1/2"', suctionPipeSize: '1-1/8"',
    avgLengthShortFt: 50, avgLengthLongFt: 75,
    baselineCopperLShort: 1208, baselineCopperLLong: 1812,
    baselineCopperRollShort: 604, baselineCopperRollLong: 906,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'split', tonnage: 20,
    liquidPipeSize: '5/8"', suctionPipeSize: '1-3/8"',
    avgLengthShortFt: 65, avgLengthLongFt: 97.5,
    baselineCopperLShort: 3216, baselineCopperLLong: 4824,
    baselineCopperRollShort: 1608, baselineCopperRollLong: 2412,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'split', tonnage: 50,
    liquidPipeSize: '7/8"', suctionPipeSize: '1-5/8"',
    avgLengthShortFt: 80, avgLengthLongFt: 120,
    baselineCopperLShort: 4496, baselineCopperLLong: 6744,
    baselineCopperRollShort: 2248, baselineCopperRollLong: 3372,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'split', tonnage: 75,
    liquidPipeSize: '1-1/8"', suctionPipeSize: '2-1/8"',
    avgLengthShortFt: 90, avgLengthLongFt: 135,
    baselineCopperLShort: 6096, baselineCopperLLong: 9144,
    baselineCopperRollShort: 3048, baselineCopperRollLong: 4572,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },

  // ── WALL MOUNTED (Mini-Split) ─────────────────────────────────────────────
  // Identical pipe configs and baseline prices as split — same refrigerant line
  // sizing recommendations and same Grainger calibration.
  {
    equipType: 'wallMounted', tonnage: 0,
    liquidPipeSize: '3/8"', suctionPipeSize: '1/2"',
    avgLengthShortFt: 15, avgLengthLongFt: 22.5,
    baselineCopperLShort: 1128, baselineCopperLLong: 1692,
    baselineCopperRollShort: 564, baselineCopperRollLong: 846,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'wallMounted', tonnage: 5,
    liquidPipeSize: '3/8"', suctionPipeSize: '7/8"',
    avgLengthShortFt: 50, avgLengthLongFt: 75,
    baselineCopperLShort: 1208, baselineCopperLLong: 1812,
    baselineCopperRollShort: 604, baselineCopperRollLong: 906,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'wallMounted', tonnage: 10,
    liquidPipeSize: '1/2"', suctionPipeSize: '1-1/8"',
    avgLengthShortFt: 50, avgLengthLongFt: 75,
    baselineCopperLShort: 1208, baselineCopperLLong: 1812,
    baselineCopperRollShort: 604, baselineCopperRollLong: 906,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'wallMounted', tonnage: 20,
    liquidPipeSize: '5/8"', suctionPipeSize: '1-3/8"',
    avgLengthShortFt: 65, avgLengthLongFt: 97.5,
    baselineCopperLShort: 3216, baselineCopperLLong: 4824,
    baselineCopperRollShort: 1608, baselineCopperRollLong: 2412,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'wallMounted', tonnage: 50,
    liquidPipeSize: '7/8"', suctionPipeSize: '1-5/8"',
    avgLengthShortFt: 80, avgLengthLongFt: 120,
    baselineCopperLShort: 4496, baselineCopperLLong: 6744,
    baselineCopperRollShort: 2248, baselineCopperRollLong: 3372,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'wallMounted', tonnage: 75,
    liquidPipeSize: '1-1/8"', suctionPipeSize: '2-1/8"',
    avgLengthShortFt: 90, avgLengthLongFt: 135,
    baselineCopperLShort: 6096, baselineCopperLLong: 9144,
    baselineCopperRollShort: 3048, baselineCopperRollLong: 4572,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },

  // ── AHU WITH CONDENSING UNIT ──────────────────────────────────────────────
  // Shorter avg run lengths than split (CU typically adjacent to AHU).
  // Single price category (no copperRoll variant for AHU).
  {
    equipType: 'ahuWithCU', tonnage: 0,
    liquidPipeSize: '3/8"', suctionPipeSize: '3/4"',
    avgLengthShortFt: 10, avgLengthLongFt: 15,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: 360, baselineLong: 540,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'ahuWithCU', tonnage: 5,
    liquidPipeSize: '3/8"', suctionPipeSize: '3/4"',
    avgLengthShortFt: 15, avgLengthLongFt: 22.5,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: 360, baselineLong: 540,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'ahuWithCU', tonnage: 10,
    liquidPipeSize: '1/2"', suctionPipeSize: '7/8"',
    avgLengthShortFt: 20, avgLengthLongFt: 30,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: 440, baselineLong: 660,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'ahuWithCU', tonnage: 20,
    liquidPipeSize: '5/8"', suctionPipeSize: '1-1/8"',
    avgLengthShortFt: 25, avgLengthLongFt: 37.5,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: 520, baselineLong: 780,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'ahuWithCU', tonnage: 50,
    liquidPipeSize: '7/8"', suctionPipeSize: '1-5/8"',
    avgLengthShortFt: 40, avgLengthLongFt: 60,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: 680, baselineLong: 1020,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },
  {
    equipType: 'ahuWithCU', tonnage: 75,
    liquidPipeSize: '1-1/8"', suctionPipeSize: '2-1/8"',
    avgLengthShortFt: 55, avgLengthLongFt: 82.5,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: 880, baselineLong: 1320,
    vrvBasePerFt: null, vrvBlendedWeightPerFt: null, vrvInsulationPerFt: null,
  },

  // ── VRV / VRF SYSTEMS ─────────────────────────────────────────────────────
  // No per-line pipe configs (VRV uses a manifold of branch sizes).
  // vrvBasePerFt        = blended baseline $/ft for all pipes at LME $4.25/lb
  // vrvBlendedWeightPerFt = total lb/ft for LME delta formula
  //   Derivation: weight = basePerFt / (BASELINE_LME × avg_dist_factor_3.597)
  // vrvInsulationPerFt  = weighted-avg insulation across all branch sizes (fixed)
  {
    equipType: 'vrv', tonnage: 0,
    liquidPipeSize: null, suctionPipeSize: null,
    avgLengthShortFt: null, avgLengthLongFt: null,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: 5.200, vrvBlendedWeightPerFt: 0.340, vrvInsulationPerFt: 1.00,
  },
  {
    equipType: 'vrv', tonnage: 5,
    liquidPipeSize: null, suctionPipeSize: null,
    avgLengthShortFt: null, avgLengthLongFt: null,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: 8.125, vrvBlendedWeightPerFt: 0.532, vrvInsulationPerFt: 1.25,
  },
  {
    equipType: 'vrv', tonnage: 10,
    liquidPipeSize: null, suctionPipeSize: null,
    avgLengthShortFt: null, avgLengthLongFt: null,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: 12.090, vrvBlendedWeightPerFt: 0.791, vrvInsulationPerFt: 1.50,
  },
  {
    equipType: 'vrv', tonnage: 20,
    liquidPipeSize: null, suctionPipeSize: null,
    avgLengthShortFt: null, avgLengthLongFt: null,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: 18.330, vrvBlendedWeightPerFt: 1.199, vrvInsulationPerFt: 1.75,
  },
  {
    equipType: 'vrv', tonnage: 50,
    liquidPipeSize: null, suctionPipeSize: null,
    avgLengthShortFt: null, avgLengthLongFt: null,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: 33.280, vrvBlendedWeightPerFt: 2.177, vrvInsulationPerFt: 2.00,
  },
  {
    equipType: 'vrv', tonnage: 75,
    liquidPipeSize: null, suctionPipeSize: null,
    avgLengthShortFt: null, avgLengthLongFt: null,
    baselineCopperLShort: null, baselineCopperLLong: null,
    baselineCopperRollShort: null, baselineCopperRollLong: null,
    baselineShort: null, baselineLong: null,
    vrvBasePerFt: 43.225, vrvBlendedWeightPerFt: 2.828, vrvInsulationPerFt: 2.50,
  },
];

module.exports = { PIPE_SPECS, EQUIPMENT_CONFIGS };
