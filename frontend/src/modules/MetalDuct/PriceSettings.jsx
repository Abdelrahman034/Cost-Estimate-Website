import React, { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { DUCT_MATERIAL_OPTIONS, GAUGE_THICKNESS_MM, MATERIAL_DENSITY_KG_M3 } from '@utils/ductCalculations';

// Standard unit conversions to feet (no custom factor — these are universally fixed)
const UNIT_OPTIONS = [
  { label: 'Feet (ft)',        value: 'ft', factor: 1.0,                   example: '1 ft = 1 ft'          },
  { label: 'Inches (in)',      value: 'in', factor: 1 / 12,                example: '12 in = 1 ft'         },
  { label: 'Metres (m)',       value: 'm',  factor: 1 / 0.3048,            example: '1 m = 3.281 ft'       },
  { label: 'Centimetres (cm)', value: 'cm', factor: 1 / 30.48,             example: '100 cm = 3.281 ft'    },
  { label: 'Millimetres (mm)', value: 'mm', factor: 1 / 304.8,             example: '1000 mm = 3.281 ft'   },
];

export function getUnitFactor(unit) {
  return UNIT_OPTIONS.find((u) => u.value === unit)?.factor ?? 1.0;
}

/**
 * PriceSettings — Duct pricing configuration panel.
 *
 * Two usage modes:
 *
 *   1. Module inline (MetalDuctModule) — pass `activeProjectId` + `onProjectSave`:
 *      • Button says "Save to Project", disabled when no project is open.
 *      • Saves only to project overrides, never touches global localStorage.
 *
 *   2. Settings page (SettingsPage) — omit `activeProjectId` / `onProjectSave`:
 *      • Button says "Save Settings" (original behaviour).
 *      • Calls onPricesChange + onOverheadChange to persist in localStorage / company config.
 */
export default function PriceSettings({
  prices,
  overhead,
  onPricesChange,
  onOverheadChange,
  onClose,
  /** Optional — when provided, switches to project-scoped save mode */
  activeProjectId,
  onProjectSave,
}) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(prices);
  const [draftOverhead, setDraftOverhead] = useState(overhead);

  const projectMode = typeof onProjectSave === 'function';

  const fetchLivePrices = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/prices/current');
      const p = res.data;
      if (p?.sheetMetal?.galvanizedSteel?.gauge24?.pricePerSqFt) {
        setDraft((prev) => ({
          ...prev,
          sheetMetalCostPerLb: p.sheetMetal.galvanizedSteel.gauge24.pricePerSqFt,
        }));
      }
      if (p?.labor?.sheetMetalWorkerRate) {
        setDraft((prev) => ({
          ...prev,
          laborRate: p.labor.sheetMetalWorkerRate,
        }));
      }
      toast.success('Prices updated from AI');
    } catch {
      toast.error('Could not fetch live prices');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (projectMode) {
      onProjectSave(draft, draftOverhead);
    } else {
      onPricesChange(draft);
      onOverheadChange(draftOverhead);
      toast.success('Settings saved');
    }
    onClose();
  };

  const saveDisabled = projectMode && !activeProjectId;
  const saveLabel    = projectMode ? 'Save to Project' : 'Save Settings';
  const saveTitle    = saveDisabled ? 'Open a project to save duct pricing settings.' : undefined;

  return (
    <div className="card mb-6 border-blue-200 bg-blue-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Prices & Settings</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X size={18} />
        </button>
      </div>

      {/* Project-mode hint */}
      {projectMode && !activeProjectId && (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          Open a project to save duct pricing settings to that project only.
        </div>
      )}

      {/* ── Measurement Unit ── */}
      <div className="mb-5 p-3 rounded-xl bg-white border border-blue-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-3">
          Linear Measurement Unit
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="label">Unit of Measurement</label>
            <select
              className="input"
              value={draft.measureUnit ?? 'ft'}
              onChange={(e) => setDraft((prev) => ({ ...prev, measureUnit: e.target.value }))}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Unit you type into the Linear column</p>
          </div>
          <div className="md:col-span-2 flex items-center">
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200 w-full">
              {(() => {
                const u = UNIT_OPTIONS.find((o) => o.value === (draft.measureUnit ?? 'ft')) ?? UNIT_OPTIONS[0];
                return <span className="text-gray-500">{u.example}</span>;
              })()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="label">Fallback $/lb</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={draft.sheetMetalCostPerLb}
            onChange={(e) => setDraft({ ...draft, sheetMetalCostPerLb: parseFloat(e.target.value) })}
          />
          <p className="text-xs text-gray-400 mt-1">Used if per-material price is missing</p>
        </div>
        <div>
          <label className="label">Sheet Metal Labor ($/ft)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.sheetMetalLaborPerFt}
            onChange={(e) => setDraft({ ...draft, sheetMetalLaborPerFt: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Duct Wrap Material ($/sqft)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={draft.insulationPerSqFt}
            onChange={(e) => setDraft({ ...draft, insulationPerSqFt: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Duct Wrap Labor ($/ft)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={draft.ductWrapLaborPerFt}
            onChange={(e) => setDraft({ ...draft, ductWrapLaborPerFt: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Flex Duct Labor Short ($/run)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.flexDuctLaborShort}
            onChange={(e) => setDraft({ ...draft, flexDuctLaborShort: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Flex Duct Labor Long ($/run)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.flexDuctLaborLong}
            onChange={(e) => setDraft({ ...draft, flexDuctLaborLong: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Offtake Cost ($/run)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.offtakeCost}
            onChange={(e) => setDraft({ ...draft, offtakeCost: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">VD Cost ($/run)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.vdCost}
            onChange={(e) => setDraft({ ...draft, vdCost: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Max Flex Duct Len (ft)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.maxFlexDuctLen}
            onChange={(e) => setDraft({ ...draft, maxFlexDuctLen: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Incidentals - Rect (%)</label>
          <input
            type="number"
            step="1"
            className="input"
            value={Math.round((draft.incidentalsPct ?? 0.20) * 100)}
            onChange={(e) => setDraft({ ...draft, incidentalsPct: parseInt(e.target.value) / 100 })}
          />
          <p className="text-xs text-gray-400 mt-1">Hangers, sealant, hardware (square duct)</p>
        </div>

        <div>
          <label className="label">Incidentals - Round (%)</label>
          <input
            type="number"
            step="1"
            className="input"
            value={Math.round((draft.roundDuctIncidentalsPct ?? 0.25) * 100)}
            onChange={(e) => setDraft({ ...draft, roundDuctIncidentalsPct: parseInt(e.target.value) / 100 })}
          />
          <p className="text-xs text-gray-400 mt-1">Incidentals rate for round duct</p>
        </div>

      </div>

      {/* ── Per-Material Pricing ── */}
      <div className="mt-5 p-3 rounded-xl bg-white border border-blue-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-3">
          Material Pricing ($/lb)
        </p>
        <p className="text-xs text-gray-400 mb-4">
          Thickness &amp; density are fixed ASTM/SMACNA constants. Only the unit price is editable.
        </p>
        <div className="space-y-4">
          {DUCT_MATERIAL_OPTIONS.map((mat) => {
            const thicknessTable = GAUGE_THICKNESS_MM[mat.value] ?? {};
            const density        = MATERIAL_DENSITY_KG_M3[mat.value] ?? 7850;
            const currentPrice   = draft.materialCostPerLb?.[mat.value] ?? 0;
            const GAUGES         = [26, 24, 22, 20, 18];
            const MATERIAL_COLORS = {
              galvanized:   'border-blue-200 bg-blue-50',
              blackSteel:   'border-gray-300 bg-gray-50',
              stainless304: 'border-yellow-200 bg-yellow-50',
              stainless316: 'border-orange-200 bg-orange-50',
              aluminum:     'border-purple-200 bg-purple-50',
            };
            const HEADER_COLORS = {
              galvanized:   'text-blue-700',
              blackSteel:   'text-gray-700',
              stainless304: 'text-yellow-700',
              stainless316: 'text-orange-700',
              aluminum:     'text-purple-700',
            };
            return (
              <div key={mat.value} className={`rounded-xl border p-3 ${MATERIAL_COLORS[mat.value]}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-semibold ${HEADER_COLORS[mat.value]}`}>{mat.label}</span>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">$/lb</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="input text-xs w-24"
                      value={currentPrice}
                      onChange={(e) => setDraft((prev) => ({
                        ...prev,
                        materialCostPerLb: {
                          ...(prev.materialCostPerLb ?? {}),
                          [mat.value]: parseFloat(e.target.value) || 0,
                        },
                      }))}
                    />
                  </div>
                </div>
                {/* Reference thickness table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-gray-500">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-1 font-medium">Gauge</th>
                        {GAUGES.map((g) => (
                          <th key={g} className="text-center py-1 font-medium w-12">{g}</th>
                        ))}
                        <th className="text-right py-1 font-medium">Density</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="py-1 text-gray-400">mm</td>
                        {GAUGES.map((g) => (
                          <td key={g} className="text-center py-1 font-mono">
                            {thicknessTable[g] != null ? thicknessTable[g].toFixed(3) : '—'}
                          </td>
                        ))}
                        <td className="text-right py-1 font-mono">{density.toLocaleString()} kg/m³</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={fetchLivePrices}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Fetching...' : 'Get AI Prices'}
        </button>
        <button
          onClick={handleSave}
          disabled={saveDisabled}
          title={saveTitle}
          className={`btn-primary text-sm ${saveDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
