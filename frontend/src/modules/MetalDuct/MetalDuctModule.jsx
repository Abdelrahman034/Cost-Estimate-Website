import React, { useState, useCallback, useContext, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, Info, Play, Settings2, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { ductApi } from '@services/api';
import DuctRow from './DuctRow';
import DuctTotals from './DuctTotals';
import PriceSettings from './PriceSettings';
import { SettingsContext } from '@contexts/SettingsContext';
import { DEMO_METAL_DUCT } from '@utils/demoData';
import { useEstimate } from '@hooks/useEstimate';
import { useAutoSave } from '@hooks/useAutoSave';
import { useModuleKeyboard } from '@hooks/useModuleKeyboard';
import { useSettingsAutoSave } from '@hooks/useSettingsAutoSave';
import EstimateProjectBanner from '@components/EstimateProjectBanner';
import ModuleTotalsBar from '@components/ModuleTotalsBar';
import RowFilterBar from '@components/RowFilterBar';
import BidTypePill from '@components/BidTypePill';

const DEFAULT_PRICES = {
  sheetMetalCostPerLb: 4.00,
  laborRate: 68.00,
  insulationPerSqFt: 0.85,
};

const newRow = (id) => ({
  id,
  size: '',
  linearFeet: '',
  ductMaterial: 'galvanized',
  ductType: 'supply',
  fittings: [],
  insulated: false,
  internalInsulation: false,
  flexDuct: false,
  vd: false,
  offtake: false,
  difficultyFactor: 1.0,
  wasteFactor: 0.10,
  notes: '',
  bidType: 'base',
});

const TEST_ROWS = [
  {
    id: 'test-row-1',
    size: '24x12',
    linearFeet: 18,
    ductMaterial: 'galvanized',
    ductType: 'supply',
    fittings: [],
    insulated: true,
    internalInsulation: false,
    flexDuct: false,
    vd: true,
    offtake: false,
    difficultyFactor: 1.0,
    wasteFactor: 0.10,
    notes: 'Rectangular supply trunk test',
  },
  {
    id: 'test-row-2',
    size: '18x10',
    linearFeet: 12,
    ductMaterial: 'galvanized',
    ductType: 'return',
    fittings: [],
    insulated: false,
    internalInsulation: true,
    flexDuct: false,
    vd: false,
    offtake: true,
    difficultyFactor: 1.15,
    wasteFactor: 0.10,
    notes: 'Rectangular return with internal insulation',
  },
  {
    id: 'test-row-3',
    size: '12',
    linearFeet: 10,
    ductMaterial: 'galvanized',
    ductType: 'exhaust',
    fittings: [],
    insulated: false,
    internalInsulation: false,
    flexDuct: true,
    vd: false,
    offtake: false,
    difficultyFactor: 1.0,
    wasteFactor: 0.10,
    notes: 'Round duct flex connection test',
  },
  {
    id: 'test-row-4',
    size: '10x8',
    linearFeet: 8,
    ductMaterial: 'galvanized',
    ductType: 'oa',
    fittings: [],
    insulated: true,
    internalInsulation: false,
    flexDuct: false,
    vd: false,
    offtake: true,
    difficultyFactor: 1.25,
    wasteFactor: 0.10,
    notes: 'Outside air run with wrap and offtake',
  },
];

export default function MetalDuctModule() {
  const [rows, setRows] = useState([newRow('row-1'), newRow('row-2'), newRow('row-3')]);
  const [showSettings, setShowSettings] = useState(false);
  const {
    prices, setPrices,
    overhead, setOverhead,
    pricingConfig, savePricingConfig,
    activeProjectId,
  } = useContext(SettingsContext);

  // Project overrides win over localStorage for calculations
  const effectivePrices = { ...prices, ...(pricingConfig?.ductPrices ?? {}) };

  const { projectId, projectName, loadEstimate, saveEstimate, saving, lastSaved, saveError, loadError } = useEstimate('METAL_DUCT');

  // ── Auto-save rows (rowsJson only — totals saved by auto-calc effect below) ─
  const { markAsLoaded } = useAutoSave(
    rows,
    () => saveEstimate({ rowsJson: rows }),
    !!projectId,
    500, // short delay — auto-calc fires at 2s and saves everything including totals
  );

  // ── Keyboard shortcuts + unsaved changes warning ─────────────────────────
  useModuleKeyboard({
    onSave:  () => saveEstimate({ rowsJson: rows }),
    isDirty: !!projectId && !lastSaved,
    enabled: !!projectId,
  });


  // ── Auto-save duct prices when they change (project layer only) ───────────
  // We watch `prices` (the value that setPrices writes) via `pricingConfig.ductPrices`.
  // `effectivePrices` is always a new object so we use `pricingConfig.ductPrices` directly.
  useSettingsAutoSave(pricingConfig.ductPrices ?? prices, activeProjectId, () =>
    savePricingConfig({ ductPrices: prices }),
  );

  // Load from DB if in project context, otherwise fall back to demo mode
  useEffect(() => {
    if (projectId) {
      loadEstimate().then(est => {
        if (est?.rowsJson && Array.isArray(est.rowsJson) && est.rowsJson.length > 0) {
          setRows(est.rowsJson);
          markAsLoaded(est.rowsJson); // prevent auto-save of just-loaded data
          // Auto-calculate so results are visible immediately on navigation return
          setTimeout(() => calculateFromRows(est.rowsJson), 100);
        } else {
          markAsLoaded(null); // no DB data yet — mark load complete
        }
      });
      return;
    }
    if (localStorage.getItem('demo_mode') === 'true') {
      try {
        const saved = localStorage.getItem('demo_metal_duct');
        if (saved) {
          const { rows: demoRows } = JSON.parse(saved);
          if (demoRows?.length) setRows(demoRows);
        }
      } catch (_) {}
    }
  }, [loadEstimate, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced auto-calculate on row changes ────────────────────────────────
  const autoCalcTimer = useRef(null);
  useEffect(() => {
    const valid = rows.filter((r) => r.size && r.linearFeet);
    if (valid.length === 0) { setResults(null); return; }
    if (autoCalcTimer.current) clearTimeout(autoCalcTimer.current);
    autoCalcTimer.current = setTimeout(async () => {
      const result = await calculateFromRows(rows);
      if (result && projectId) {

          const _btt = {};
          (result.rows || []).forEach((r) => {
            const src = rows.find(row => row.id === r.id);
            const bt = src?.bidType || 'base';
            if (!_btt[bt]) _btt[bt] = { mat: 0, labor: 0, total: 0 };
            _btt[bt].mat   += r.totalMaterialCost || 0;
            _btt[bt].labor += r.laborCost || 0;
            _btt[bt].total += r.totalCost || 0;
          });
          saveEstimate({
          rowsJson:         rows,
          totalMaterial:    result.totals.materialCost,
          totalLabor:       result.totals.laborCost,
          totalCost:        result.totals.totalCost,
          totalHours:       result.totals.laborHours,
          totalsJson:       { totalWeight: result.totals.weight, totalSurfaceArea: result.totals.surfaceArea, bidTypeTotals: _btt },
        });
      }
    }, 2000);
    return () => clearTimeout(autoCalcTimer.current);
  }, [rows, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const UNIT_TO_FT = { ft: 1.0, in: 1 / 12, m: 1 / 0.3048, cm: 1 / 30.48, mm: 1 / 304.8 };
  const unitLabel = effectivePrices.measureUnit ?? 'ft';
  const scaleFactor = UNIT_TO_FT[unitLabel] ?? 1.0;
  const showScaleHint = unitLabel !== 'ft';

  const handleUnitChange = (unit) => {
    setPrices({ ...prices, measureUnit: unit });
  };

  const [results, setResults] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // All cost math runs on the backend. The frontend only handles UI state.
  const calculateFromRows = useCallback(async (sourceRows) => {
    const validRows = sourceRows.filter((r) => r.size && r.linearFeet);
    if (validRows.length === 0) {
      toast.error('Add at least one duct size and linear feet');
      return null;
    }

    setCalculating(true);
    try {
      const { data: result } = await ductApi.calculate(validRows, effectivePrices);
      // Profit/markup is applied globally in a separate page — not here.
      setResults(result);
      return result;
    } catch (err) {
      toast.error('Calculation error: ' + (err.response?.data?.error || err.message));
      return null;
    } finally {
      setCalculating(false);
    }
  }, [effectivePrices]); // eslint-disable-line react-hooks/exhaustive-deps

  const [filterText, setFilterText] = useState('');
  const filteredRows = filterText.trim()
    ? rows.filter((r) => {
        const q = filterText.toLowerCase();
        return (r.size || '').toLowerCase().includes(q)
          || (r.ductType || '').toLowerCase().includes(q)
          || (r.ductMaterial || '').toLowerCase().includes(q)
          || (r.notes || '').toLowerCase().includes(q);
      })
    : rows;

  const toggleAllAccessory = (field) => {
    // If all non-disabled rows already have it on, turn all off; otherwise turn all on
    const eligible = field === 'flexDuct'
      ? rows.filter((r) => {
          const s = (r.size || '').toLowerCase();
          return !s.includes('x') && !s.includes('*');
        })
      : rows;
    const allOn = eligible.length > 0 && eligible.every((r) => r[field]);
    const nextVal = !allOn;
    setRows((prev) => prev.map((r) => {
      if (field === 'flexDuct') {
        const s = (r.size || '').toLowerCase();
        if (s.includes('x') || s.includes('*')) return r; // skip rectangular
      }
      return { ...r, [field]: nextVal };
    }));
  };

  const handleRowChange = useCallback((id, field, value) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };
      // If the size changes to rectangular, clear the flex flag (flex is round-only)
      if (field === 'size') {
        const isRect = value.includes('x') || value.includes('X') || value.includes('*');
        if (isRect) updated.flexDuct = false;
      }
      return updated;
    }));
  }, []);

  const addRow = () => {
    setRows((prev) => [...prev, newRow(`row-${Date.now()}`)]);
  };

  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const calculate = async () => {
    const result = await calculateFromRows(rows);
    if (result && projectId) {
      const _btt = {};
      (result.rows || []).forEach((r) => {
        const src = rows.find(row => row.id === r.id);
        const bt = src?.bidType || 'base';
        if (!_btt[bt]) _btt[bt] = { mat: 0, labor: 0, total: 0 };
        _btt[bt].mat   += r.totalMaterialCost || 0;
        _btt[bt].labor += r.laborCost || 0;
        _btt[bt].total += r.totalCost || 0;
      });
      saveEstimate({
        rowsJson:      rows,
        totalMaterial: result.totals.materialCost,
        totalLabor:    result.totals.laborCost,
        totalCost:     result.totals.totalCost,
        totalHours:    result.totals.laborHours,
        totalsJson:    {
          totalWeight:      result.totals.weight,
          totalSurfaceArea: result.totals.surfaceArea,
          bidTypeTotals:    _btt,
        },
      });
    }
  };

  const loadTestData = () => {
    setRows(TEST_ROWS);
    setResults(null);
    toast.success('Loaded test duct data');
    // Auto-calculate immediately so result columns populate
    setTimeout(() => calculateFromRows(TEST_ROWS), 50);
  };

  const clearAll = () => {
    setRows([newRow('row-1')]);
    setResults(null);
  };

  const exportCSV = () => {
    if (!results) return;
    const header = ['Size', 'LF', 'Shape', 'Gauge', 'Sq Ft', 'Weight (lb)', 'Labor Hrs', 'Material $', 'Labor $', 'Total $'];
    const csvRows = results.rows.map((r) =>
      [r.size, r.linearFeet, r.shape, r.gauge, r.surfaceAreaWithWaste, r.weight, r.laborHours, r.totalMaterialCost, r.laborCost, r.totalCost].join(',')
    );
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'duct_estimate.csv';
    a.click();
  };

  return (
    <div className="max-w-full">
      <EstimateProjectBanner
        projectId={projectId} projectName={projectName}
        saving={saving} lastSaved={lastSaved} saveError={saveError} loadError={loadError}
      />
      <ModuleTotalsBar
        label="Metal Duct"
        material={results?.totals?.materialCost}
        labor={results?.totals?.laborCost}
        hours={results?.totals?.laborHours}
        total={results?.totals?.totalCost}
      />
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Metal Duct Estimator</h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter duct sizes and lengths to calculate material, labor, and total cost
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTestData}
            className="btn-secondary flex items-center gap-2"
          >
            <Info size={16} />
            Load Test Data
          </button>
          {localStorage.getItem('demo_mode') === 'true' && (
            <button
              onClick={() => {
                try {
                  const saved = localStorage.getItem('demo_metal_duct');
                  if (saved) {
                    const { rows: demoRows } = JSON.parse(saved);
                    setRows(demoRows);
                    setResults(null);
                    toast.success('Demo data loaded — click Calculate to run!');
                    setTimeout(() => calculateFromRows(demoRows), 80);
                  }
                } catch (_) { toast.error('Could not load demo data'); }
              }}
              disabled={calculating}
              className="btn-secondary flex items-center gap-2 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
            >
              <Play size={16} />
              Load Demo
            </button>
          )}
          <button
            onClick={() => setShowSettings(v => !v)}
            className={`btn-secondary flex items-center gap-2 ${showSettings ? 'ring-2 ring-blue-400' : ''}`}
          >
            <Settings2 size={16} />
            Duct Pricing
          </button>
          {results && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={16} />
              Export CSV
            </button>
          )}
          <button onClick={calculate} disabled={calculating} className="btn-primary flex items-center gap-2 px-6">
            {calculating ? 'Calculating…' : 'Calculate & Save'}
          </button>
        </div>
      </div>

      {/* Inline Duct Pricing Panel — project-scoped when a project is open */}
      {showSettings && (
        <PriceSettings
          prices={effectivePrices}
          overhead={overhead}
          onPricesChange={setPrices}
          onOverheadChange={setOverhead}
          onClose={() => setShowSettings(false)}
          activeProjectId={activeProjectId}
          onProjectSave={async (draft) => {
            try {
              await savePricingConfig({ ductPrices: draft });
              toast.success('Duct pricing saved to project');
            } catch {
              toast.error('Could not save duct pricing');
            }
          }}
        />
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <RowFilterBar
          value={filterText}
          onChange={setFilterText}
          total={rows.length}
          filtered={filteredRows.length}
          placeholder="Search by size, type, material, notes…"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">Size</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-36">
                  <div className="flex items-center gap-2">
                    <span>Lin. Length</span>
                    <select
                      className="text-xs font-normal border border-gray-300 rounded px-1 py-0.5 bg-white text-gray-700 cursor-pointer"
                      value={unitLabel}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      title="Select unit of measurement for all rows"
                    >
                      <option value="ft">ft</option>
                      <option value="in">in</option>
                      <option value="m">m</option>
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                    </select>
                  </div>
                  {showScaleHint && (
                    <div className="text-xs font-normal text-blue-500 mt-0.5">
                      auto-convert → ft
                    </div>
                  )}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Application</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">Material</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Gauge / mm</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Sq Ft</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Labor Hrs</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Material $</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Labor $</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Total $</th>
                {[
                  { field: 'insulated', label: 'Ins $',  title: 'Duct wrap insulation' },
                  { field: 'flexDuct', label: 'Flex $', title: 'Flex duct (round only)' },
                  { field: 'vd',       label: 'VD $',   title: 'Volume damper' },
                    { field: 'offtake',  label: 'OT $',   title: 'Offtake connection' },
                ].map(({ field, label, title }) => {
                  const eligible = field === 'flexDuct'
                    ? rows.filter((r) => { const s=(r.size||'').toLowerCase(); return !s.includes('x')&&!s.includes('*'); })
                    : rows;
                  const allOn = eligible.length > 0 && eligible.every((r) => r[field]);
                  return (
                    <th key={field} className="text-center px-4 py-3 font-semibold text-gray-600 w-20" title={title}>
                      <div className="flex flex-col items-center gap-1">
                        <span>{label}</span>
                        <button
                          type="button"
                          onClick={() => toggleAllAccessory(field)}
                          title={allOn ? `Deselect all ${label}` : `Select all ${label}`}
                          className={`flex items-center gap-1 text-[10px] font-normal rounded px-1.5 py-0.5 transition-colors border ${
                            allOn
                              ? 'bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200'
                              : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {allOn ? <CheckSquare size={10} /> : <Square size={10} />}
                          All
                        </button>
                      </div>
                    </th>
                  );
                })}
                <th className="text-center px-2 py-3 font-semibold text-gray-600 w-16">Bid</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => {
                const resultRow = results?.rows?.find((r) => r.id === row.id);
                return (
                  <DuctRow
                    key={row.id}
                    row={row}
                    result={resultRow}
                    index={rows.indexOf(row)}
                    onChange={handleRowChange}
                    onRemove={() => removeRow(row.id)}
                    onAdd={addRow}
                    unitLabel={unitLabel}
                    showScaleHint={showScaleHint}
                    scaleFactor={scaleFactor}
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

      {/* Totals */}
      {results && (
        <DuctTotals totals={results.totals} byMaterial={results.byMaterial} />
      )}

      {/* Clear */}
      <div className="mt-4 flex justify-end">
        <button onClick={clearAll} className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1">
          <Trash2 size={14} /> Clear All
        </button>
      </div>
    </div>
  );
}
