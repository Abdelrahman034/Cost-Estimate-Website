import React, { useState, useCallback, useEffect, useContext } from 'react';
import { Plus, Trash2, Download, Settings2, Play } from 'lucide-react';
import { DEMO_FAN_SCHEDULE } from '@utils/demoData';
import toast from 'react-hot-toast';
import {
  calculateFanBatch,
  DEFAULT_ROOF_PEN_COST,
  DEFAULT_WALL_PEN_COST,
  DEFAULT_MISC_PCT,
  DEFAULT_LABOR_RATE,
} from '@utils/fanScheduleCalculations';
import { saveModuleTotals } from '@utils/projectTotals';
import FanRow from './FanRow';
import FanTotals from './FanTotals';
import FanPriceSettings from './FanPriceSettings';
import { useEstimate } from '@hooks/useEstimate';
import EstimateProjectBanner from '@components/EstimateProjectBanner';
import { SettingsContext } from '@contexts/SettingsContext';

// ─── Default settings (mirror Excel config cells) ─────────────────────────────
// laborRate is seeded from pricingConfig at runtime so it reflects company/project settings.
const DEFAULT_SETTINGS = {
  roofPenCost: DEFAULT_ROOF_PEN_COST,   // $T$5 = $100
  wallPenCost: DEFAULT_WALL_PEN_COST,   // $T$7 = $200
  miscPct:     DEFAULT_MISC_PCT,         // $M$3 = 20%
  laborRate:   DEFAULT_LABOR_RATE,       // overridden at init from pricingConfig.rateFan
};

// ─── Row factory ───────────────────────────────────────────────────────────────
let _rowCounter = 1;
const newRow = () => ({
  id:           `fan-${Date.now()}-${_rowCounter++}`,
  tagId:        '',
  cfm:          '',
  fanType:      '',
  sizeCategory: 'Small',
  unitCost:     0,
  otherCost:    0,
  roofPen:      false,
  wallPen:      false,
  laborInput:   0,
  notes:        '',
});

