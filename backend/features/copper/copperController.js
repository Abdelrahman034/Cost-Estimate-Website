'use strict';
/**
 * copperController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Calculation endpoints  (unchanged from original)
 *   POST /api/copper-pricing
 *   POST /api/copper-pricing/vrv-per-size
 *   GET  /api/copper-pricing/tables
 *
 * Admin reference-data endpoints  (new — DB-backed)
 *   GET  /api/copper-pricing/specs              — all pipe specs (DB or hardcoded)
 *   PUT  /api/copper-pricing/specs/:id          — update a pipe spec  [ADMIN]
 *   GET  /api/copper-pricing/equipment-configs  — all equipment configs
 *   PUT  /api/copper-pricing/equipment-configs/:id — update a config  [ADMIN]
 *   POST /api/copper-pricing/restore-defaults   — re-seed from calibrated data [ADMIN]
 * ─────────────────────────────────────────────────────────────────────────────
 */

const prisma          = require('../../prisma/client');
const engine          = require('./copperPricingEngine');
const dataLoader      = require('./copperDataLoader');
const { PIPE_SPECS, EQUIPMENT_CONFIGS } = require('./copperSeedData');

// ─────────────────────────────────────────────────────────────────────────────
// CALCULATION ENDPOINTS (original — unchanged)
// ─────────────────────────────────────────────────────────────────────────────

