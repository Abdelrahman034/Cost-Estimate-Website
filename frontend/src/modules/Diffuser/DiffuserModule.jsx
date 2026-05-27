import React, { useState, useCallback, useEffect, useContext } from 'react';
import { Plus, Trash2, Download, Settings2, Play } from 'lucide-react';
import { DEMO_DIFFUSER } from '@utils/demoData';
import toast from 'react-hot-toast';
import { calculateDiffuserBatch } from '@utils/diffuserCalculations';
import DiffuserRow from './DiffuserRow';
import DiffuserTotals from './DiffuserTotals';
import DiffuserPriceSettings from './DiffuserPriceSettings';
import { useEstimate } from '@hooks/useEstimate';
import { useAutoSave } from '@hooks/useAutoSave';
import { useSettingsAutoSave } from '@hooks/useSettingsAutoSave';
import EstimateProjectBanner from '@components/EstimateProjectBanner';
import { SettingsContext } from '@contexts/SettingsContext';

// ─── Default per-session settings ────────────────────────────────────────────
// These live locally in the module (not in SettingsContext) because the diffuser
// settings are mode-specific (market vs custom) and include fetched data that
// should not persist globally.
const DEFAULT_SETTINGS = {
  priceMode:    'custom',   // 'market' | 'custom'
  marketPrices: null,       // null until user clicks "Get Market Prices"
  customPrices: {},         // user-entered per-type overrides
  grdRate:      25,         // $/hr — T2 in Excel
  miscPct:      0.10,       // 10%  — J2 in Excel
  frameCost:    25,         // $    — sheetrock frame surcharge
};

// ─── Row factory ─────────────────────────────────────────────────────────────
let _rowCounter = 1;
const newRow = () => ({
  id:           `diff-${Date.now()}-${_rowCounter++}`,
  typeId:       '',
  qty:          '',
  sheetrock:    false,
  quotedPrice:  0,
});

// ─── Build calc settings from module settings ─────────────────────────────────
function buildCalcSettings(settings) {
  const { priceMode, marketPrices, customPrices, grdRate, miscPct, frameCost } = settings;
  return {
    grdRate,
    miscPct,
    frameCost,
    // marketPrices only active in market mode
    marketPrices: priceMode === 'market' ? (marketPrices ?? {}) : {},
  };
}

