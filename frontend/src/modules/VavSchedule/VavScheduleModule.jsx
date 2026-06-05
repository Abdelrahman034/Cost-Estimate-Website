import React, { useState, useCallback, useEffect, useContext } from 'react';
import { Plus, Trash2, Download, Settings2 } from 'lucide-react';
import RowFilterBar from '@components/RowFilterBar';
import BulkTagger from '@components/BulkTagger';
import toast from 'react-hot-toast';
import {
  calculateVavBatch,
  isVavRowFilled,
  DEFAULT_MISC_PCT,
} from '@utils/vavCalculations';
import { saveModuleTotals } from '@utils/projectTotals';
import VavRow from './VavRow';
import VavTotals from './VavTotals';
import { useEstimate } from '@hooks/useEstimate';
import { useAutoSave } from '@hooks/useAutoSave';
import { useModuleKeyboard } from '@hooks/useModuleKeyboard';
import EstimateProjectBanner from '@components/EstimateProjectBanner';
import ModuleTotalsBar from '@components/ModuleTotalsBar';
import { SettingsContext } from '@contexts/SettingsContext';

const DEFAULT_SETTINGS = { miscPct: DEFAULT_MISC_PCT };

let _rowCounter = 1;
const newRow = () => ({
  id:          `vav-${Date.now()}-${_rowCounter++}`,
  building:    '',
  idTag:       '',
  fanCfm:      '',
  dia:         '',
  pricePerCfm: 0,
  unitCost:    0,
  controls:    0,
  other:       0,
  labor:       0,
  notes:       '',
  bidType:     'base',
});

