import React, { useState, useCallback, useContext, useEffect } from 'react';
import { Plus, Trash2, Download, Settings2, Zap, Play } from 'lucide-react';
import { DEMO_ELEC_HEAT } from '@utils/demoData';
import toast from 'react-hot-toast';
import {
  calculateElectricHeatBatch,
  DEFAULT_MISC_PCT,
} from '@utils/electricHeatCalculations';
import { saveModuleTotals } from '@utils/projectTotals';
import ElectricHeatRow from './ElectricHeatRow';
import ElectricHeatTotals from './ElectricHeatTotals';
import { useEstimate } from '@hooks/useEstimate';
import { useAutoSave } from '@hooks/useAutoSave';
import { useSettingsAutoSave } from '@hooks/useSettingsAutoSave';
import EstimateProjectBanner from '@components/EstimateProjectBanner';
import { SettingsContext } from '@contexts/SettingsContext';

// ─── Default settings ──────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  miscPct: DEFAULT_MISC_PCT,   // $F$2 = 20%
};

// ─── Row factory ───────────────────────────────────────────────────────────────
let _rowCounter = 1;
const newRow = () => ({
  id:       `eh-${Date.now()}-${_rowCounter++}`,
  tagId:    '',
  building: 'A',
  kw:       0,
  unitCost: 0,
  labor:    0,
  notes:    '',
});