// ─── Main Module ──────────────────────────────────────────────────────────────
export default function DiffuserModule() {
  const { pricingConfig, savePricingConfig, activeProjectId } = useContext(SettingsContext);

  const [rows, setRows]               = useState([newRow(), newRow(), newRow()]);
  const [results, setResults]         = useState(null);
  // grdRate (grille/diffuser installer $/hr) mirrors the duct labor rate
  const [settings, setSettings]       = useState(() => ({
    ...DEFAULT_SETTINGS,
    grdRate: pricingConfig.rateDuct ?? DEFAULT_SETTINGS.grdRate,
    ...(pricingConfig.diffuserSettings ?? {}),
  }));
  const [showSettings, setShowSettings] = useState(false);
  const { projectId, projectName, loadEstimate, saveEstimate, saving, lastSaved, saveError } = useEstimate('DIFFUSER_SCHEDULE');

  // ── Auto-save rows ─────────────────────────────────────────────────────────
  const { markAsLoaded } = useAutoSave(
    rows,
    () => saveEstimate({ rowsJson: rows }),
    !!projectId,
  );

  // ── Auto-save diffuser settings ────────────────────────────────────────────
  const settingsSnapshotRef = useSettingsAutoSave(settings, activeProjectId, () =>
    savePricingConfig({
      diffuserSettings: {
        customPrices: settings.customPrices,
        miscPct:      settings.miscPct,
        frameCost:    settings.frameCost,
        grdRate:      settings.grdRate,
      },
    }),
  );

  // Sync grdRate + project diffuserSettings when pricingConfig changes (e.g. after project load)
  useEffect(() => {
    const overrides = pricingConfig.diffuserSettings ?? {};
    const newSettings = {
      ...settings,
      grdRate: pricingConfig.rateDuct ?? DEFAULT_SETTINGS.grdRate,
      ...overrides,
    };
    settingsSnapshotRef.current = JSON.stringify(newSettings); // don't count DB-sync as dirty
    setSettings(newSettings);
  }, [pricingConfig.rateDuct, pricingConfig.diffuserSettings]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const saved = localStorage.getItem('demo_diffuser');
        if (saved) {
          const { rows: demoRows } = JSON.parse(saved);
          if (demoRows?.length) setRows(demoRows);
        }
      } catch (_) {}
    }
  }, [loadEstimate, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calculate ───────────────────────────────────────────────────────────────
  const calculate = useCallback(() => {
    const filled = rows.filter((r) => r.typeId && Number(r.qty) > 0);
    if (filled.length === 0) {
      toast.error('Add at least one diffuser type and quantity');
      return;
    }

    // Merge per-row customPrice from settings.customPrices
    const enrichedRows = rows.map((r) => ({
      ...r,
      customPrice: settings.priceMode === 'custom'
        ? (settings.customPrices?.[r.typeId] ?? 0)
        : 0,
    }));

    const calcSettings = buildCalcSettings(settings);
    const batch = calculateDiffuserBatch(enrichedRows, calcSettings);
    setResults(batch);
    toast.success(`Calculated ${filled.length} diffuser line(s)`);
    if (projectId) {
      saveEstimate({
        rowsJson:      rows,
        totalMaterial: batch.totals.totalMat,
        totalLabor:    batch.totals.totalLabor,
        totalCost:     batch.totals.total,
      });
    }
  }, [rows, settings]);

  // ── Row handlers ────────────────────────────────────────────────────────────
  const handleRowChange = useCallback((id, field, value) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (id) => setRows((prev) => prev.filter((r) => r.id !== id));

  const clearAll = () => {
    setRows([newRow()]);
    setResults(null);
  };

  // ── Export CSV ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!results) return;
    const header = ['Type', 'Qty', 'Sheetrock', 'Quoted $', 'Unit Price $', 'Frame $', 'Misc Mat $', 'Labor/Unit $', 'Total Mat $', 'Total Labor $', 'Total $', 'Price Source'];
    const csvRows = results.rows.map((r) =>
      [
        r.typeId,
        r.qty,
        rows.find((row) => row.id === r.id)?.sheetrock ? 'Yes' : 'No',
        rows.find((row) => row.id === r.id)?.quotedPrice || 0,
        r.effectiveUnitPrice,
        r.framePrice,
        r.miscMat,
        r.laborPerUnit,
        r.totalMat,
        r.totalLabor,
        r.total,
        r.priceSource,
      ].join(',')
    );
    const { totals } = results;
    csvRows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
    csvRows.push(['TOTALS', totals.qty, '', '', '', '', '', '', totals.totalMat, totals.totalLabor, totals.total, '']);
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'diffuser_schedule.csv';
    a.click();
  };

  return (
    <div className="max-w-full">
      <EstimateProjectBanner
        projectId={projectId} projectName={projectName}
        saving={saving} lastSaved={lastSaved} saveError={saveError}
      />
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Diffuser Schedule</h1>
          <p className="text-sm text-gray-500 mt-1">
            Grilles, registers &amp; diffusers — material, labour, and direct cost
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`btn-secondary flex items-center gap-2 ${showSettings ? 'ring-2 ring-blue-400' : ''}`}
          >
            <Settings2 size={16} />
            Prices &amp; Settings
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
                  const saved = localStorage.getItem('demo_diffuser');
                  if (saved) {
                    const { rows: demoRows } = JSON.parse(saved);
                    setRows(demoRows); setResults(null);
                    toast.success('Demo diffusers loaded!');
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

      {/* ── Price Settings Panel — project-scoped when a project is open ────── */}
      {showSettings && (
        <DiffuserPriceSettings
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
          activeProjectId={activeProjectId}
          onProjectSave={async (draft) => {
            // Always update local state so UI reflects the change immediately
            setSettings(draft);
            try {
              await savePricingConfig({
                diffuserSettings: {
                  customPrices: draft.customPrices,
                  miscPct:      draft.miscPct,
                  frameCost:    draft.frameCost,
                  grdRate:      draft.grdRate,
                },
              });
              toast.success('Diffuser settings saved to project');
            } catch {
              toast.error('Could not save diffuser settings');
            }
          }}
        />
      )}

      {/* ── Mode badge ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Price source:
        </span>
        {settings.priceMode === 'market' ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
            Market (Greenheck / Titus)
          </span>
        ) : (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
            Custom / Table defaults
          </span>
        )}
        <span className="text-xs text-gray-400 ml-1">
          GRD rate: ${settings.grdRate}/hr · Misc: {Math.round(settings.miscPct * 100)}%
          {settings.frameCost !== 25 && ` · Frame: $${settings.frameCost}`}
        </span>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-56">Type</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-20">Qty</th>
                <th className="text-center px-3 py-3 font-semibold text-gray-600 w-20">Sheetrock</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-32">
                  Quoted $
                  <div className="text-[10px] font-normal text-gray-400 leading-tight">overrides price</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Unit $</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-20">Frame $</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Misc Mat $</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Labor/Unit</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Total Mat</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Total Labor</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Total</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const resultRow = results?.rows?.find((r) => r.id === row.id);
                return (
                  <DiffuserRow
                    key={row.id}
                    row={row}
                    result={resultRow}
                    index={i}
                    onChange={handleRowChange}
                    onRemove={() => removeRow(row.id)}
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
            Add Row
          </button>
        </div>
      </div>

      {/* ── Totals ─────────────────────────────────────────────────────────── */}
      {results && <DiffuserTotals totals={results.totals} />}

      {/* ── Clear ──────────────────────────────────────────────────────────── */}
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
