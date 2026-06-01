// features/modules/moduleRegistry.js
//
// Maps each ModuleType enum value to the corresponding Prisma model delegate.
//
// ── HOW TO ADD A NEW MODULE ───────────────────────────────────────────────────
// 1. Add a new model to prisma/schema.prisma
// 2. Add a migration SQL file under prisma/migrations/
// 3. Add ONE entry to the REGISTRY object below.
// That's it — no other files need to change.
// ─────────────────────────────────────────────────────────────────────────────

const prisma = require('../../prisma/client');

// Keys must match ModuleType enum values (case-insensitive lookup applied below)
const REGISTRY = {
  UNIT_SCHEDULE:    () => prisma.unitScheduleItem,
  METAL_DUCT:       () => prisma.metalDuctItem,
  VAV_SCHEDULE:     () => prisma.vavItem,
  ELECTRIC_HEAT:    () => prisma.electricHeatItem,
  FAN_SCHEDULE:     () => prisma.fanItem,
  LOUVERS_DAMPERS:  () => prisma.louverItem,
  DIFFUSER_SCHEDULE:() => prisma.diffuserItem,
  GENERAL_ITEMS:    () => prisma.generalItem,
};

/**
 * Returns the Prisma model delegate for a given module key.
 * Throws 400 if the module is not registered (unknown module).
 *
 * @param {string} moduleKey  - ModuleType enum value, e.g. "UNIT_SCHEDULE"
 * @returns Prisma model delegate
 */
function getModel(moduleKey) {
  const key = moduleKey?.toUpperCase();
  const factory = REGISTRY[key];
  if (!factory) {
    const err = new Error(
      `Unknown module "${moduleKey}". Registered modules: ${Object.keys(REGISTRY).join(', ')}`
    );
    err.status = 400;
    throw err;
  }
  return factory();
}

/**
 * Returns all registered module keys.
 */
function listModules() {
  return Object.keys(REGISTRY);
}

module.exports = { getModel, listModules };
