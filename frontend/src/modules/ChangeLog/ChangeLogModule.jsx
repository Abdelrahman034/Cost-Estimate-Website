/**
 * ChangeLogModule.jsx
 * Tracks what changed between estimate versions — a huge advantage over Excel.
 *
 * Features:
 *   • Auto-snapshot: reads module totals and records them with a timestamp
 *     whenever you click "Record Snapshot"
 *   • Named snapshots: annotate each snapshot with a note (e.g. "After VE round")
 *   • Diff view: side-by-side comparison of any two snapshots, showing + / - changes
 *   • CSV Export of the change history
 *   • Delete individual snapshots
 *
 * Storage:
 *   - When opened inside a project (projectId in URL): persists to DB via
 *     POST /api/projects/:projectId/changelog  (action: 'estimate_snapshot')
 *   - Otherwise: falls back to localStorage key "estimate_changelog"
 */
import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Clock, Plus, Trash2, Download, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Minus, BarChart3, AlertCircle, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { readAllModuleTotals } from '@utils/projectTotals';
import { changelogApi } from '@services/api';

const LS_KEY = 'estimate_changelog';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt   = (n) => (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const fmtTs = (ts) => new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

function loadLocalLog() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); }
  catch { return []; }
}

function saveLocalLog(log) {
  localStorage.setItem(LS_KEY, JSON.stringify(log));
}

/** Convert a DB ProjectChangelog entry → snapshot shape used by UI */
function normalizeEntry(entry) {
  const detail = entry.detail ?? {};
  return {
    id:      entry.id,
    note:    detail.note ?? entry.description ?? 'Snapshot',
    savedAt: new Date(entry.createdAt).getTime(),
    modules: Array.isArray(detail.modules) ? detail.modules : [],
    // flag so we know it lives in DB (used by delete — currently no delete endpoint for changelog)
    fromDb:  true,
  };
}

// ─── Delta badge ──────────────────────────────────────────────────────────────
function Delta({ value }) {
  if (!value || value === 0) return <span className="text-xs text-gray-400 font-medium">—</span>;
  const pos = value > 0;
  const Icon = pos ? TrendingUp : TrendingDown;
  const color = pos ? 'text-red-600' : 'text-green-600'; // up = more cost = bad
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon size={12} />
      {pos ? '+' : ''}{fmt(value)}
    </span>
  );
}

