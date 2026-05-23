import React, { useState, useCallback, useContext, useEffect } from 'react';
import { Plus, Trash2, Download, RefreshCw, Info, Play } from 'lucide-react';
import toast from 'react-hot-toast';
import { calculateDuctBatch } from '@utils/ductCalculations';
import DuctRow from './DuctRow';
import DuctTotals from './DuctTotals';
import { SettingsContext } from '@contexts/SettingsContext';
import { useNavigate } from 'react-router-dom';
import { DEMO_METAL_DUCT } from '@utils/demoData';

const DEFAULT_PRICES = {
  sheetMetalCostPerLb: 4.00,
  laborRate: 68.00,
  insulationPerSqFt: 0.85,
};

const newRow = (id) => ({
  id,
  size: '',
  linearFeet: '',
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
});

const TEST_ROWS = [
  {
    id: 'test-row-1',
    size: '24x12',
    linearFeet: 18,
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
  const { prices } = useContext(SettingsContext);
  const navigate = useNavigate();

  // Auto-load demo data when demo mode is active
  useEffect(() => {
    if (localStorage.getItem('demo_mode') === 'true') {
      try {
        const saved = localStorage.getItem('demo_metal_duct');
        if (saved) {
          const { rows: demoRows } = JSON.parse(saved);
          if (demoRows?.length) { setRows(demoRows); }
        }
      } catch (_) {}
    }
  }, []);

  // Derive the column label and whether to show the "= X.XX ft" hint
  const unitLabel = prices.measureUnit ?? 'ft';
  const UNIT_TO_FT = { ft: 1.0, in: 1 / 12, m: 1 / 0.3048, cm: 1 / 30.48, mm: 1 / 304.8 };
  const scaleFactor = UNIT_TO_FT[unitLabel] ?? 1.0;
  const showScaleHint = unitLabel !== 'ft';
  const [results, setResults] = useState(null);

  const calculateFromRows = useCallback((sourceRows) => {
    const validRows = sourceRows.filter((r) => r.size && r.linearFeet);
    if (validRows.length === 0) {
      toast.error('Add at least one duct size and linear feet');
      return null;
    }

    const result = calculateDuctBatch(validRows, prices);
    // Profit is intentionally not applied here. Profit/markup will be applied globally
    // in a separate page so this module only returns direct costs.
    setResults(result);
    toast.success(`Calculated ${validRows.length} duct runs (profit excluded)`);
    return result;
  }, [prices]);

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

  const calculate = () => {
    try {
      calculateFromRows(rows);
    } catch (err) {
      toast.error('Calculation error: ' + err.message);
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
              className="btn-secondary flex items-center gap-2 text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
            >
              <Play size={16} />
              Load Demo
            </button>
          )}
          <button
            onClick={() => navigate('/settings')}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw size={16} />
            Prices & Settings
          </button>
          {results && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
              <Download size={16} />
              Export CSV
            </button>
          )}
          <button onClick={calculate} className="btn-primary flex items-center gap-2 px-6">
            Calculate
          </button>
        </div>
      </div>

      {/* Price Settings Panel */}
      {/* Settings are now global — open the Settings page to edit prices and presets */}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">Size</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">
                  Lin. ({unitLabel})
                  {showScaleHint && (
                    <div className="text-xs font-normal text-blue-500">
                      ×{scaleFactor} → ft
                    </div>
                  )}
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Application</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-20">Gauge</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Sq Ft</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Labor Hrs</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Material $</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Labor $</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Total $</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-20" title="Duct wrap insulation price">Ins $</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-20" title="Flex duct price">Flex $</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-20" title="Volume damper price">VD $</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-20" title="Offtake price">OT $</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const resultRow = results?.rows?.find((r) => r.id === row.id);
                return (
                  <DuctRow
                    key={row.id}
                    row={row}
                    result={resultRow}
                    index={i}
                    onChange={handleRowChange}
                    onRemove={() => removeRow(row.id)}
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
        <DuctTotals totals={results.totals} />
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