// ─── Main Module ───────────────────────────────────────────────────────────────
export default function ElectricHeatModule() {
  const { pricingConfig, savePricingConfig, activeProjectId } = useContext(SettingsContext);

  const [rows, setRows]             = useState([newRow(), newRow(), newRow()]);
  const [results, setResults]       = useState(null);
  const [settings, setSettings]     = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...(pricingConfig.elecHeatSettings ?? {}),
  }));
  const [showSettings, setShowSettings] = useState(false);
  const { projectId, projectName, loadEstimate, saveEstimate, saving, lastSaved, saveError } = useEstimate('ELECTRIC_HEAT');

  // ── Auto-save rows ─────────────────────────────────────────────────────────
  const { markAsLoaded } = useAutoSave(
    rows,
    () => saveEstimate({ rowsJson: rows }),
    !!projectId,
  );

  // ── Auto-save elec heat settings ───────────────────────────────────────────
  const settingsSnapshotRef = useSettingsAutoSave(settings, activeProjectId, () =>
    savePricingConfig({ elecHeatSettings: { miscPct: settings.miscPct } }),
  );

  // Sync elecHeatSettings when pricingConfig changes (e.g. after project load)
  useEffect(() => {
    const overrides = pricingConfig.elecHeatSettings ?? {};
    if (Object.keys(overrides).length > 0) {
      const newSettings = { ...DEFAULT_SETTINGS, ...overrides };
      settingsSnapshotRef.current = JSON.stringify(newSettings); // don't count DB-sync as dirty
      setSettings(newSettings);
    }
  }, [pricingConfig.elecHeatSettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load from DB if in project context, otherwise fall back to demo mode
  useEffect(() => {
    if (projectId) {
      loadEstimate().then(est => {
        if (est?.rowsJson && Array.isArray(est.rowsJson) && est.rowsJson.length > 0) {
          setRows(est.rowsJson);
          markAsLoaded(est.rowsJson);
        } else {
          markAsLoaded(null);
        }
      });
      return;
    }
    if (localStorage.getItem('demo_mode') === 'true') {
      try {
        const saved = localStorage.getItem('demo_elec_heat');
        if (saved) {
          const { rows: demoRows } = JSON.parse(saved);
          if (demoRows?.length) setRows(demoRows);
        }
      } catch (_) {}
    }
  }, [loadEstimate, projectId]);

  // ── Auto-push totals to Dashboard ─────────────────────────────────────────
  useEffect(() => {
    if (!results) return;
    const { totals } = results;
    saveModuleTotals('elec_heat', {
      totalMaterial: totals.totalMaterial,
      totalLabor:    totals.totalLabor,
      totalCost:     totals.totalMatPlusLab,
    });
  }, [results]);

  // ── Calculate ──────────────────────────────────────────────────────────────
  const calculate = useCallback(() => {
    const filled = rows.filter((r) => parseFloat(r.unitCost) > 0 || parseFloat(r.labor) > 0);
    if (filled.length === 0) {
      toast.error('Enter at least one unit cost or labor value');
      return;
    }
    const batch = calculateElectricHeatBatch(rows, settings);
    setResults(batch);
    toast.success(`Calculated ${filled.length} heater(s)`);
    if (projectId) {
      saveEstimate({
        rowsJson:      rows,
        totalMaterial: batch.totals.totalMaterial,
        totalLabor:    batch.totals.totalLabor,
        totalCost:     batch.totals.totalMatPlusLab,
      });
    }
  }, [rows, settings, projectId, saveEstimate]);

  // ── Row handlers ───────────────────────────────────────────────────────────
  const handleRowChange = useCallback((id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }, []);

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (id) =>
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));

  const duplicateRow = (id) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const clone = {
        ...JSON.parse(JSON.stringify(original)),
        id:    `eh-${Date.now()}-${_rowCounter++}`,
        tagId: original.tagId ? `${original.tagId} (copy)` : '',
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    toast.success('Row duplicated');
  };

  const clearAll = () => {
    setRows([newRow()]);
    setResults(null);
  };

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!results) return;
    const header = [
      'Item', 'Tag / ID', 'Building', 'KW', 'Unit Cost $',
      'Misc Parts $', 'Total Material $', 'Labor $', 'Mat+Lab $', 'Notes',
    ];
    const csvRows = rows.map((r, i) => {
      const res = results.rows[i];
      return [
        i + 1, r.tagId, r.building, r.kw,
        r.unitCost,
        res?.miscParts    ?? 0,
        res?.totalMaterial ?? 0,
        r.labor,
        res?.matPlusLab   ?? 0,
        r.notes,
      ].join(',');
    });
    const { totals } = results;
    csvRows.push('');
    csvRows.push([
      'TOTALS', '', '', totals.totalKw,
      totals.totalUnitCost, totals.totalMiscParts,
      totals.totalMaterial, totals.totalLabor,
      totals.totalMatPlusLab, '',
    ].join(','));

    const csv  = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = 'electric_heat_schedule.csv';
    a.click();
  };

  const filledCount = rows.filter(
    (r) => parseFloat(r.unitCost) > 0 || parseFloat(r.labor) > 0,
  ).length;

  return (
    <div className="max-w-full">

      <EstimateProjectBanner
        projectId={projectId} projectName={projectName}
        saving={saving} lastSaved={lastSaved} saveError={saveError}
      />
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Zap size={22} className="text-red-500" />
            Electric Unit Heater Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Electric resistance unit heaters — material, misc parts &amp; labour
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`btn-secondary flex items-center gap-2 ${showSettings ? 'ring-2 ring-blue-400' : ''}`}
          >
            <Settings2 size={16} />
            Settings
          </button>
          {results && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={16} />
              Export CSV
            </button>
          )}
          {localStorage.getItem('demo_mode') === 'true' && (
            <button
              onClick={() => {
                try {
                  const saved = localStorage.getItem('demo_elec_heat');
                  if (saved) {
                    const { rows: demoRows } = JSON.parse(saved);
                    setRows(demoRows); setResults(null);
                    toast.success('Demo heaters loaded!');
                  }
                } catch (_) { toast.error('Could not load demo data'); }
              }}
              className="btn-secondary flex items-center gap-2 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
            >
              <Play size={16} /> Load Demo
            </button>
          )}
          <button onClick={calculate} className="btn-primary flex items-center gap-2 px-6">
            Calculate
          </button>
        </div>
      </div>

      {/* ── Settings panel — project-scoped when a project is open ─────────── */}
      {showSettings && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 text-sm">Settings</h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>

          {/* Amber hint when no project open */}
          {!activeProjectId && (
            <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              Open a project to save heater settings to that project only.
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap mb-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              Misc Parts %
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  className="input text-sm w-20 pr-7"
                  value={Math.round(settings.miscPct * 100)}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      miscPct: (parseFloat(e.target.value) || 0) / 100,
                    }))
                  }
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
              </div>
              <span className="text-xs text-gray-400">
                (Excel cell $F$2, default 20%)
              </span>
            </label>
          </div>

          {/* Save to Project button */}
          <button
            disabled={!activeProjectId}
            title={!activeProjectId ? 'Open a project to save heater settings.' : undefined}
            onClick={async () => {
              try {
                await savePricingConfig({ elecHeatSettings: { miscPct: settings.miscPct } });
                toast.success('Heater settings saved to project');
              } catch {
                toast.error('Could not save heater settings');
              }
            }}
            className={`btn-primary text-sm ${!activeProjectId ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Save to Project
          </button>
        </div>
      )}

      {/* ── Config badge ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Config:</span>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
          Misc Parts {Math.round(settings.miscPct * 100)}%
        </span>
        {filledCount > 0 && (
          <span className="text-xs text-gray-400 ml-1">{filledCount} heater(s) entered</span>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '1000px' }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-center px-3 py-3 font-semibold text-gray-600 w-12">#</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Tag / ID</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Building</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">
                  KW
                  <div className="text-[10px] font-normal text-gray-400">col D</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Unit Cost $
                  <div className="text-[10px] font-normal text-gray-400">col E</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Misc Parts $
                  <div className="text-[10px] font-normal text-gray-400">col F = E×{Math.round(settings.miscPct * 100)}%</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Total Material $
                  <div className="text-[10px] font-normal text-gray-400">col G = E+F</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Labor $
                  <div className="text-[10px] font-normal text-gray-400">col H</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Mat+Lab $
                  <div className="text-[10px] font-normal text-gray-400">col I = G+H</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-36">Notes</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const resultRow = results?.rows?.[i];
                return (
                  <ElectricHeatRow
                    key={row.id}
                    row={row}
                    result={resultRow}
                    index={i}
                    onChange={handleRowChange}
                    onRemove={() => removeRow(row.id)}
                    onDuplicate={() => duplicateRow(row.id)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={addRow}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus size={16} />
            Add Heater
          </button>
        </div>
      </div>

      {/* ── Totals ──────────────────────────────────────────────────────────── */}
      {results && (
        <ElectricHeatTotals
          totals={results.totals}
          rowCount={filledCount}
          settings={settings}
        />
      )}

      {/* ── Clear ───────────────────────────────────────────────────────────── */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={clearAll}
          className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1"
        >
          <Trash2 size={14} /> Clear All
        </button>
      </div>
    </div>
  );
}
