/**
 * ScenarioModule — Side-by-side bid scenario comparison
 *
 * Lets you define up to 4 named scenarios with different markup/rate parameters
 * and see how each one changes the final bid number — instantly, as you type.
 *
 * Typical use cases:
 *   • "What if we increase our overhead by 5%?"
 *   • "Low bid vs. target vs. conservative — what's our range?"
 *   • Prepare three numbers before walking into a negotiation
 *
 * State persisted in localStorage (key: scenario_comparison)
 * API_TODO: Save scenarios via POST /api/estimates/{projectId}/scenarios
 */
import React, { useState, useMemo, useCallback } from 'react';
import { Plus, Trash2, Download, RotateCcw, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => `sc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const fmt  = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const pct  = (n) => `${(n || 0).toFixed(1)}%`;

function load(key, def) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    // Guard: must be a non-empty array with the expected schema.
    // DemoSetup previously stored { scenarios: [...] } (object) instead of
    // a bare array, which caused ".map is not a function" on render.
    if (!Array.isArray(parsed) || parsed.length === 0) return def;
    // Each item must have at least an id and a name/label
    if (!parsed[0]?.id) return def;
    return parsed;
  }
  catch { return def; }
}

const DEFAULT_SCENARIOS = [
  {
    id: uid(), name: 'Base Case',
    baseMaterial: 50000, baseHours: 800, laborRate: 25,
    matlMarkup: 10, overhead: 15, profit: 10, contingency: 3,
    color: 'blue',
  },
  {
    id: uid(), name: 'Conservative',
    baseMaterial: 50000, baseHours: 800, laborRate: 28,
    matlMarkup: 15, overhead: 20, profit: 12, contingency: 5,
    color: 'orange',
  },
];

const COLORS = {
  blue:   { card: 'border-blue-600/50 bg-blue-900/10',   badge: 'bg-blue-600',   text: 'text-blue-400' },
  orange: { card: 'border-orange-600/50 bg-orange-900/10', badge: 'bg-orange-600', text: 'text-orange-400' },
  green:  { card: 'border-green-600/50 bg-green-900/10',  badge: 'bg-green-600',  text: 'text-green-400' },
  purple: { card: 'border-purple-600/50 bg-purple-900/10', badge: 'bg-purple-600', text: 'text-purple-400' },
};
const COLOR_KEYS = Object.keys(COLORS);

/**
 * Core bid calculation — mirrors the Excel Summary sheet logic.
 *
 * Final Bid = Material (with markup) + Labor (with overhead) + Profit + Contingency
 */
function calcScenario(sc) {
  const laborBase   = (Number(sc.baseHours)    || 0) * (Number(sc.laborRate)   || 0);
  const matlBase    = Number(sc.baseMaterial)  || 0;
  const laborTotal  = laborBase   * (1 + (Number(sc.overhead)   || 0) / 100);
  const matlTotal   = matlBase    * (1 + (Number(sc.matlMarkup) || 0) / 100);
  const subtotal    = matlTotal   + laborTotal;
  const profitAmt   = subtotal    * ((Number(sc.profit)      || 0) / 100);
  const contAmt     = subtotal    * ((Number(sc.contingency) || 0) / 100);
  const totalBid    = subtotal    + profitAmt + contAmt;
  return { laborBase, laborTotal, matlBase, matlTotal, subtotal, profitAmt, contAmt, totalBid };
}

// ─── Scenario Card ─────────────────────────────────────────────────────────────
function ScenarioCard({ sc, idx, onUpdate, onRemove, canRemove }) {
  const c = COLORS[sc.color] || COLORS.blue;
  const inp = 'w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500';
  const set = (field) => (e) => onUpdate(sc.id, field, e.target.value);

  return (
    <div className={`rounded-xl border ${c.card} overflow-hidden`}>
      {/* Card header */}
      <div className={`flex items-center justify-between px-4 py-2 ${c.badge} bg-opacity-20 border-b border-gray-700/50`}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60 font-medium">Scenario {String.fromCharCode(65 + idx)}</span>
        </div>
        {canRemove && (
          <button onClick={() => onRemove(sc.id)} className="text-white/40 hover:text-red-400 transition-colors p-1"><Trash2 size={12} /></button>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Name */}
        <div>
          <label className="text-xs text-gray-400 block mb-1">Scenario Name</label>
          <input className={inp} value={sc.name} onChange={set('name')} placeholder="e.g. Base Case" />
        </div>

        {/* Divider */}
        <div className="text-xs text-gray-600 font-medium uppercase tracking-wider pt-1">Base Estimate</div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Material Cost ($)</label>
            <input className={inp} type="number" min="0" step="100" value={sc.baseMaterial} onChange={set('baseMaterial')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Labor Hours</label>
            <input className={inp} type="number" min="0" step="1" value={sc.baseHours} onChange={set('baseHours')} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Labor Rate ($/hr)</label>
            <input className={inp} type="number" min="0" step="0.5" value={sc.laborRate} onChange={set('laborRate')} />
          </div>
        </div>

        <div className="text-xs text-gray-600 font-medium uppercase tracking-wider pt-1">Markup Parameters</div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Material Markup %</label>
            <input className={inp} type="number" min="0" max="100" step="0.5" value={sc.matlMarkup} onChange={set('matlMarkup')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Labor Overhead %</label>
            <input className={inp} type="number" min="0" max="100" step="0.5" value={sc.overhead} onChange={set('overhead')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Profit Margin %</label>
            <input className={inp} type="number" min="0" max="100" step="0.5" value={sc.profit} onChange={set('profit')} />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Contingency %</label>
            <input className={inp} type="number" min="0" max="100" step="0.5" value={sc.contingency} onChange={set('contingency')} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Comparison Table ──────────────────────────────────────────────────────────
function ComparisonTable({ scenarios, results }) {
  if (scenarios.length === 0) return null;

  const baseBid = results[0]?.totalBid || 0;

  const rows = [
    { label: 'Base Material',    key: 'matlBase',   note: 'as entered' },
    { label: 'Material Markup',  key: 'matlTotal',  derived: (r, sc) => r.matlTotal - r.matlBase, note: 'markup only' },
    { label: 'Material Total',   key: 'matlTotal',  bold: true },
    { label: 'Base Labor',       key: 'laborBase',  note: 'hours × rate' },
    { label: 'Labor Overhead',   key: 'laborTotal', derived: (r) => r.laborTotal - r.laborBase, note: 'overhead only' },
    { label: 'Labor Total',      key: 'laborTotal', bold: true },
    { label: 'Subtotal',         key: 'subtotal',   bold: true, separator: true },
    { label: 'Profit',           key: 'profitAmt' },
    { label: 'Contingency',      key: 'contAmt' },
    { label: 'TOTAL BID',        key: 'totalBid',   bold: true, highlight: true, separator: true },
  ];

  const getValue = (row, result, sc) => {
    if (row.derived) return row.derived(result, sc);
    return result[row.key] || 0;
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-700 bg-gray-800/80">
        <h2 className="text-white font-semibold">Side-by-Side Comparison</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left px-5 py-3 text-gray-400 font-medium w-40">Line Item</th>
              {scenarios.map((sc, idx) => {
                const c = COLORS[sc.color] || COLORS.blue;
                return (
                  <th key={sc.id} className={`text-right px-5 py-3 font-medium ${c.text}`}>
                    <div>{sc.name || `Scenario ${String.fromCharCode(65 + idx)}`}</div>
                    <div className="text-xs text-gray-500 font-normal">
                      {pct(sc.profit)} profit · {pct(sc.overhead)} OH
                    </div>
                  </th>
                );
              })}
              {scenarios.length > 1 && (
                <th className="text-right px-5 py-3 text-gray-400 font-medium">vs. Base</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={[
                  row.separator ? 'border-t-2 border-gray-600' : 'border-t border-gray-700/40',
                  row.highlight ? 'bg-gray-700/40' : i % 2 === 0 ? 'bg-gray-800/20' : '',
                ].join(' ')}
              >
                <td className={`px-5 py-2.5 ${row.bold ? 'text-white font-semibold' : 'text-gray-400'}`}>
                  {row.label}
                  {row.note && <span className="text-xs text-gray-600 ml-1">({row.note})</span>}
                </td>
                {scenarios.map((sc, idx) => {
                  const result = results[idx];
                  const value = getValue(row, result, sc);
                  return (
                    <td key={sc.id} className={`px-5 py-2.5 text-right font-${row.bold ? 'semibold' : 'normal'} ${row.highlight ? 'text-white text-base' : 'text-gray-300'}`}>
                      {fmt(value)}
                    </td>
                  );
                })}
                {scenarios.length > 1 && (() => {
                  const base = getValue(row, results[0], scenarios[0]);
                  const cells = scenarios.slice(1).map((sc, idx) => {
                    const val = getValue(row, results[idx + 1], sc);
                    const diff = val - base;
                    const isPos = diff > 0;
                    return (
                      <span key={sc.id} className={`block text-right ${isPos ? 'text-red-400' : diff < 0 ? 'text-green-400' : 'text-gray-600'}`}>
                        {diff !== 0 ? `${isPos ? '+' : ''}${fmt(diff)}` : '—'}
                      </span>
                    );
                  });
                  return (
                    <td className="px-5 py-2.5 text-right text-xs">{cells}</td>
                  );
                })()}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Visual bid bar */}
      {scenarios.length > 1 && (
        <div className="px-5 py-4 border-t border-gray-700 space-y-2">
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-3">Relative Bid Size</div>
          {scenarios.map((sc, idx) => {
            const result = results[idx];
            const maxBid = Math.max(...results.map(r => r.totalBid || 0));
            const barWidth = maxBid > 0 ? (result.totalBid / maxBid) * 100 : 0;
            const c = COLORS[sc.color] || COLORS.blue;
            return (
              <div key={sc.id} className="flex items-center gap-3">
                <span className={`text-xs w-28 shrink-0 ${c.text}`}>{sc.name || `Scenario ${String.fromCharCode(65 + idx)}`}</span>
                <div className="flex-1 bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${c.badge}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-white font-semibold text-sm w-24 text-right">{fmt(result.totalBid)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────
export default function ScenarioModule() {
  const [scenarios, _setScenarios] = useState(() => load('scenario_comparison', DEFAULT_SCENARIOS));

  const setScenarios = useCallback((updater) => {
    _setScenarios(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('scenario_comparison', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateScenario = useCallback((id, field, value) => {
    setScenarios(prev => prev.map(sc => sc.id === id ? { ...sc, [field]: value } : sc));
  }, [setScenarios]);

  const addScenario = () => {
    if (scenarios.length >= 4) { toast.error('Maximum 4 scenarios allowed'); return; }
    const nextColor = COLOR_KEYS[scenarios.length % COLOR_KEYS.length];
    const base = scenarios[0] || DEFAULT_SCENARIOS[0];
    setScenarios(prev => [...prev, {
      ...base, id: uid(), name: `Scenario ${String.fromCharCode(65 + prev.length)}`, color: nextColor,
    }]);
    toast.success('Scenario added');
  };

  const removeScenario = (id) => {
    if (scenarios.length <= 1) { toast.error('At least one scenario required'); return; }
    setScenarios(prev => prev.filter(sc => sc.id !== id));
  };

  const resetAll = () => {
    if (!confirm('Reset all scenarios to defaults?')) return;
    setScenarios(DEFAULT_SCENARIOS.map(s => ({ ...s, id: uid() })));
    toast.success('Reset to defaults');
  };

  const exportCsv = () => {
    const headers = ['Line Item', ...scenarios.map(s => s.name)];
    const r = scenarios.map(sc => calcScenario(sc));
    const csvRows = [
      headers,
      ['Base Material',   ...r.map(x => x.matlBase.toFixed(2))],
      ['Material Markup', ...r.map((x) => (x.matlTotal - x.matlBase).toFixed(2))],
      ['Material Total',  ...r.map(x => x.matlTotal.toFixed(2))],
      ['Base Labor',      ...r.map(x => x.laborBase.toFixed(2))],
      ['Labor Overhead',  ...r.map(x => (x.laborTotal - x.laborBase).toFixed(2))],
      ['Labor Total',     ...r.map(x => x.laborTotal.toFixed(2))],
      ['Subtotal',        ...r.map(x => x.subtotal.toFixed(2))],
      ['Profit',          ...r.map(x => x.profitAmt.toFixed(2))],
      ['Contingency',     ...r.map(x => x.contAmt.toFixed(2))],
      ['TOTAL BID',       ...r.map(x => x.totalBid.toFixed(2))],
    ];
    const csv = csvRows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bid_scenarios.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const results = useMemo(() => scenarios.map(sc => calcScenario(sc)), [scenarios]);
  const lowestBid = Math.min(...results.map(r => r.totalBid).filter(b => b > 0));
  const highestBid = Math.max(...results.map(r => r.totalBid));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900/40 to-teal-900/30 rounded-xl border border-emerald-800/30 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Scenario Comparison</h1>
            <p className="text-emerald-300 text-sm mt-1">
              Model up to 4 bid scenarios with different markup parameters and compare instantly
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={resetAll} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs"><RotateCcw size={12} /> Reset</button>
            <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs"><Download size={12} /> Export CSV</button>
            {scenarios.length < 4 && (
              <button onClick={addScenario} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium"><Plus size={12} /> Add Scenario</button>
            )}
          </div>
        </div>

        {/* Quick summary strip */}
        {results.length > 1 && (
          <div className="flex gap-6 mt-4 pt-4 border-t border-emerald-800/30">
            <div>
              <div className="text-xs text-emerald-400">Lowest Bid</div>
              <div className="text-white font-bold">{fmt(lowestBid)}</div>
            </div>
            <div>
              <div className="text-xs text-orange-400">Highest Bid</div>
              <div className="text-white font-bold">{fmt(highestBid)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Range</div>
              <div className="text-white font-bold">{fmt(highestBid - lowestBid)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Range %</div>
              <div className="text-white font-bold">
                {lowestBid > 0 ? pct(((highestBid - lowestBid) / lowestBid) * 100) : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scenario cards grid */}
      <div className={`grid gap-4 ${
        scenarios.length === 1 ? 'grid-cols-1 max-w-sm' :
        scenarios.length === 2 ? 'grid-cols-2' :
        scenarios.length === 3 ? 'grid-cols-3' :
        'grid-cols-4'
      }`}>
        {scenarios.map((sc, idx) => (
          <ScenarioCard
            key={sc.id}
            sc={sc}
            idx={idx}
            onUpdate={updateScenario}
            onRemove={removeScenario}
            canRemove={scenarios.length > 1}
          />
        ))}
      </div>

      {/* Comparison table */}
      <ComparisonTable scenarios={scenarios} results={results} />

      <p className="text-xs text-gray-600 text-center">
        Parameters auto-save to this browser · Use Export CSV to share with your team
      </p>
    </div>
  );
}
