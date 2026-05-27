import React from 'react';
import { X, Info } from 'lucide-react';
import {
  DEFAULT_ROOF_PEN_COST,
  DEFAULT_WALL_PEN_COST,
  DEFAULT_MISC_PCT,
  DEFAULT_LABOR_RATE,
  FAN_TYPES,
} from '@utils/fanScheduleCalculations';

/**
 * FanPriceSettings — Fan schedule configuration panel.
 *
 * Settings update live in local state via onSettingsChange.
 * When activeProjectId + onProjectSave are provided, an explicit
 * "Save to Project" button persists the current values to the project.
 */
export default function FanPriceSettings({ settings, onSettingsChange, onClose, activeProjectId, onProjectSave }) {
  const update = (key, value) => onSettingsChange((prev) => ({ ...prev, [key]: value }));

  const reset = () =>
    onSettingsChange({
      roofPenCost: DEFAULT_ROOF_PEN_COST,
      wallPenCost: DEFAULT_WALL_PEN_COST,
      miscPct:     DEFAULT_MISC_PCT,
      laborRate:   DEFAULT_LABOR_RATE,
    });

  const projectMode  = typeof onProjectSave === 'function';
  const saveDisabled = projectMode && !activeProjectId;
  const saveTitle    = saveDisabled ? 'Open a project to save fan settings.' : undefined;

  return (
    <div className="card mb-6 border-blue-200 bg-blue-50/40">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-bold text-gray-800">Fan Schedule Settings</h3>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="text-xs text-gray-500 hover:text-blue-600 underline">
            Reset to Excel defaults
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Project-mode hint */}
      {projectMode && !activeProjectId && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          Open a project to save fan settings to that project only.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        {/* Labor Rate */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Labor Rate ($/hr)
          </label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number"
              min="0"
              step="0.5"
              className="input text-sm pl-5"
              value={settings.laborRate}
              onChange={(e) => update('laborRate', parseFloat(e.target.value) || DEFAULT_LABOR_RATE)}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Excel default: ${DEFAULT_LABOR_RATE}/hr</p>
        </div>

        {/* Misc Parts % */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Misc Parts Uplift (%)
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              className="input text-sm pr-6"
              value={Math.round(settings.miscPct * 100)}
              onChange={(e) =>
                update('miscPct', (parseFloat(e.target.value) || 0) / 100)
              }
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            Excel default: {DEFAULT_MISC_PCT * 100}% of (unit + other cost)
          </p>
        </div>

        {/* Roof Penetration Cost */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Roof Penetration Cost ($)
          </label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number"
              min="0"
              step="10"
              className="input text-sm pl-5"
              value={settings.roofPenCost}
              onChange={(e) =>
                update('roofPenCost', parseFloat(e.target.value) || DEFAULT_ROOF_PEN_COST)
              }
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Excel default: ${DEFAULT_ROOF_PEN_COST}</p>
        </div>

        {/* Wall Penetration Cost */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Wall (Concrete) Penetration ($)
          </label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
            <input
              type="number"
              min="0"
              step="10"
              className="input text-sm pl-5"
              value={settings.wallPenCost}
              onChange={(e) =>
                update('wallPenCost', parseFloat(e.target.value) || DEFAULT_WALL_PEN_COST)
              }
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">Excel default: ${DEFAULT_WALL_PEN_COST}</p>
        </div>
      </div>

      {/* Save to Project button */}
      {projectMode && (
        <div className="mb-4">
          <button
            onClick={() => onProjectSave(settings)}
            disabled={saveDisabled}
            title={saveTitle}
            className={`btn-primary text-sm ${saveDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Save to Project
          </button>
        </div>
      )}

      {/* Labor reference table */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Info size={13} className="text-blue-500" />
          <span className="text-xs font-semibold text-gray-600">
            Labor Hours Table (from Excel — at ${settings.laborRate}/hr)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs border border-gray-200 rounded-lg overflow-hidden w-full max-w-xl">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="px-3 py-2 text-left font-semibold">Fan Type</th>
                <th className="px-3 py-2 text-right font-semibold">Small</th>
                <th className="px-3 py-2 text-right font-semibold">Large</th>
                <th className="px-3 py-2 text-right font-semibold">Enormous</th>
              </tr>
            </thead>
            <tbody>
              {FAN_TYPES.map((ft, i) => (
                <tr key={ft.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-1.5 text-gray-700 font-medium">{ft.label}</td>
                  {['Small', 'Large', 'Enormous'].map((sz) => {
                    const hrs = ft.hours[sz];
                    const cost = hrs != null ? hrs * settings.laborRate : null;
                    return (
                      <td key={sz} className="px-3 py-1.5 text-right font-mono text-gray-600">
                        {cost != null ? (
                          <>
                            <span className="text-blue-700 font-semibold">${cost.toLocaleString()}</span>
                            <span className="text-gray-400 text-[10px] ml-1">({hrs}h)</span>
                          </>
                        ) : (
                          <span className="text-gray-300 italic">manual</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
