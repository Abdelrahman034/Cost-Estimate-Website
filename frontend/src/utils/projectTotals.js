/**
 * projectTotals.js
 * Lightweight pub/sub + localStorage bridge so every estimating module can
 * push its live totals to the Dashboard without a global state manager.
 *
 * Usage (inside any module, usually in a useMemo/useEffect):
 *   import { saveModuleTotals } from '@utils/projectTotals';
 *   saveModuleTotals('unit_schedule', { totalMaterial: 12000, totalLabor: 8500, totalCost: 20500 });
 *
 * Dashboard (and any other consumer):
 *   import { readAllModuleTotals, subscribeToTotals } from '@utils/projectTotals';
 */

// ─── Module registry (display order) ──────────────────────────────────────────
export const MODULE_META = [
  { key: 'unit_schedule', label: 'Unit Schedule',     color: 'blue',   route: '/unit-schedule' },
  { key: 'metal_duct',    label: 'Metal Duct',        color: 'orange', route: '/duct'          },
  { key: 'diffuser',      label: 'Diffuser Schedule', color: 'green',  route: '/diffuser'      },
  { key: 'fan_schedule',  label: 'Fan Schedule',      color: 'cyan',   route: '/fan-schedule'  },
  { key: 'vav_schedule',  label: 'VAV Schedule',      color: 'purple', route: '/unit-schedule' },
  { key: 'cw_pipe',       label: 'CW Pipe',           color: 'cyan',   route: '/unit-schedule' },
  { key: 'elec_heat',     label: 'Electric Heat',     color: 'red',    route: '/electric-heat' },
];

const LS_PREFIX = 'module_totals_';
const LISTENERS  = new Set();

// ─── Write ────────────────────────────────────────────────────────────────────
/**
 * @param {string} moduleKey   e.g. 'unit_schedule'
 * @param {{ totalMaterial: number, totalLabor: number, totalCost: number }} totals
 */
export function saveModuleTotals(moduleKey, totals) {
  const payload = { ...totals, savedAt: Date.now() };
  try {
    localStorage.setItem(`${LS_PREFIX}${moduleKey}`, JSON.stringify(payload));
  } catch (_) { /* storage quota — ignore */ }
  LISTENERS.forEach(fn => fn());
}

// ─── Read ─────────────────────────────────────────────────────────────────────
/**
 * Returns an array of { key, label, color, route, totalMaterial, totalLabor,
 * totalCost, savedAt } for every registered module.
 * Modules that have never saved will have all cost fields as 0 and savedAt = null.
 */
export function readAllModuleTotals() {
  return MODULE_META.map(meta => {
    try {
      const raw = localStorage.getItem(`${LS_PREFIX}${meta.key}`);
      const data = raw ? JSON.parse(raw) : {};
      return {
        ...meta,
        totalMaterial: data.totalMaterial || 0,
        totalLabor:    data.totalLabor    || 0,
        totalCost:     data.totalCost     || 0,
        savedAt:       data.savedAt       || null,
      };
    } catch (_) {
      return { ...meta, totalMaterial: 0, totalLabor: 0, totalCost: 0, savedAt: null };
    }
  });
}

// ─── Subscribe ────────────────────────────────────────────────────────────────
/** Call callback whenever any module updates its totals. Returns unsubscribe fn. */
export function subscribeToTotals(callback) {
  LISTENERS.add(callback);
  return () => LISTENERS.delete(callback);
}
