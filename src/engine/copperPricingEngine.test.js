/**
 * copperPricingEngine.test.js
 * ============================================================
 * Verification tests for the copper pricing engine.
 *
 * Run with:   node copperPricingEngine.test.js
 *
 * Each test checks that the engine output at BASELINE_LME matches
 * the original Excel table values (within a ±5 % tolerance, because
 * copperFraction is calibrated — not exact by definition).
 *
 * Sensitivity tests check that price changes make physical sense
 * when LME increases / decreases.
 * ============================================================
 */

'use strict';

const engine = require('./copperPricingEngine');

// ──────────────────────────────────────────────────────────────
// Helper: simple assertion utilities
// ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}  ${detail}`);
    failed++;
  }
}

function assertClose(actual, expected, tolerancePct, label) {
  const pct = Math.abs((actual - expected) / expected) * 100;
  assert(
    pct <= tolerancePct,
    label,
    `actual=${actual}  expected=${expected}  diff=${pct.toFixed(1)}%  tolerance=${tolerancePct}%`,
  );
}

function section(title) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ──────────────────────────────────────────────────────────────
// 1.  VRV Per-Size Pipe Prices — at baseline LME
// ──────────────────────────────────────────────────────────────
section('VRV per-size prices @ baseline LME ($4.25/lb) — no insulation, no safety');

const VRV_ORIGINAL = {
  '3/8"':   3.00,
  '1/2"':   4.00,
  '5/8"':   4.00,
  '3/4"':   5.20,
  '7/8"':   7.60,
  '1-1/8"': 9.50,
  '1-5/8"': 16.70,
  '2-1/8"': 32.00,
};

Object.entries(VRV_ORIGINAL).forEach(([size, expected]) => {
  const result = engine.calcVRVPipePerFt(size, 'L', 4.25, false, 1.0);
  assertClose(result.totalPerFt, expected, 2.0, `VRV pipe ${size} baseline`);
});

// ──────────────────────────────────────────────────────────────
// 2.  VRV Per-Size — sensitivity: LME +25 % ($4.25 → $5.31)
// ──────────────────────────────────────────────────────────────
section('VRV per-size sensitivity: LME +25% → prices rise proportionally to copper weight');

const lmeHigh = 4.25 * 1.25;  // $5.31/lb
['7/8"', '1-1/8"', '2-1/8"'].forEach(size => {
  const base = engine.calcVRVPipePerFt(size, 'L', 4.25,    false, 1.0);
  const high = engine.calcVRVPipePerFt(size, 'L', lmeHigh, false, 1.0);
  const deltaExpected = engine.PIPE_WEIGHTS[size]['L'] * (lmeHigh - 4.25);
  const deltaActual   = high.totalPerFt - base.totalPerFt;
  assertClose(
    deltaActual, deltaExpected, 2.0,
    `VRV ${size}: delta $/ft = weight × ΔLME`,
  );
  assert(
    high.totalPerFt > base.totalPerFt,
    `VRV ${size}: price increases when LME rises`,
  );
});

// ──────────────────────────────────────────────────────────────
// 3.  VRV Per-Size — copper type comparison (K > L > M)
// ──────────────────────────────────────────────────────────────
section('VRV pipe type ordering: K > L > M at same size');

['3/8"', '7/8"', '2-1/8"'].forEach(size => {
  const k = engine.calcVRVPipePerFt(size, 'K', 4.25, false, 1.0).totalPerFt;
  const l = engine.calcVRVPipePerFt(size, 'L', 4.25, false, 1.0).totalPerFt;
  const m = engine.calcVRVPipePerFt(size, 'M', 4.25, false, 1.0).totalPerFt;
  assert(k > l && l > m, `${size}: K(${k}) > L(${l}) > M(${m})`);
});

// ──────────────────────────────────────────────────────────────
// 4.  VRV Blended per-ft — at baseline LME
// ──────────────────────────────────────────────────────────────
section('VRV blended $/ft @ baseline LME — matches original table');

const VRV_BLENDED_ORIGINAL = {
  0:  5.20,
  5:  8.125,
  10: 12.09,
  20: 18.33,
  50: 33.28,
  75: 43.225,
};

engine.TONNAGES.forEach(ton => {
  const result = engine.calcVRVBlendedPerFt(ton, 4.25, 1.0);
  assertClose(
    result.adjustedPerFt, VRV_BLENDED_ORIGINAL[ton], 0.5,
    `VRV blended ${ton}-ton baseline`,
  );
});

// ──────────────────────────────────────────────────────────────
// 5.  Split System prices — at baseline LME
// ──────────────────────────────────────────────────────────────
section('Split System prices @ baseline LME — within ±8% of original table');