// ─── Main Module ───────────────────────────────────────────────────────────────
export default function FanScheduleModule() {
  const { pricingConfig } = useContext(SettingsContext);

  const [rows, setRows]               = useState([newRow(), newRow(), newRow()]);
  const [results, setResults]         = useState(null);
  // Init laborRate from pricingConfig so it picks up project overrides
  const [settings, setSettings]       = useState(() => ({
    ...DEFAULT_SETTINGS,
    laborRate: pricingConfig.rateFan ?? DEFAULT_LABOR_RATE,
  }));
  const [showSettings, setShowSettings] = useState(false);
  const { projectId, projectName, loadEstimate, saveEstimate, saving, lastSaved, saveError } = useEstimate('FAN_SCHEDULE');

  // Sync laborRate when project settings change
  useEffect(() => {
    setSettings(prev => ({ ...prev, laborRate: pricingConfig.rateFan ?? DEFAULT_LABOR_RATE }));
  }, [pricingConfig.rateFan]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load from DB if in project context, otherwise fall back to demo mode
  useEffect(() => {
    if (projectId) {
      loadEstimate().then(est => {
        if (est?.rowsJson && Array.isArray(est.rowsJson) && est.rowsJson.length > 0) {
          setRows(est.rowsJson);
        }
      });
      return;
    }
    if (localStorage.getItem('demo_mode') === 'true') {
      try {
        const saved = localStorage.getItem('demo_fan_schedule');
        if (saved) {
          const { rows: demoRows } = JSON.parse(saved);
          if (demoRows?.length) setRows(demoRows);
        }
      } catch (_) {}
    }
  }, [loadEstimate, projectId]);

  // ── Auto-push totals to Dashboard whenever results change ──────────────────
  useEffect(() => {
    if (!results) return;
    const { totals } = results;
    saveModuleTotals('fan_schedule', {
      totalMaterial: totals.totalMaterial,
      totalLabor:    totals.totalLaborFinal,
      totalCost:     totals.totalMatPlusLab,
    });
  }, [results]);

  // ── Calculate ──────────────────────────────────────────────────────────────
  const calculate = useCallback(() => {
    const filled = rows.filter((r) => r.fanType);
    if (filled.length === 0) {
      toast.error('Add at least one fan type');
      return;
    }
    const batch = calculateFanBatch(rows, settings);
    setResults(batch);
    toast.success(`Calculated ${filled.length} fan(s)`);
    if (projectId) {
      saveEstimate({
        rowsJson:      rows,
        totalMaterial: batch.totals.totalMaterial,
        totalLabor:    batch.totals.totalLaborFinal,
        totalCost:     batch.totals.totalMatPlusLab,
      });
    }
  }, [rows, settings, projectId, saveEstimate]);

  // ── Row handlers ───────────────────────────────────────────────────────────
  const handleRowChange = useCallback((id, field, value) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, [field]: value } : r));
  }, []);

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const removeRow = (id) => setRows((prev) => {
    if (prev.length <= 1) return prev;
    return prev.filter((r) => r.id !== id);
  });

  const duplicateRow = (id) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const clone = {
        ...JSON.parse(JSON.stringify(original)),
        id:    `fan-${Date.now()}-${_rowCounter++}`,
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
      'Tag', 'CFM', 'Fan Type', 'Size', 'Unit Cost $', 'Other Cost $',
      'Roof Pen', 'Wall Pen', 'Penetrations $', 'Misc Parts $',
      'Total Material $', 'Labor Input $', 'Labor Table $', 'Labor Final $',
      'Mat+Lab $', 'Notes',
    ];
    const csvRows = rows.map((r, i) => {
      const res = results.rows[i];
      return [
        r.tagId, r.cfm, r.fanType, r.sizeCategory,
        r.unitCost, r.otherCost,
        r.roofPen ? 'Yes' : 'No',
        r.wallPen ? 'Yes' : 'No',
        res?.penetrations ?? 0,
        res?.miscParts ?? 0,
        res?.totalMaterial ?? 0,
        res?.laborInput ?? 0,
        res?.laborTable ?? 0,
        res?.laborFinal ?? 0,
        res?.matPlusLab ?? 0,
        r.notes,
      ].join(',');
    });
    const { totals } = results;
    csvRows.push('');
    csvRows.push([
      'TOTALS', '', '', '',
      totals.totalUnitCost, totals.totalOtherCost, '', '',
      totals.totalPenetrations, totals.totalMiscParts,
      totals.totalMaterial, totals.totalLaborInput,
      totals.totalLaborTable, totals.totalLaborFinal,
      totals.totalMatPlusLab, '',
    ].join(','));

    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fan_schedule.csv';
    a.click();
  };

  const filledCount = rows.filter((r) => r.fanType).length;

  return (
    <div className="max-w-full">
      <EstimateProjectBanner
        projectId={projectId} projectName={projectName}
        saving={saving} lastSaved={lastSaved} saveError={saveError}
      />
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fan Schedule</h1>
          <p className="text-sm text-gray-500 mt-1">
            Exhaust, ceiling, inline, roof-mounted &amp; HVLS fans — material, penetrations &amp; labour
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
                  const saved = localStorage.getItem('demo_fan_schedule');
                  if (saved) {
                    const { rows: demoRows } = JSON.parse(saved);
                    setRows(demoRows); setResults(null);
                    toast.success('Demo fans loaded!');
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

      {/* ── Settings Panel ───────────────────────────────────────────────────── */}
      {showSettings && (
        <FanPriceSettings
          settings={settings}
          onSettingsChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* ── Config summary badge ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Config:</span>
        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
          Labor ${settings.laborRate}/hr
        </span>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
          Misc {Math.round(settings.miscPct * 100)}%
        </span>
        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
          Roof pen ${settings.roofPenCost}
        </span>
        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-semibold">
          Wall pen ${settings.wallPenCost}
        </span>
        {filledCount > 0 && (
          <span className="text-xs text-gray-400 ml-1">{filledCount} fan(s) entered</span>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '1400px' }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {/* Input columns */}
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Tag / ID</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">CFM</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-44">Fan Type</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-32">Size</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Unit Cost $
                  <div className="text-[10px] font-normal text-gray-400">col G</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Other Cost $
                  <div className="text-[10px] font-normal text-gray-400">col H</div>
                </th>
                {/* Penetration toggles */}
                <th className="text-center px-3 py-3 font-semibold text-gray-600 w-16">
                  Roof
                  <div className="text-[10px] font-normal text-gray-400">pen</div>
                </th>
                <th className="text-center px-3 py-3 font-semibold text-gray-600 w-16">
                  Wall
                  <div className="text-[10px] font-normal text-gray-400">pen</div>
                </th>
                {/* Computed columns */}
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">
                  Pen $
                  <div className="text-[10px] font-normal text-gray-400">col K</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">
                  Misc $
                  <div className="text-[10px] font-normal text-gray-400">col L</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Total Mat $
                  <div className="text-[10px] font-normal text-gray-400">col M</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Labor Override $
                  <div className="text-[10px] font-normal text-gray-400">col N — blank = table</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Labor Table $
                  <div className="text-[10px] font-normal text-gray-400">col O</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Labor Final $
                  <div className="text-[10px] font-normal text-gray-400">col P</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">
                  Mat+Lab $
                  <div className="text-[10px] font-normal text-gray-400">col Q</div>
                </th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-36">Notes</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const resultRow = results?.rows?.[i];
                return (
                  <FanRow
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
            Add Fan
          </button>
        </div>
      </div>

      {/* ── Totals ──────────────────────────────────────────────────────────── */}
      {results && (
        <FanTotals
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
