import React from 'react';
import { X, Info, RotateCcw } from 'lucide-react';
import {
  DEFAULT_ROOF_PEN_COST,
  DEFAULT_WALL_PEN_COST,
  DEFAULT_MISC_PCT,
  DEFAULT_LABOR_RATE,
  FAN_TYPES,
  buildDefaultHoursOverrides,
} from '@utils/fanScheduleCalculations';

const SIZES = ['Small', 'Large', 'Enormous'];

/**
 * FanPriceSettings — Fan schedule configuration panel.
 *
 * Overridable settings:
 *   • Labor Rate ($/hr)          — applies to all table cells
 *   • Misc Parts Uplift (%)      — applied to (unit + other cost)
 *   • Roof Penetration Cost ($)
 *   • Wall Penetration Cost ($)
 *   • Labor Hours per Type+Size  — every cell in the table is editable;
 *                                  a ↺ button resets any cell to the Excel default
 *
 * Settings update live via onSettingsChange. Save to Project persists to DB.
 */
export default function FanPriceSettings({ settings, onSettingsChange, onClose, activeProjectId, onProjectSave }) {
  const update = (key, value) => onSettingsChange((prev) => ({ ...prev, [key]: value }));

  // ── Labor hours overrides helpers ──────────────────────────────────────────
  const overrides = settings.laborHoursOverrides ?? buildDefaultHoursOverrides();

  const setHours = (typeId, size, rawVal) => {
    const num = rawVal === '' ? null : parseFloat(rawVal);
    const next = {
      ...overrides,
      [typeId]: { ...(overrides[typeId] ?? {}), [size]: isNaN(num) ? null : num },
    };
    update('laborHoursOverrides', next);
  };

  const resetCell = (typeId, size) => {
    const ft = FAN_TYPES.find((t) => t.id === typeId);
    const original = ft?.hours?.[size] ?? null;
    const next = {
      ...overrides,
      [typeId]: { ...(overrides[typeId] ?? {}), [size]: original },
    };
    update('laborHoursOverrides', next);
  };

  const isCellOverridden = (typeId, size) => {
    const ft   = FAN_TYPES.find((t) => t.id === typeId);
    const orig = ft?.hours?.[size] ?? null;
    const curr = overrides?.[typeId]?.[size] ?? null;
    return curr !== orig;
  };

  // ── Full reset ─────────────────────────────────────────────────────────────
  const resetAll = () =>
    onSettingsChange((prev) => ({
      ...prev,
      roofPenCost:         DEFAULT_ROOF_PEN_COST,
      wallPenCost:         DEFAULT_WALL_PEN_COST,
      miscPct:             DEFAULT_MISC_PCT,
      laborRate:           DEFAULT_LABOR_RATE,
      laborHoursOverrides: buildDefaultHoursOverrides(),
    }));

  const projectMode  = typeof onProjectSave === 'function';
  const saveDisabled = projectMode && !activeProjectId;

  return (
    <div className="card mb-6 border-blue-200 bg-blue-50/40">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-gray-800">Fan Schedule Settings</h3>
        <div className="flex items-center gap-2">
          <button onClick={resetAll} className="text-xs text-gray-500 hover:text-blue-600 underline">
            Reset all to Excel defaults
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {projectMode && !activeProjectId && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          Open a project to save fan settings to that project only.
        </div>
      )}

      {/* ── Rate overrides ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {/* Labor Rate */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Labor Rate ($/hr)</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number" min="0" step="0.5" className="input text-sm pl-5"
              value={settings.laborRate}
              onChange={(e) => update('laborRate', parseFloat(e.target.value) || DEFAULT_LABOR_RATE)}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Excel: ${DEFAULT_LABOR_RATE}/hr (AC3)</p>
        </div>

        {/* Misc Parts % */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Misc Parts Uplift (%)</label>
          <div className="relative">
            <input
              type="number" min="0" max="100" step="1" className="input text-sm pr-6"
              value={Math.round(settings.miscPct * 100)}
              onChange={(e) => update('miscPct', (parseFloat(e.target.value) || 0) / 100)}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Excel: {DEFAULT_MISC_PCT * 100}% of (G+H) (M3)</p>
        </div>

        {/* Roof Penetration */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Roof Penetration ($)</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number" min="0" step="10" className="input text-sm pl-5"
              value={settings.roofPenCost}
              onChange={(e) => update('roofPenCost', parseFloat(e.target.value) || DEFAULT_ROOF_PEN_COST)}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Excel: ${DEFAULT_ROOF_PEN_COST} (T5)</p>
        </div>

        {/* Wall Penetration */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Wall Penetration ($)</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number" min="0" step="10" className="input text-sm pl-5"
              value={settings.wallPenCost}
              onChange={(e) => update('wallPenCost', parseFloat(e.target.value) || DEFAULT_WALL_PEN_COST)}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Excel: ${DEFAULT_WALL_PEN_COST} (T7)</p>
        </div>
      </div>

      {/* ── Labor Hours Table ────────────────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-center gap-1.5 mb-2">
          <Info size={13} className="text-blue-500" />
          <span className="text-xs font-semibold text-gray-600">
            Labor Hours per Type &amp; Size — edit any cell to override the Excel value
          </span>
        </div>
        <p className="text-[10px] text-gray-400 mb-3">
          Shown as <span className="font-semibold">hours</span> — cost = hours × ${settings.laborRate}/hr.
          Orange cells have been changed from the Excel default. Click ↺ to restore a cell.
        </p>

        <div className="overflow-x-auto">
          <table className="text-xs border border-gray-200 rounded-lg overflow-hidden w-full">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-3 py-2 text-left font-semibold w-40">Fan Type</th>
                {SIZES.map((sz) => (
                  <th key={sz} className="px-2 py-2 text-center font-semibold" style={{ width: 160 }}>
                    {sz}
                    <div className="text-[9px] font-normal text-gray-400">hrs &nbsp;→&nbsp; $cost</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FAN_TYPES.map((ft, i) => (
                <tr key={ft.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 text-gray-700 font-medium text-xs">{ft.label}</td>
                  {SIZES.map((sz) => {
                    const excelHrs = ft.hours[sz];          // null = manual-only
                    const currHrs  = overrides?.[ft.id]?.[sz] ?? excelHrs;
                    const overridden = isCellOverridden(ft.id, sz);
                    const cost = currHrs != null ? (currHrs * settings.laborRate) : null;

                    return (
                      <td key={sz} className="px-2 py-1.5 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          {/* Hours input */}
                          <div className="relative">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              placeholder={excelHrs != null ? String(excelHrs) : 'manual'}
                              className={`input text-xs text-center w-16 ${
                                overridden
                                  ? 'border-orange-400 bg-orange-50 text-orange-700 font-semibold'
                                  : 'text-gray-700'
                              }`}
                              value={currHrs ?? ''}
                              onChange={(e) => setHours(ft.id, sz, e.target.value)}
                            />
                          </div>

                          {/* Reset button — only shown when overridden */}
                          {overridden && (
                            <button
                              onClick={() => resetCell(ft.id, sz)}
                              title={`Reset to Excel default: ${excelHrs ?? 'null'} hrs`}
                              className="text-orange-400 hover:text-orange-600 flex-shrink-0"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                        </div>

                        {/* Computed cost display */}
                        <div className={`text-[10px] mt-0.5 font-mono ${
                          overridden ? 'text-orange-500' : 'text-gray-400'
                        }`}>
                          {cost != null
                            ? `$${cost % 1 === 0 ? cost.toLocaleString() : cost.toFixed(0)}`
                            : <span className="italic text-gray-300">manual</span>
                          }
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Save / action bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 pt-3 border-t border-blue-100">
        {projectMode && (
          <button
            onClick={() => onProjectSave(settings)}
            disabled={saveDisabled}
            title={saveDisabled ? 'Open a project to save fan settings.' : undefined}
            className={`btn-primary text-sm ${saveDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Save to Project
          </button>
        )}
        <button onClick={resetAll} className="btn-secondary text-sm flex items-center gap-1.5">
          <RotateCcw size={13} />
          Reset All to Excel
        </button>
      </div>
    </div>
  );
}