export default function VavScheduleModule() {
  const { pricingConfig, savePricingConfig, activeProjectId } = useContext(SettingsContext);

  const [rows, setRows]       = useState([newRow(), newRow(), newRow()]);
  const [results, setResults] = useState(null);
  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_SETTINGS,
    ...(pricingConfig.vavSettings ?? {}),
  }));
  const [showSettings, setShowSettings] = useState(false);
  const [filterText, setFilterText]     = useState('');

  const {
    projectId, projectName, loadEstimate, saveEstimate,
    saving, lastSaved, saveError, loadError,
  } = useEstimate('VAV_SCHEDULE');

  // ── Auto-save rows ───────────────────────────────────────────────────────
  const { markAsLoaded } = useAutoSave(
    rows,
    () => saveEstimate({ rowsJson: rows }),
    !!projectId,
  );

  useModuleKeyboard({
    onSave:  () => saveEstimate({ rowsJson: rows }),
    isDirty: !!projectId && !lastSaved,
    enabled: !!projectId,
  });

  // Sync settings when pricingConfig changes (project load)
  useEffect(() => {
    setSettings({ ...DEFAULT_SETTINGS, ...(pricingConfig.vavSettings ?? {}) });
  }, [pricingConfig.vavSettings]);

  // Load saved rows from DB when inside a project
  useEffect(() => {
    if (projectId) {
      loadEstimate().then((est) => {
        if (est?.rowsJson && Array.isArray(est.rowsJson) && est.rowsJson.length > 0) {
          setRows(est.rowsJson);
          markAsLoaded(est.rowsJson);
        } else {
          markAsLoaded(null);
        }
      });
    }
  }, [loadEstimate, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calculate + persist totals
  useEffect(() => {
    const filled = rows.filter(isVavRowFilled);
    if (filled.length === 0) { setResults(null); return; }

    const batch = calculateVavBatch(rows, settings);
    setResults(batch);

    saveModuleTotals('vav_schedule', {
      totalMaterial: batch.totals.totalMaterial,
      totalLabor:    batch.totals.totalLabor,
      totalCost:     batch.totals.totalMatPlusLab,
    });

    if (projectId) {
      const _btt = {};
      batch.rows.forEach((r, i) => {
        const bt = rows[i]?.bidType || 'base';
        if (!_btt[bt]) _btt[bt] = { mat: 0, labor: 0, total: 0 };
        _btt[bt].mat   += r.totalMaterial || 0;
        _btt[bt].labor += r.labor         || 0;
        _btt[bt].total += r.matPlusLab    || 0;
      });
      saveEstimate({
        rowsJson:      rows,
        totalMaterial: batch.totals.totalMaterial,
        totalLabor:    batch.totals.totalLabor,
        totalCost:     batch.totals.totalMatPlusLab,
        totalsJson:    { bidTypeTotals: _btt },
      });
    }
  }, [rows, settings, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Row handlers ───────────────────────────────────────────────────────────
  const handleRowChange = useCallback((id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }, []);

  const addRow = () => setRows((prev) => [...prev, newRow()]);

  const applyBulkTags = (prefix, start) => {
    setRows((prev) => prev.map((r, i) => ({ ...r, idTag: `${prefix}${start + i}` })));
  };

  const removeRow = (id) => setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));

  const duplicateRow = (id) => {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.id === id);
      if (idx === -1) return prev;
      const clone = {
        ...JSON.parse(JSON.stringify(prev[idx])),
        id:    `vav-${Date.now()}-${_rowCounter++}`,
        idTag: prev[idx].idTag ? `${prev[idx].idTag} (copy)` : '',
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    toast.success('Row duplicated');
  };

  const clearAll = () => { setRows([newRow()]); setResults(null); };

  const filteredRows = filterText.trim()
    ? rows.filter((r) => {
        const q = filterText.toLowerCase();
        return (r.idTag || '').toLowerCase().includes(q)
          || (r.building || '').toLowerCase().includes(q)
          || (r.notes || '').toLowerCase().includes(q);
      })
    : rows;

  const filledCount = rows.filter(isVavRowFilled).length;

  // ── Export CSV ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!results) return;
    const header = [
      'Building', 'ID', 'Fan CFM', 'Dia', 'Price/CFM', 'Unit Cost $', 'Controls $',
      'Other $', 'Misc Parts $', 'Total Material $', 'Labor $', 'Mat+Lab $', 'Notes',
    ];
    const csvRows = rows.map((r, i) => {
      const res = results.rows[i];
      return [
        r.building, r.idTag, r.fanCfm, r.dia, r.pricePerCfm,
        res?.unitCost ?? 0, res?.controls ?? 0, res?.other ?? 0,
        res?.miscParts ?? 0, res?.totalMaterial ?? 0, res?.labor ?? 0,
        res?.matPlusLab ?? 0, r.notes,
      ].join(',');
    });
    const { totals } = results;
    csvRows.push('');
    csvRows.push([
      'TOTALS', '', totals.totalCfm, '', '',
      totals.totalUnitCost, totals.totalControls, totals.totalOther,
      totals.totalMiscParts, totals.totalMaterial, totals.totalLabor,
      totals.totalMatPlusLab, '',
    ].join(','));
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'vav_schedule.csv';
    a.click();
  };

  return (
    <div className="max-w-full">
      <EstimateProjectBanner
        projectId={projectId} projectName={projectName}
        saving={saving} lastSaved={lastSaved} saveError={saveError} loadError={loadError}
      />
      <ModuleTotalsBar
        label="VAV Schedule"
        material={results?.totals?.totalMaterial}
        labor={results?.totals?.totalLabor}
        total={results?.totals?.totalMatPlusLab}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">VAV Schedule</h1>
          <p className="text-sm text-gray-500 mt-1">
            Variable air volume boxes — material, controls, misc parts &amp; labor
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`btn-secondary flex items-center gap-2 ${showSettings ? 'ring-2 ring-purple-400' : ''}`}
          >
            <Settings2 size={16} />
            Settings
          </button>
          {results && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={16} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="card p-4 mb-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Misc Parts %</label>
            <div className="relative w-28">
              <input
                type="number"
                min="0"
                step="1"
                className="input text-sm pr-6"
                value={Math.round((settings.miscPct ?? DEFAULT_MISC_PCT) * 100)}
                onChange={(e) => setSettings((s) => ({ ...s, miscPct: (parseFloat(e.target.value) || 0) / 100 }))}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
            </div>
            <button
              onClick={async () => {
                try {
                  await savePricingConfig({ vavSettings: { miscPct: settings.miscPct } });
                  toast.success('VAV settings saved to project');
                } catch { toast.error('Could not save VAV settings'); }
              }}
              className="btn-secondary text-sm"
              disabled={!activeProjectId}
            >
              Save to project
            </button>
            <span className="text-xs text-gray-400">Excel: misc parts = (Unit + Controls + Other) × 10%</span>
          </div>
        </div>
      )}

      {/* Config badge */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Config:</span>
        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">
          Misc {Math.round((settings.miscPct ?? DEFAULT_MISC_PCT) * 100)}%
        </span>
        {filledCount > 0 && (
          <span className="text-xs text-gray-400 ml-1">{filledCount} box(es) entered</span>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <RowFilterBar
          value={filterText}
          onChange={setFilterText}
          total={rows.length}
          filtered={filteredRows.length}
          placeholder="Search by tag, building, notes…"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '1300px' }}>
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-20">Building</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">ID</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Fan CFM</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-20">Dia</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Price/CFM</th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Unit Cost $<div className="text-[10px] font-normal text-gray-400">col H</div></th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Controls $<div className="text-[10px] font-normal text-gray-400">col I</div></th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Other $<div className="text-[10px] font-normal text-gray-400">col J</div></th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-24">Misc $<div className="text-[10px] font-normal text-gray-400">col K</div></th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Total Mat $<div className="text-[10px] font-normal text-gray-400">col L</div></th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Labor $<div className="text-[10px] font-normal text-gray-400">col M</div></th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-28">Mat+Lab $<div className="text-[10px] font-normal text-gray-400">col N</div></th>
                <th className="text-left px-3 py-3 font-semibold text-gray-600 w-36">Notes</th>
                <th className="text-center px-2 py-3 font-semibold text-gray-600 w-16">Bid</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const idx = rows.indexOf(row);
                return (
                  <VavRow
                    key={row.id}
                    row={row}
                    result={results?.rows?.[idx]}
                    index={idx}
                    onChange={handleRowChange}
                    onRemove={() => removeRow(row.id)}
                    onDuplicate={() => duplicateRow(row.id)}
                    onAdd={addRow}
                  />
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-4">
          <button
            onClick={addRow}
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            <Plus size={16} /> Add VAV Box
          </button>
          <BulkTagger onApply={applyBulkTags} placeholder="e.g. VAV-" />
        </div>
      </div>

      {results && <VavTotals totals={results.totals} rowCount={filledCount} settings={settings} />}

      <div className="mt-4 flex justify-end">
        <button onClick={clearAll} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
          <Trash2 size={14} /> Clear All
        </button>
      </div>
    </div>
  );
}
