/**
 * LouversModule — standalone estimating module for Louvers & Dampers.
 * Modelled after ElectricHeatModule structure:
 *   • useEstimate('LOUVERS_DAMPERS') for DB load/save
 *   • useAutoSave for debounced persistence
 *   • Auto-calc on row change, writes totalMaterial + totalLabor + totalCost
 *   • EstimateProjectBanner in header
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Plus, Download, Wind } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  calcLouverDamperBatch,
  LOUVER_DAMPER_TYPES,
} from '@utils/unitScheduleCalculations';
import { saveModuleTotals } from '@utils/projectTotals';
import { useEstimate } from '@hooks/useEstimate';
import EstimateProjectBanner from '@components/EstimateProjectBanner';
import LouverDamperRow from './LouverDamperRow';

// ─── Row factory ──────────────────────────────────────────────────────────────
let _rowCounter = 1;
export function newLouverDamperRow(id) {
  return {
    id: id || `ld-${Date.now()}-${_rowCounter++}`,
    name: '',
    type: LOUVER_DAMPER_TYPES[0],
    widthIn: 0,
    heightIn: 0,
    qty: 1,
    ownerProvided: '',
    unitPrice: 0,
    miscPct: 3,
    accessories: { screen: '', actuator: '', sleeve: '' },
  };
}

// ─── Totals footer ────────────────────────────────────────────────────────────
function LouversTotalsFooter({ totals }) {
  const fmt = (n) =>
    (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  return (
    <div className="card mt-4 p-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-500 mb-1">Total Material</div>
          <div className="text-xl font-bold font-mono text-blue-800">{fmt(totals.totalMaterial)}</div>
        </div>
        <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-green-500 mb-1">Total Labor</div>
          <div className="text-xl font-bold font-mono text-green-800">{fmt(totals.totalLabor)}</div>
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-600 mb-1">Total Cost</div>
          <div className="text-xl font-bold font-mono text-teal-900">{fmt(totals.totalCost)}</div>
          <div className="text-[11px] text-teal-400 mt-0.5">{(totals.totalHours || 0).toFixed(1)} hrs</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────
export default function LouversModule() {
  const [rows, setRows] = useState([newLouverDamperRow(), newLouverDamperRow()]);
  const [results, setResults] = useState(null);

  const {
    projectId, projectName,
    loadEstimate, saveEstimate,
    saving, lastSaved, saveError,
  } = useEstimate('LOUVERS_DAMPERS');

  // Prevent auto-save from firing immediately after DB load
  const loadedRef = useRef(false);

  // ── Load from DB ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (projectId) {
      loadEstimate().then(est => {
        if (est?.rowsJson && Array.isArray(est.rowsJson) && est.rowsJson.length > 0) {
          setRows(est.rowsJson);
        }
        setTimeout(() => { loadedRef.current = true; }, 100);
      });
      return;
    }
    loadedRef.current = true;
  }, [loadEstimate, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-calc + save totals whenever rows change ──────────────────────────
  useEffect(() => {
    const filled = rows.filter(r => Number(r.widthIn) > 0 && Number(r.heightIn) > 0);
    if (filled.length === 0) {
      setResults(null);
      return;
    }
    const batch = calcLouverDamperBatch(rows);
    setResults(batch);
    saveModuleTotals('louvers_dampers', {
      totalMaterial: batch.totals.totalMaterial,
      totalLabor:    batch.totals.totalLabor,
      totalCost:     batch.totals.totalCost,
    });

    if (projectId && loadedRef.current) {
      saveEstimate({
        rowsJson:      rows,
        totalMaterial: batch.totals.totalMaterial,
        totalLabor:    batch.totals.totalLabor,
        totalCost:     batch.totals.totalCost,
      });
    }
  }, [rows, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save debounce (separate from calc effect) ────────────────────────
  useEffect(() => {
    if (!projectId || !loadedRef.current) return;
    const timer = setTimeout(() => {
      if (!results) return;
      saveEstimate({
        rowsJson:      rows,
        totalMaterial: results.totals.totalMaterial,
        totalLabor:    results.totals.totalLabor,
        totalCost:     results.totals.totalCost,
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [rows, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Row handlers ──────────────────────────────────────────────────────────
  const handleChange = useCallback((id, field, value) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field.startsWith('accessories.')) {
        const k = field.split('.').slice(1).join('.');
        return { ...r, accessories: { ...r.accessories, [k]: value } };
      }
      return { ...r, [field]: value };
    }));
  }, []);

  const addRow = () => setRows(prev => [...prev, newLouverDamperRow()]);

  const removeRow = (id) =>
    setRows(prev => prev.length <= 1 ? prev : prev.filter(r => r.id !== id));

  const duplicateRow = (id) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const clone = {
        ...JSON.parse(JSON.stringify(original)),
        id:   `ld-${Date.now()}-${_rowCounter++}`,
        name: original.name ? `${original.name} (copy)` : '(copy)',
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    toast.success('Row duplicated');
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!results) return;
    const f = (n) => (n || 0).toFixed(2);
    const lines = [['#', 'Name', 'Type', 'W (in)', 'H (in)', 'Qty', 'Total Material $', 'Total Labor $', 'Total Cost $'].join(',')];
    results.rows.forEach((r, i) => {
      lines.push([i + 1, r.name || '', r.type || '', r.widthIn || 0, r.heightIn || 0,
        r.qty || 1, f(r.totalMaterial), f(r.totalLabor), f(r.totalCost)].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'louvers_dampers.csv';
    a.click();
    toast.success('Louvers & Dampers exported');
  };

  const filledCount = rows.filter(r => Number(r.widthIn) > 0 && Number(r.heightIn) > 0).length;

  return (
    <div className="max-w-full">
      <EstimateProjectBanner
        projectId={projectId} projectName={projectName}
        saving={saving} lastSaved={lastSaved} saveError={saveError}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Wind size={22} className="text-teal-600" />
            Louvers &amp; Dampers Schedule
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            OA/supply/return louvers and fire/smoke/volume/backdraft dampers — sized by face area
          </p>
        </div>
        <div className="flex items-center gap-2">
          {results && (
            <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
              <Download size={15} /> Export CSV
            </button>
          )}
          {projectId && (
            <button
              onClick={() => {
                if (!results) return;
                saveEstimate({
                  rowsJson:      rows,
                  totalMaterial: results.totals.totalMaterial,
                  totalLabor:    results.totals.totalLabor,
                  totalCost:     results.totals.totalCost,
                });
              }}
              disabled={saving}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {saving ? 'Saving…' : '💾 Save'}
            </button>
          )}
        </div>
      </div>

      {/* Config badge */}
      {filledCount > 0 && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Items:</span>
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">
            {filledCount} sized
          </span>
          <span className="text-xs text-gray-400">{rows.length} row{rows.length !== 1 ? 's' : ''} total</span>
        </div>
      )}

      {/* Rows */}
      <div className="card p-0 overflow-hidden">
        <div className="divide-y divide-gray-100">
          {rows.map((row, i) => {
            const result = results?.rows?.find(r => r.id === row.id) || {};
            return (
              <LouverDamperRow
                key={row.id}
                row={row}
                result={result}
                index={i}
                onChange={handleChange}
                onRemove={() => removeRow(row.id)}
                onDuplicate={() => duplicateRow(row.id)}
              />
            );
          })}
        </div>

        {/* Add row */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <button
            onClick={addRow}
            className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 font-medium"
          >
            <Plus size={15} /> Add Louver / Damper
          </button>
        </div>
      </div>

      {/* Totals */}
      {results && <LouversTotalsFooter totals={results.totals} />}
    </div>
  );
}