async function calcCopper(req, res) {
  try {
    const {
      mode              = 'bracket',
      equipType         = 'split',
      tonnage           = 5,
      // mode='manual' params
      avgLengthFt       = null,
      // mode='bracket' params
      isLongRun         = false,
      lineSetType       = 'copperL',
      vrfBlendedTonnage = null,
      indoorUnits       = 1,
      // shared params — sourced from company copperSettings on frontend
      lmePrice              = engine.BASELINE_LME,
      copperType            = 'L',
      safetyFactor          = 1.0,
      includeInsulation     = true,
      copperFractionOverride = null,
    } = req.body;

    const lme  = Number(lmePrice)      || engine.BASELINE_LME;
    const sf   = Number(safetyFactor)  || 1.0;
    const tons = Number(tonnage)       || 5;
    const idu  = Number(indoorUnits)   || 1;
    const cfOv = copperFractionOverride ? Number(copperFractionOverride) : null;

    // ── Mode 1: Manual length ─────────────────────────────────────────────────
    if (mode === 'manual') {
      const runFt   = Number(avgLengthFt) || 0;
      const totalFt = equipType === 'vrv' ? runFt * idu : runFt;

      const result = engine.calcManualLengthCost({
        equipType,
        tonnage:           tons,
        avgLengthFt:       totalFt,
        copperType,
        lmePrice:          lme,
        safetyFactor:      sf,
        includeInsulation: Boolean(includeInsulation),
        copperFractionOverride: cfOv,
      });

      return res.json(result);
    }

    // ── Mode 2: Tonnage bracket (lump-sum) ────────────────────────────────────
    const bracketTons = floorMatchTonnage(tons);
    let result;

    if (equipType === 'vrv') {
      const blendedTons = floorMatchTonnage(Number(vrfBlendedTonnage) || tons);
      const blended     = engine.calcVRVBlendedPerFt(blendedTons, lme, sf, cfOv);
      const runFt       = Number(avgLengthFt) || 0;
      const totalFt     = runFt * idu;
      result = {
        material: Math.round(blended.adjustedPerFt * totalFt),
        perFt:    blended.adjustedPerFt,
        totalFt,
        details:  blended,
        lmeInfo:  engine.getLMEInfo(lme),
      };
    } else if (equipType === 'ahuWithCU') {
      const ahu = engine.calcAHUCost(bracketTons, Boolean(isLongRun), copperType, lme, sf, cfOv);
      result = {
        material: ahu.adjustedTotal,
        perFt:    null,
        details:  ahu,
        lmeInfo:  engine.getLMEInfo(lme),
      };
    } else {
      const type = equipType === 'wallMounted' ? 'wallMounted' : 'split';
      const calc = engine.calcSplitCost(type, bracketTons, Boolean(isLongRun), lineSetType, copperType, lme, sf, cfOv);

      let material = calc.adjustedTotal;
      if (avgLengthFt && Number(avgLengthFt) > 0) {
        const engineAvg = _getEngineAvgLength(type, bracketTons, Boolean(isLongRun));
        if (engineAvg > 0) {
          material = Math.round(calc.adjustedTotal * (Number(avgLengthFt) / engineAvg));
        }
      }
      result = {
        material,
        perFt:   null,
        details: calc,
        lmeInfo: engine.getLMEInfo(lme),
      };
    }

    return res.json(result);
  } catch (err) {
    console.error('[copperController] calcCopper error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function getTables(req, res) {
  // Return the ACTIVE tables (DB or hardcoded) so the frontend always sees
  // the same data the engine is actually using.
  const active = engine.getActiveTables();
  return res.json({
    pipeSize:            engine.PIPE_SIZES,
    copperTypes:         engine.COPPER_TYPES,
    tonnages:            engine.TONNAGES,
    weights:             active.PIPE_WEIGHTS,
    insulation:          active.INSULATION_COSTS_PER_FT,
    baselinePricesPerFt: active.VRV_BASELINE_PRICES_PER_FT,
    baselineLme:         engine.BASELINE_LME,
    defaults:            engine.DEFAULT_PARAMS,
  });
}

function calcVRVPerSize(req, res) {
  try {
    const { copperType = 'L', lmePrice = engine.BASELINE_LME,
            includeInsulation = true, safetyFactor = 1.0 } = req.body;
    const table = engine.generateVRVPipeSizeTable(
      copperType, Number(lmePrice), Boolean(includeInsulation), Number(safetyFactor),
    );
    return res.json({ table, lmeInfo: engine.getLMEInfo(Number(lmePrice)) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — PIPE SPECS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/copper-pricing/specs
 * Returns all pipe specs from the DB (falls back to hardcoded seed data if
 * the table is empty so the frontend always has something to display).
 */
async function getPipeSpecs(req, res) {
  try {
    const rows = await prisma.copperPipeSpec.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    // If DB is empty return the hardcoded seed values so the UI is never blank
    const specs = rows.length > 0 ? rows : PIPE_SPECS.map(s => ({ ...s, id: null, updatedAt: null }));
    return res.json({ specs, source: rows.length > 0 ? 'database' : 'hardcoded' });
  } catch (err) {
    console.error('[copperController] getPipeSpecs error:', err.message);
    // Graceful: return hardcoded data even on DB error
    return res.json({ specs: PIPE_SPECS.map(s => ({ ...s, id: null, updatedAt: null })), source: 'hardcoded' });
  }
}

/**
 * PUT /api/copper-pricing/specs/:id
 * Admin-only: update a single pipe spec.
 * Validates numeric fields and refreshes the engine cache on success.
 */
async function updatePipeSpec(req, res) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin role required to update pipe specifications.' });
    }

    const { id } = req.params;
    const {
      weightKLbPerFt,
      weightLLbPerFt,
      weightMLbPerFt,
      distributionFactor,
      vrvBaselinePricePerFt,
      insulationCostPerFt,
    } = req.body;

    // Validate — all weight / factor fields must be positive numbers
    const numericFields = { weightKLbPerFt, weightLLbPerFt, weightMLbPerFt, distributionFactor, insulationCostPerFt };
    for (const [key, val] of Object.entries(numericFields)) {
      const n = Number(val);
      if (isNaN(n) || n <= 0) return res.status(400).json({ error: `${key} must be a positive number.` });
    }
    if (vrvBaselinePricePerFt !== null && vrvBaselinePricePerFt !== undefined) {
      if (isNaN(Number(vrvBaselinePricePerFt)) || Number(vrvBaselinePricePerFt) < 0) {
        return res.status(400).json({ error: 'vrvBaselinePricePerFt must be a non-negative number or null.' });
      }
    }

    const updated = await prisma.copperPipeSpec.update({
      where: { id },
      data: {
        weightKLbPerFt:        Number(weightKLbPerFt),
        weightLLbPerFt:        Number(weightLLbPerFt),
        weightMLbPerFt:        Number(weightMLbPerFt),
        distributionFactor:    Number(distributionFactor),
        vrvBaselinePricePerFt: vrvBaselinePricePerFt != null ? Number(vrvBaselinePricePerFt) : null,
        insulationCostPerFt:   Number(insulationCostPerFt),
      },
    });

    // Push fresh data into the engine immediately — no restart needed
    await dataLoader.refresh();

    return res.json({ spec: updated, message: 'Pipe spec updated and engine refreshed.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Pipe spec not found.' });
    console.error('[copperController] updatePipeSpec error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — EQUIPMENT CONFIGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/copper-pricing/equipment-configs
 * Returns all equipment configs (with DB source indicator).
 */
async function getEquipmentConfigs(req, res) {
  try {
    const rows = await prisma.copperEquipmentConfig.findMany({
      orderBy: [{ equipType: 'asc' }, { tonnage: 'asc' }],
    });

    const configs = rows.length > 0
      ? rows
      : EQUIPMENT_CONFIGS.map(c => ({ ...c, id: null, updatedAt: null }));
    return res.json({ configs, source: rows.length > 0 ? 'database' : 'hardcoded' });
  } catch (err) {
    console.error('[copperController] getEquipmentConfigs error:', err.message);
    return res.json({
      configs: EQUIPMENT_CONFIGS.map(c => ({ ...c, id: null, updatedAt: null })),
      source: 'hardcoded',
    });
  }
}

/**
 * PUT /api/copper-pricing/equipment-configs/:id
 * Admin-only: update a single equipment config (baseline prices, avg run lengths).
 * Note: pipe size assignments (liquidPipeSize / suctionPipeSize) are intentionally
 * not editable here — those follow ASHRAE recommendations and shouldn't be changed
 * without engineering review.
 */
async function updateEquipmentConfig(req, res) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin role required to update equipment configs.' });
    }

    const { id } = req.params;
    const {
      avgLengthShortFt,
      avgLengthLongFt,
      baselineCopperLShort,
      baselineCopperLLong,
      baselineCopperRollShort,
      baselineCopperRollLong,
      baselineShort,
      baselineLong,
      vrvBasePerFt,
      vrvBlendedWeightPerFt,
      vrvInsulationPerFt,
    } = req.body;

    // Helper: coerce to Decimal or null
    const dec = v => (v != null && v !== '' ? Number(v) : null);
    const pos = (key, v) => {
      const n = dec(v);
      if (n !== null && (isNaN(n) || n < 0)) throw new Error(`${key} must be a non-negative number.`);
      return n;
    };

    const data = {
      avgLengthShortFt:        pos('avgLengthShortFt', avgLengthShortFt),
      avgLengthLongFt:         pos('avgLengthLongFt',  avgLengthLongFt),
      baselineCopperLShort:    pos('baselineCopperLShort',    baselineCopperLShort),
      baselineCopperLLong:     pos('baselineCopperLLong',     baselineCopperLLong),
      baselineCopperRollShort: pos('baselineCopperRollShort', baselineCopperRollShort),
      baselineCopperRollLong:  pos('baselineCopperRollLong',  baselineCopperRollLong),
      baselineShort:           pos('baselineShort', baselineShort),
      baselineLong:            pos('baselineLong',  baselineLong),
      vrvBasePerFt:            pos('vrvBasePerFt',          vrvBasePerFt),
      vrvBlendedWeightPerFt:   pos('vrvBlendedWeightPerFt', vrvBlendedWeightPerFt),
      vrvInsulationPerFt:      pos('vrvInsulationPerFt',    vrvInsulationPerFt),
    };

    const updated = await prisma.copperEquipmentConfig.update({ where: { id }, data });

    await dataLoader.refresh();

    return res.json({ config: updated, message: 'Equipment config updated and engine refreshed.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Equipment config not found.' });
    if (err.message.startsWith('avg') || err.message.startsWith('baseline') || err.message.startsWith('vrv')) {
      return res.status(400).json({ error: err.message });
    }
    console.error('[copperController] updateEquipmentConfig error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN — RESTORE DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/copper-pricing/restore-defaults
 * Admin-only: upsert all hardcoded seed values back into the DB, then
 * refresh the engine.  Useful after accidental price changes.
 */
async function restoreDefaults(req, res) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin role required.' });
    }

    // Upsert all pipe specs
    for (const spec of PIPE_SPECS) {
      await prisma.copperPipeSpec.upsert({
        where:  { nominalSize: spec.nominalSize },
        update: {
          sortOrder:             spec.sortOrder,
          weightKLbPerFt:        spec.weightKLbPerFt,
          weightLLbPerFt:        spec.weightLLbPerFt,
          weightMLbPerFt:        spec.weightMLbPerFt,
          distributionFactor:    spec.distributionFactor,
          vrvBaselinePricePerFt: spec.vrvBaselinePricePerFt,
          insulationCostPerFt:   spec.insulationCostPerFt,
        },
        create: {
          nominalSize:           spec.nominalSize,
          sortOrder:             spec.sortOrder,
          weightKLbPerFt:        spec.weightKLbPerFt,
          weightLLbPerFt:        spec.weightLLbPerFt,
          weightMLbPerFt:        spec.weightMLbPerFt,
          distributionFactor:    spec.distributionFactor,
          vrvBaselinePricePerFt: spec.vrvBaselinePricePerFt,
          insulationCostPerFt:   spec.insulationCostPerFt,
        },
      });
    }

    // Upsert all equipment configs
    for (const cfg of EQUIPMENT_CONFIGS) {
      await prisma.copperEquipmentConfig.upsert({
        where:  { equipType_tonnage: { equipType: cfg.equipType, tonnage: cfg.tonnage } },
        update: {
          liquidPipeSize:          cfg.liquidPipeSize,
          suctionPipeSize:         cfg.suctionPipeSize,
          avgLengthShortFt:        cfg.avgLengthShortFt,
          avgLengthLongFt:         cfg.avgLengthLongFt,
          baselineCopperLShort:    cfg.baselineCopperLShort,
          baselineCopperLLong:     cfg.baselineCopperLLong,
          baselineCopperRollShort: cfg.baselineCopperRollShort,
          baselineCopperRollLong:  cfg.baselineCopperRollLong,
          baselineShort:           cfg.baselineShort,
          baselineLong:            cfg.baselineLong,
          vrvBasePerFt:            cfg.vrvBasePerFt,
          vrvBlendedWeightPerFt:   cfg.vrvBlendedWeightPerFt,
          vrvInsulationPerFt:      cfg.vrvInsulationPerFt,
        },
        create: {
          equipType:               cfg.equipType,
          tonnage:                 cfg.tonnage,
          liquidPipeSize:          cfg.liquidPipeSize,
          suctionPipeSize:         cfg.suctionPipeSize,
          avgLengthShortFt:        cfg.avgLengthShortFt,
          avgLengthLongFt:         cfg.avgLengthLongFt,
          baselineCopperLShort:    cfg.baselineCopperLShort,
          baselineCopperLLong:     cfg.baselineCopperLLong,
          baselineCopperRollShort: cfg.baselineCopperRollShort,
          baselineCopperRollLong:  cfg.baselineCopperRollLong,
          baselineShort:           cfg.baselineShort,
          baselineLong:            cfg.baselineLong,
          vrvBasePerFt:            cfg.vrvBasePerFt,
          vrvBlendedWeightPerFt:   cfg.vrvBlendedWeightPerFt,
          vrvInsulationPerFt:      cfg.vrvInsulationPerFt,
        },
      });
    }

    await dataLoader.refresh();

    return res.json({
      message: 'Calibrated defaults restored successfully.',
      specs:   PIPE_SPECS.length,
      configs: EQUIPMENT_CONFIGS.length,
    });
  } catch (err) {
    console.error('[copperController] restoreDefaults error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const TONNAGE_BRACKETS = [0, 5, 10, 20, 50, 75];

function floorMatchTonnage(tons) {
  let match = TONNAGE_BRACKETS[0];
  for (const k of TONNAGE_BRACKETS) { if (tons >= k) match = k; else break; }
  return match;
}

// Returns assumed avg run length from the active engine tables (DB-aware)
function _getEngineAvgLength(equipType, tonnage, isLongRun) {
  const { EQUIPMENT_PIPE_CONFIGS: EPC } = engine.getActiveTables();
  const tbl  = EPC[equipType] || EPC.split;
  if (!tbl) return 0;
  const keys = Object.keys(tbl).map(Number).sort((a, b) => a - b);
  let match  = keys[0];
  for (const k of keys) { if (tonnage >= k) match = k; else break; }
  const entry = tbl[match];
  if (!entry) return 0;
  return isLongRun ? (entry.avgLengthLong || 0) : (entry.avgLengthShort || 0);
}

module.exports = {
  // Calculation
  calcCopper,
  getTables,
  calcVRVPerSize,
  // Admin — pipe specs
  getPipeSpecs,
  updatePipeSpec,
  // Admin — equipment configs
  getEquipmentConfigs,
  updateEquipmentConfig,
  // Admin — restore
  restoreDefaults,
};