// ─── Snapshot card ────────────────────────────────────────────────────────────
function SnapshotCard({ snap, prev, onDelete, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const grandTotal = snap.modules.reduce((s, m) => s + (m.totalCost || 0), 0);
  const prevTotal  = prev ? prev.modules.reduce((s, m) => s + (m.totalCost || 0), 0) : null;
  const delta      = prevTotal !== null ? grandTotal - prevTotal : null;

  return (
    <div className={`card p-0 overflow-hidden transition-all ${selected ? 'ring-2 ring-blue-400' : ''}`}>
      {/* Card header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onSelect}
          className="mt-1 accent-blue-600"
          title="Select for comparison"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-gray-800 truncate">{snap.note || 'Snapshot'}</span>
            {delta !== null && <Delta value={delta} />}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock size={11} />
            {fmtTs(snap.savedAt)}
            <span className="text-gray-300">·</span>
            {snap.modules.filter(m => m.totalCost > 0).length} active module{snap.modules.filter(m => m.totalCost > 0).length !== 1 ? 's' : ''}
            {snap.fromDb && <span className="text-gray-400 italic">(saved)</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-gray-900">{fmt(grandTotal)}</div>
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Show module breakdown"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="text-gray-300 hover:text-red-500 transition-colors"
              title="Delete snapshot"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded module breakdown */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wide">
                <th className="text-left pb-1">Module</th>
                <th className="text-right pb-1">Material</th>
                <th className="text-right pb-1">Labor</th>
                <th className="text-right pb-1">Total</th>
                {prev && <th className="text-right pb-1">Δ vs prev</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {snap.modules.filter(m => m.totalCost > 0).map(m => {
                const prevMod = prev?.modules.find(pm => pm.key === m.key);
                const d = prevMod ? m.totalCost - prevMod.totalCost : null;
                return (
                  <tr key={m.key}>
                    <td className="py-1 text-gray-700 font-medium">{m.label}</td>
                    <td className="py-1 text-right text-blue-600">{fmt(m.totalMaterial)}</td>
                    <td className="py-1 text-right text-green-600">{fmt(m.totalLabor)}</td>
                    <td className="py-1 text-right font-semibold text-gray-800">{fmt(m.totalCost)}</td>
                    {prev && <td className="py-1 text-right"><Delta value={d} /></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Diff Table ───────────────────────────────────────────────────────────────
function DiffTable({ snapA, snapB }) {
  if (!snapA || !snapB) return null;

  const totalA = snapA.modules.reduce((s, m) => s + (m.totalCost || 0), 0);
  const totalB = snapB.modules.reduce((s, m) => s + (m.totalCost || 0), 0);
  const allKeys = [...new Set([...snapA.modules.map(m => m.key), ...snapB.modules.map(m => m.key)])];

  return (
    <div className="card p-0 overflow-hidden mt-4">
      <div className="px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <BarChart3 size={15} className="text-blue-600" />
          Comparison: {snapA.note || 'Snapshot A'} → {snapB.note || 'Snapshot B'}
        </h3>
        <div className="flex items-center gap-6 mt-2 text-sm">
          <div>
            <span className="text-gray-500 text-xs">A: </span>
            <span className="font-semibold">{fmt(totalA)}</span>
          </div>
          <div>
            <span className="text-gray-500 text-xs">B: </span>
            <span className="font-semibold">{fmt(totalB)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500 text-xs">Change: </span>
            <Delta value={totalB - totalA} />
          </div>
          {totalA > 0 && (
            <div className="text-xs text-gray-500">
              {((totalB - totalA) / totalA * 100).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-xs text-gray-400 uppercase tracking-wide">
            <th className="px-4 py-2 text-left">Module</th>
            <th className="px-4 py-2 text-right">{snapA.note || 'Version A'}</th>
            <th className="px-4 py-2 text-right">{snapB.note || 'Version B'}</th>
            <th className="px-4 py-2 text-right">Change ($)</th>
            <th className="px-4 py-2 text-right">Change (%)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {allKeys.map(key => {
            const mA = snapA.modules.find(m => m.key === key) || { totalCost: 0, label: key };
            const mB = snapB.modules.find(m => m.key === key) || { totalCost: 0 };
            const diff    = (mB.totalCost || 0) - (mA.totalCost || 0);
            const diffPct = mA.totalCost > 0 ? (diff / mA.totalCost * 100) : null;
            const changed = diff !== 0;
            return (
              <tr key={key} className={changed ? 'bg-amber-50/40' : ''}>
                <td className="px-4 py-2 text-gray-700 font-medium">{mA.label || key}</td>
                <td className="px-4 py-2 text-right text-gray-600">{fmt(mA.totalCost)}</td>
                <td className="px-4 py-2 text-right text-gray-800 font-medium">{fmt(mB.totalCost)}</td>
                <td className="px-4 py-2 text-right"><Delta value={diff} /></td>
                <td className="px-4 py-2 text-right text-xs text-gray-500">
                  {diffPct !== null ? `${diffPct > 0 ? '+' : ''}${diffPct.toFixed(1)}%` : '—'}
                </td>
              </tr>
            );
          })}
          {/* Total row */}
          <tr className="bg-gray-50 font-semibold">
            <td className="px-4 py-2 text-gray-800">Grand Total</td>
            <td className="px-4 py-2 text-right text-gray-700">{fmt(totalA)}</td>
            <td className="px-4 py-2 text-right text-gray-900">{fmt(totalB)}</td>
            <td className="px-4 py-2 text-right"><Delta value={totalB - totalA} /></td>
            <td className="px-4 py-2 text-right text-xs text-gray-500">
              {totalA > 0 ? `${((totalB - totalA) / totalA * 100) > 0 ? '+' : ''}${((totalB - totalA) / totalA * 100).toFixed(1)}%` : '—'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ChangeLogModule({ projectInfo }) {
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId') ?? projectInfo?.id ?? null;

  const [log,      setLog]      = useState([]);
  const [loading,  setLoading]  = useState(!!projectId);
  const [saving,   setSaving]   = useState(false);
  const [note,     setNote]     = useState('');
  const [selected, setSelected] = useState([]); // up to 2 snapshot IDs for compare

  // ── Load from DB or localStorage ────────────────────────────────────────────
  useEffect(() => {
    if (!projectId) {
      setLog(loadLocalLog());
      setLoading(false);
      return;
    }

    setLoading(true);
    changelogApi.list(projectId, 100)
      .then(res => {
        const entries = (res.data ?? [])
          .filter(e => e.action === 'estimate_snapshot')
          .map(normalizeEntry);
        setLog(entries);
      })
      .catch(() => {
        // Fallback to localStorage on error
        setLog(loadLocalLog());
        toast.error('Could not load changelog from server — showing local data');
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  // ── Record a snapshot ────────────────────────────────────────────────────────
  const recordSnapshot = useCallback(async () => {
    const modules = readAllModuleTotals();
    const hasData = modules.some(m => m.totalCost > 0);
    if (!hasData) {
      toast.error('No module data found — open an estimating module and enter some values first.');
      return;
    }

    const snapNote = note.trim() || `Snapshot ${log.length + 1}`;

    if (projectId) {
      // Save to DB
      setSaving(true);
      try {
        const res = await changelogApi.add(projectId, {
          action:      'estimate_snapshot',
          description: snapNote,
          detail:      { note: snapNote, modules },
        });
        const newSnap = normalizeEntry(res.data);
        setLog(prev => [newSnap, ...prev]);
        setNote('');
        toast.success(`Snapshot "${snapNote}" saved`);
      } catch {
        toast.error('Failed to save snapshot');
      } finally {
        setSaving(false);
      }
    } else {
      // Local fallback
      const snap = {
        id:      `snap-${Date.now()}`,
        note:    snapNote,
        savedAt: Date.now(),
        modules,
      };
      const updated = [snap, ...log];
      setLog(updated);
      saveLocalLog(updated);
      setNote('');
      toast.success(`Snapshot "${snapNote}" recorded`);
    }
  }, [note, log, projectId]);

  // Delete only works for local snapshots (no DELETE endpoint for changelog entries)
  const deleteSnap = useCallback((id) => {
    const snap = log.find(s => s.id === id);
    if (snap?.fromDb) {
      toast('DB changelog entries cannot be deleted — they are permanent audit records.', { icon: 'ℹ️' });
      return;
    }
    const updated = log.filter(s => s.id !== id);
    setLog(updated);
    saveLocalLog(updated);
    setSelected(sel => sel.filter(sid => sid !== id));
  }, [log]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(s => s !== id);
      if (prev.length >= 2)  return [prev[1], id]; // replace oldest
      return [...prev, id];
    });
  };

  const clearAll = () => {
    if (!window.confirm('Clear all local snapshots? (DB entries are preserved)')) return;
    const localOnly = log.filter(s => s.fromDb);
    setLog(localOnly);
    saveLocalLog([]);
    setSelected([]);
    toast('Local snapshots cleared', { icon: '🗑️' });
  };

  const exportCsv = () => {
    const lines = [['Snapshot', 'Date', 'Module', 'Material', 'Labor', 'Total'].join(',')];
    log.forEach(s => {
      s.modules.filter(m => m.totalCost > 0).forEach(m => {
        lines.push([
          `"${s.note}"`, new Date(s.savedAt).toLocaleDateString(),
          m.label, m.totalMaterial, m.totalLabor, m.totalCost,
        ].join(','));
      });
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'estimate_changelog.csv';
    a.click();
    toast.success('Change log exported');
  };

  // Comparison snapshots
  const snapA = selected[0] ? log.find(s => s.id === selected[0]) : null;
  const snapB = selected[1] ? log.find(s => s.id === selected[1]) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Log</h1>
          <p className="text-sm text-gray-500 mt-1">
            Record estimate snapshots and compare any two versions — see exactly what changed and by how much.
            {projectId && <span className="text-blue-500 ml-1">Snapshots are saved to this project.</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {log.length > 0 && (
            <>
              <button onClick={exportCsv} className="btn-secondary flex items-center gap-2 text-sm">
                <Download size={14} /> Export CSV
              </button>
              {!projectId && (
                <button onClick={clearAll} className="btn-secondary text-red-500 text-sm">Clear All</button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Record new snapshot */}
      <div className="card p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Plus size={15} className="text-blue-600" />
          Record Current State
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !saving && recordSnapshot()}
            placeholder="Optional note (e.g. 'After VE round', 'Rev 2 — owner removed 3 RTUs')"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            onClick={recordSnapshot}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
            Record Snapshot
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Reads current totals from all open estimating modules. Make sure you've opened and filled each module before snapshotting.
        </p>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading change log…
        </div>
      )}

      {/* Comparison hint */}
      {!loading && log.length >= 2 && (
        <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
          <AlertCircle size={15} className="shrink-0 text-blue-500" />
          Select two snapshots using the checkboxes to compare them side-by-side.
          {selected.length === 2 && (
            <button
              onClick={() => setSelected([])}
              className="ml-auto text-xs underline text-blue-500 hover:text-blue-700"
            >
              Clear selection
            </button>
          )}
        </div>
      )}

      {/* Diff table (when 2 selected) */}
      {selected.length === 2 && <DiffTable snapA={snapA} snapB={snapB} />}

      {/* Snapshot list */}
      {!loading && log.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Clock size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No snapshots yet.</p>
          <p className="text-xs mt-1">Fill in your estimates, then click "Record Snapshot" to capture the current state.</p>
        </div>
      )}

      {!loading && log.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              {log.length} Snapshot{log.length !== 1 ? 's' : ''}
            </h2>
            {selected.length > 0 && (
              <span className="text-xs text-blue-600 font-medium">
                {selected.length}/2 selected for comparison
              </span>
            )}
          </div>
          {log.map((snap, i) => (
            <SnapshotCard
              key={snap.id}
              snap={snap}
              prev={log[i + 1] || null}
              onDelete={snap.fromDb ? null : () => deleteSnap(snap.id)}
              selected={selected.includes(snap.id)}
              onSelect={() => toggleSelect(snap.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