// Original table values
const SPLIT_ORIGINAL = {
  0:  { copperL_short: 1128, copperL_long: 1692, copperRoll_short: 564, copperRoll_long: 846 },
  5:  { copperL_short: 1208, copperL_long: 1812, copperRoll_short: 604, copperRoll_long: 906 },
  10: { copperL_short: 1208, copperL_long: 1812, copperRoll_short: 604, copperRoll_long: 906 },
  20: { copperL_short: 3216, copperL_long: 4824, copperRoll_short: 1608, copperRoll_long: 2412 },
  50: { copperL_short: 4496, copperL_long: 6744, copperRoll_short: 2248, copperRoll_long: 3372 },
  75: { copperL_short: 6096, copperL_long: 9144, copperRoll_short: 3048, copperRoll_long: 4572 },
};

engine.TONNAGES.forEach(ton => {
  // At baseline LME, adjustedTotal should ≈ baseline (within copperFraction rounding)
  const cl_s = engine.calcSplitCost('split', ton, false, 'copperL',   'L', 4.25, 1.0);
  const cl_l = engine.calcSplitCost('split', ton, true,  'copperL',   'L', 4.25, 1.0);
  const cr_s = engine.calcSplitCost('split', ton, false, 'copperRoll','L', 4.25, 1.0);
  const cr_l = engine.calcSplitCost('split', ton, true,  'copperRoll','L', 4.25, 1.0);

  assert(cl_s.adjustedTotal === SPLIT_ORIGINAL[ton].copperL_short,
    `Split ${ton}T copperL <100 ft @ baseline`);
  assert(cl_l.adjustedTotal === SPLIT_ORIGINAL[ton].copperL_long,
    `Split ${ton}T copperL ≥100 ft @ baseline`);
  assert(cr_s.adjustedTotal === SPLIT_ORIGINAL[ton].copperRoll_short,
    `Split ${ton}T copperRoll <100 ft @ baseline`);
  assert(cr_l.adjustedTotal === SPLIT_ORIGINAL[ton].copperRoll_long,
    `Split ${ton}T copperRoll ≥100 ft @ baseline`);
});

// ──────────────────────────────────────────────────────────────
// 6.  AHU prices — at baseline LME
// ──────────────────────────────────────────────────────────────
section('AHU with CU prices @ baseline LME');

const AHU_ORIGINAL = {
  0:  { short: 360,  long: 540  },
  5:  { short: 360,  long: 540  },
  10: { short: 440,  long: 660  },
  20: { short: 520,  long: 780  },
  50: { short: 680,  long: 1020 },
  75: { short: 880,  long: 1320 },
};

engine.TONNAGES.forEach(ton => {
  const s = engine.calcAHUCost(ton, false, 'L', 4.25, 1.0);
  const l = engine.calcAHUCost(ton, true,  'L', 4.25, 1.0);
  assert(s.adjustedTotal === AHU_ORIGINAL[ton].short, `AHU ${ton}T short @ baseline`);
  assert(l.adjustedTotal === AHU_ORIGINAL[ton].long,  `AHU ${ton}T long  @ baseline`);
});

// ──────────────────────────────────────────────────────────────
// 7.  Price-direction sanity (LME up → price up, LME down → price down)
// ──────────────────────────────────────────────────────────────
section('Sanity: price monotonically tracks LME direction');

const lmeLow  = 3.00;
const lmeMid  = 4.25;
const lmeHigh2 = 6.00;

engine.TONNAGES.forEach(ton => {
  // Split copperL short
  const lo = engine.calcSplitCost('split', ton, false, 'copperL', 'L', lmeLow,   1.0).adjustedTotal;
  const mi = engine.calcSplitCost('split', ton, false, 'copperL', 'L', lmeMid,   1.0).adjustedTotal;
  const hi = engine.calcSplitCost('split', ton, false, 'copperL', 'L', lmeHigh2, 1.0).adjustedTotal;
  assert(lo <= mi && mi <= hi,
    `Split ${ton}T: $${lo} ≤ $${mi} ≤ $${hi}  (LME $3 → $4.25 → $6)`);

  // AHU
  const alo = engine.calcAHUCost(ton, false, 'L', lmeLow,   1.0).adjustedTotal;
  const ami = engine.calcAHUCost(ton, false, 'L', lmeMid,   1.0).adjustedTotal;
  const ahi = engine.calcAHUCost(ton, false, 'L', lmeHigh2, 1.0).adjustedTotal;
  assert(alo <= ami && ami <= ahi,
    `AHU   ${ton}T: $${alo} ≤ $${ami} ≤ $${ahi}  (LME $3 → $4.25 → $6)`);
});

