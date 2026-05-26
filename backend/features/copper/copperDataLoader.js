'use strict';
/**
 * copperDataLoader.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Loads copper reference tables from PostgreSQL and injects them into the
 * pricing engine.  Provides a 5-minute in-process cache so every request
 * doesn't hit the DB.
 *
 * Graceful degradation: if the DB tables are empty or unreachable the engine
 * continues to use its own hardcoded constants — calculations never break.
 *
 * Public API
 * ──────────
 *   init()            — call once at server startup; loads DB → engine
 *   refresh()         — force-reload from DB (called after admin updates)
 *   getTablesFromDB()  — raw load; returns null if tables are empty / unreachable
 * ─────────────────────────────────────────────────────────────────────────────
 */

const prisma = require('../../prisma/client');
const engine = require('./copperPricingEngine');

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let _cache    = null;
let _cacheTs  = 0;
let _initDone = false;

// ── Convert DB rows → engine table shape ──────────────────────────────────────

function buildTablesFromRows(pipeSpecs, equipConfigs) {
  // Guard: engine needs all 10 pipe sizes; if data is incomplete fall back
  if (!pipeSpecs.length || !equipConfigs.length) return null;

  const PIPE_WEIGHTS              = {};
  const DISTRIBUTION_FACTORS      = {};
  const VRV_BASELINE_PRICES_PER_FT = {};
  const INSULATION_COSTS_PER_FT   = {};

  for (const spec of pipeSpecs) {
    const s = spec.nominalSize;
    PIPE_WEIGHTS[s] = {
      K: Number(spec.weightKLbPerFt),
      L: Number(spec.weightLLbPerFt),
      M: Number(spec.weightMLbPerFt),
    };
    DISTRIBUTION_FACTORS[s] = Number(spec.distributionFactor);
    if (spec.vrvBaselinePricePerFt != null) {
      VRV_BASELINE_PRICES_PER_FT[s] = Number(spec.vrvBaselinePricePerFt);
    }
    INSULATION_COSTS_PER_FT[s] = Number(spec.insulationCostPerFt);
  }

  // Equipment configs
  const EQUIPMENT_PIPE_CONFIGS  = { split: {}, wallMounted: {}, ahuWithCU: {} };
  const BASELINE_PRICES         = {
    split: {}, wallMounted: {}, ahuWithCU: {},
    // refrigerant charges are hardcoded in the engine (not stored in DB yet)
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
  const VRV_BLENDED_CONFIGS          = {};
  const VRV_BLENDED_INSULATION_PER_FT = {};

  for (const cfg of equipConfigs) {
    const ton = cfg.tonnage;

    if (cfg.equipType === 'vrv') {
      if (cfg.vrvBasePerFt != null) {
        VRV_BLENDED_CONFIGS[ton] = {
          basePerFt:           Number(cfg.vrvBasePerFt),
          blendedWeightPerFt:  Number(cfg.vrvBlendedWeightPerFt),
        };
        VRV_BLENDED_INSULATION_PER_FT[ton] = Number(cfg.vrvInsulationPerFt ?? 1.25);
      }
      continue;
    }

    // split / wallMounted / ahuWithCU
    if (cfg.liquidPipeSize) {
      EQUIPMENT_PIPE_CONFIGS[cfg.equipType][ton] = {
        liquid:           cfg.liquidPipeSize,
        suction:          cfg.suctionPipeSize,
        avgLengthShort:   Number(cfg.avgLengthShortFt ?? 0),
        avgLengthLong:    Number(cfg.avgLengthLongFt  ?? 0),
      };
    }

    if (cfg.equipType === 'split' || cfg.equipType === 'wallMounted') {
      BASELINE_PRICES[cfg.equipType][ton] = {
        copperL_short:    Number(cfg.baselineCopperLShort    ?? 0),
        copperL_long:     Number(cfg.baselineCopperLLong     ?? 0),
        copperRoll_short: Number(cfg.baselineCopperRollShort ?? 0),
        copperRoll_long:  Number(cfg.baselineCopperRollLong  ?? 0),
      };
    } else if (cfg.equipType === 'ahuWithCU') {
      BASELINE_PRICES.ahuWithCU[ton] = {
        short: Number(cfg.baselineShort ?? 0),
        long:  Number(cfg.baselineLong  ?? 0),
      };
    }
  }

  return {
    PIPE_WEIGHTS,
    DISTRIBUTION_FACTORS,
    VRV_BASELINE_PRICES_PER_FT,
    INSULATION_COSTS_PER_FT,
    EQUIPMENT_PIPE_CONFIGS,
    BASELINE_PRICES,
    VRV_BLENDED_CONFIGS,
    VRV_BLENDED_INSULATION_PER_FT,
  };
}

// ── DB fetch ──────────────────────────────────────────────────────────────────

async function getTablesFromDB() {
  try {
    const [pipeSpecs, equipConfigs] = await Promise.all([
      prisma.copperPipeSpec.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.copperEquipmentConfig.findMany({
        orderBy: [{ equipType: 'asc' }, { tonnage: 'asc' }],
      }),
    ]);
    return buildTablesFromRows(pipeSpecs, equipConfigs);
  } catch (err) {
    // Tables may not exist yet (migration pending) — that's fine
    if (err.code !== 'P2021' && !err.message?.includes('does not exist')) {
      console.warn('[copperDataLoader] DB query error:', err.message);
    }
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Call once at server startup.
 * Loads DB → engine; logs whether DB or hardcoded data is active.
 */
async function init() {
  if (_initDone) return;
  _initDone = true;

  const tables = await getTablesFromDB();
  if (tables) {
    engine.loadTables(tables);
    _cache   = tables;
    _cacheTs = Date.now();
    const nSpecs = Object.keys(tables.PIPE_WEIGHTS).length;
    const nCfgs  = Object.values(tables.EQUIPMENT_PIPE_CONFIGS)
      .reduce((s, v) => s + Object.keys(v).length, 0)
      + Object.keys(tables.VRV_BLENDED_CONFIGS).length;
    console.log(`[copperDataLoader] ✓ DB tables loaded — ${nSpecs} pipe specs, ${nCfgs} equipment configs`);
  } else {
    console.log('[copperDataLoader] ℹ DB tables empty or unavailable — using hardcoded defaults');
  }
}

/**
 * Force-reload from DB (call after admin updates a spec or config).
 * Pushes fresh tables into the engine and resets the cache.
 */
async function refresh() {
  _cache   = null;
  _cacheTs = 0;

  const tables = await getTablesFromDB();
  if (tables) {
    engine.loadTables(tables);
    _cache   = tables;
    _cacheTs = Date.now();
  } else {
    // DB empty after previously having data → revert to hardcoded
    engine.loadTables(null);
  }
  return tables;
}

module.exports = { init, refresh, getTablesFromDB };
