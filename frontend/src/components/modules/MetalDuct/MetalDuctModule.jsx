import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Download, RefreshCw, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { calculateDuctBatch, applyOverheadAndMargin } from '../../../utils/ductCalculations';
import DuctRow from './DuctRow';
import DuctTotals from './DuctTotals';
import PriceSettings from './PriceSettings';

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

export default function MetalDuctModule() {
  const [rows, setRows] = useState([newRow('row-1'), newRow('row-2'), newRow('row-3')]);
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [overhead, setOverhead] = useState({ overheadPct: 0.15, profitPct: 0.10 });
  const [showPriceSettings, setShowPriceSettings] = useState(false);
  const [sizePresets, setSizePresets] = useState(() => {
    try {
      const raw = localStorage.getItem('ductSizePresets');
      return raw ? JSON.parse(raw) : ['24x12', '18x10', '12', '10x8'];
    } catch {
      return ['24x12', '18x10', '12', '10x8'];
    }
  });
  const [results, setResults] = useState(null);

  const handleRowChange = useCallback((id, field, value) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }, []);

  const addRow = () => {
    setRows((prev) => [...prev, newRow(`row-${Date.now()}`)]);
  };

  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const calculate = () => {
    const validRows = rows.filter((r) => r.size && r.linearFeet);
    if (validRows.length === 0) {
      toast.error('Add at least one duct size and linear feet');
      return;
    }
    try {
      const result = calculateDuctBatch(validRows, prices);
      const bid = applyOverheadAndMargin(result.totals.totalCost, overhead.overheadPct, overhead.profitPct);
      setResults({ ...result, bid });
      toast.success(`Calculated ${validRows.length} duct runs`);
    } catch (err) {
      toast.error('Calculation error: ' + err.message);
    }
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
            onClick={() => setShowPriceSettings(!showPriceSettings)}
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
      {showPriceSettings && (
        <PriceSettings
          prices={prices}
          overhead={overhead}
          onPricesChange={setPrices}
          onOverheadChange={setOverhead}
          onClose={() => setShowPriceSettings(false)}
          presets={sizePresets}
          onPresetsChange={(arr) => setSizePresets(arr)}
        />
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 flex items-start gap-3">
        <Info size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          <strong>Size format:</strong> Rectangular: <code className="bg-blue-100 px-1 rounded">24x12</code> or <code className="bg-blue-100 px-1 rounded">24X12</code> — Round: <code className="bg-blue-100 px-1 rounded">12</code> (diameter in inches).
          Gauge is selected automatically per SMACNA standards.
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-32">Size</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Lin. Ft</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Type</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-20">Gauge</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Sq Ft</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Labor Hrs</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Material $</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-24">Labor $</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 w-28">Total $</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-12" title="External duct wrap">Ext. Ins</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-12" title="Internal insulation">Int. Ins</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-12" title="Flex duct">Flex</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-12" title="Volume damper">VD</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 w-12" title="Offtake">OT</th>
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
                    sizePresets={sizePresets}
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
        <DuctTotals totals={results.totals} bid={results.bid} overhead={overhead} />
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