// ──────────────────────────────────────────────────────────────
// 8.  Safety factor test
// ──────────────────────────────────────────────────────────────
section('Safety factor: 1.10 × produces exactly 10% higher price');

engine.TONNAGES.forEach(ton => {
  const base = engine.calcSplitCost('split', ton, false, 'copperL', 'L', 4.25, 1.00).adjustedTotal;
  const safe = engine.calcSplitCost('split', ton, false, 'copperL', 'L', 4.25, 1.10).adjustedTotal;
  assertClose(safe, base * 1.10, 1.0, `Split ${ton}T: safety 1.10× gives +10%`);
});

// ──────────────────────────────────────────────────────────────
// 9.  Ratio checks: long/short = 1.5×, copperRoll = 0.5× copperL
// ──────────────────────────────────────────────────────────────
section('Structural ratios: long/short=1.5, Roll=0.5×L — hold at any LME');

[4.25, 3.50, 6.00].forEach(lme => {
  engine.TONNAGES.forEach(ton => {
    const cl_s = engine.calcSplitCost('split', ton, false, 'copperL',   'L', lme, 1.0).adjustedTotal;
    const cl_l = engine.calcSplitCost('split', ton, true,  'copperL',   'L', lme, 1.0).adjustedTotal;
    const cr_s = engine.calcSplitCost('split', ton, false, 'copperRoll','L', lme, 1.0).adjustedTotal;
    const cr_l = engine.calcSplitCost('split', ton, true,  'copperRoll','L', lme, 1.0).adjustedTotal;

    assertClose(cl_l, cl_s * 1.5, 2.0, `Split ${ton}T @ LME=${lme}: long/short=1.5`);
    assertClose(cr_s, cl_s * 0.5, 2.0, `Split ${ton}T @ LME=${lme}: roll=0.5×L`);
    assertClose(cr_l, cl_l * 0.5, 2.0, `Split ${ton}T @ LME=${lme}: roll-long=0.5×L-long`);
  });
});

// ──────────────────────────────────────────────────────────────
// 10. getLMEInfo helper
// ──────────────────────────────────────────────────────────────
section('getLMEInfo utility');

const info = engine.getLMEInfo(5.00);
assert(Math.abs(info.percentChange - 17.65) < 0.1, `LME $5.00 → +17.65% vs baseline`);
assert(Math.abs(info.deltaPerLb - 0.75) < 0.01, `Delta = $0.75/lb`);
assert(Math.abs(info.ratio - 1.1765) < 0.001, `Ratio ≈ 1.1765`);

// ──────────────────────────────────────────────────────────────
// 11. Quick demo: real-world scenario
// ──────────────────────────────────────────────────────────────
section('Demo: 10-ton split at LME=$5.50 (current market) vs $4.25 (baseline)');

const demo_base = engine.calcSplitCost('split', 10, false, 'copperL', 'L', 4.25, 1.10);
const demo_new  = engine.calcSplitCost('split', 10, false, 'copperL', 'L', 5.50, 1.10);
console.log(`  Baseline (LME $4.25/lb + 10% safety):  $${demo_base.adjustedTotal.toLocaleString()}`);
console.log(`  At LME $5.50/lb   (+29% LME change):   $${demo_new.adjustedTotal.toLocaleString()}`);
console.log(`  Price delta:                             $${(demo_new.adjustedTotal - demo_base.adjustedTotal).toLocaleString()}`);
console.log(`  Effective price change:                  +${demo_new.priceChangePercent}%`);
console.log(`  Copper fraction used:                    ${(demo_new.copperFraction * 100).toFixed(1)}%`);

section('VRV demo: 7/8" Type L at LME $5.50 with insulation');
const vrv_demo = engine.calcVRVPipePerFt('7/8"', 'L', 5.50, true, 1.15);
console.log(`  Adjusted copper $/ft:  $${vrv_demo.adjustedCopperPerFt}`);
console.log(`  Insulation $/ft:       $${vrv_demo.insulationPerFt}`);
console.log(`  Total $/ft (×1.15):    $${vrv_demo.totalPerFt}`);
console.log(`  (Baseline was $7.60/ft + $1.25 insulation = $8.85/ft × 1.15 = $10.18/ft)`);

// ──────────────────────────────────────────────────────────────
// Results summary
// ──────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`  RESULTS: ${passed} passed  |  ${failed} failed`);
console.log('═'.repeat(60));
if (failed === 0) {
  console.log('  All tests passed ✅\n');
} else {
  console.log(`  ${failed} test(s) failed ❌ — review engine calibration\n`);
  process.exit(1);
}
