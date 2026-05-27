// pages/SettingsPage.jsx
//
// Company-wide estimating settings.
// All values are persisted to PostgreSQL via /api/pricing (PricingConfig).
// Tabs:
//   1. Labor Rates    - $/hr per trade type
//   2. Markup & Waste - overhead%, profit%, tax%, duct/pipe waste factors
//   3. Duct Pricing   - MetalDuct material prices (localStorage + DB JSON)
//   4. Copper         - LME price, copper type, safety factors, mode defaults

import React, { useState, useContext, useEffect, useCallback } from 'react';
import { SettingsContext, DEFAULT_COPPER_SETTINGS, DEFAULT_ACCESSORY_OVERRIDES } from '@contexts/SettingsContext';
import { useAuth } from '@contexts/AuthContext';
import PriceSettings from '@modules/MetalDuct/PriceSettings';
import AccessoryPriceSettings from '@modules/UnitSchedule/AccessoryPriceSettings';
import PricingTablesEditor from './PricingTablesEditor';
import toast from 'react-hot-toast';
import { Wrench, TrendingUp, Wind, Loader2, AlertCircle, Save, Zap,
         ChevronDown, ChevronUp, RefreshCw, Database, ShieldAlert, LayoutList, Table2 } from 'lucide-react';
import { copperApi } from '@services/api';

// ── Generic helpers ───────────────────────────────────────────────────────────

function pct(decimal) { return Math.round((decimal ?? 0) * 100); }
function fromPct(intStr) { return parseInt(intStr, 10) / 100; }

function FieldGroup({ label, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function RateInput({ label, hint, value, onChange }) {
  return (
    <FieldGroup label={label} hint={hint}>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
        <input type="number" min="0" step="0.50" value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="input w-full pl-7" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">/hr</span>
      </div>
    </FieldGroup>
  );
}

function PctInput({ label, hint, value, onChange }) {
  return (
    <FieldGroup label={label} hint={hint}>
      <div className="relative">
        <input type="number" min="0" max="100" step="1" value={pct(value)}
          onChange={e => onChange(fromPct(e.target.value))}
          className="input w-full pr-8" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
      </div>
    </FieldGroup>
  );
}

function MarkupPreview({ config }) {
  const base          = 1000;
  const afterOverhead = base * (1 + (config.overheadPct ?? 0));
  const afterProfit   = afterOverhead * (1 + (config.profitPct ?? 0));
  const afterTax      = afterProfit * (1 + (config.taxPct ?? 0));
  const total         = Math.round(afterTax);
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-3">
        Preview - applied to $1,000 direct cost
      </p>
      <div className="space-y-1.5 text-gray-700">
        <div className="flex justify-between"><span>Direct cost</span><span className="font-mono">$1,000</span></div>
        <div className="flex justify-between text-gray-500">
          <span>+ Overhead ({pct(config.overheadPct)}%)</span>
          <span className="font-mono">+${Math.round(base * (config.overheadPct ?? 0))}</span>
        </div>
        <div className="flex justify-between text-gray-500">
          <span>+ Profit ({pct(config.profitPct)}%)</span>
          <span className="font-mono">+${Math.round(afterOverhead * (config.profitPct ?? 0))}</span>
        </div>
        {(config.taxPct ?? 0) > 0 && (
          <div className="flex justify-between text-gray-500">
            <span>+ Tax ({pct(config.taxPct)}%)</span>
            <span className="font-mono">+${Math.round(afterProfit * (config.taxPct ?? 0))}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-gray-900 border-t border-blue-200 pt-2 mt-1">
          <span>Bid price</span><span className="font-mono">${total.toLocaleString()}</span>
        </div>
        <div className="text-xs text-gray-400 text-right">
          ({(((total / 1000) - 1) * 100).toFixed(1)}% total markup)
        </div>
      </div>
    </div>
  );
}

// ── Pipe Specifications Table ─────────────────────────────────────────────────
// Shows the DB-stored ASTM B88 / Grainger calibration data for all pipe sizes.
// ADMIN users can edit individual cells inline; a "Restore Defaults" button
// reverts to the factory-calibrated Grainger values at LME $4.25/lb.

function PipeSpecsTable({ userRole }) {
  const [specs,       setSpecs]       = useState([]);
  const [source,      setSource]      = useState(null);   // 'database' | 'hardcoded'
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [editing,     setEditing]     = useState(null);   // spec id being edited
  const [editDraft,   setEditDraft]   = useState({});
  const [saving,      setSaving]      = useState(false);
  const [restoring,   setRestoring]   = useState(false);
  const [showTable,   setShowTable]   = useState(false);

  const isAdmin = userRole === 'ADMIN';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await copperApi.getPipeSpecs();
      setSpecs(res.data.specs || []);
      setSource(res.data.source);
    } catch {
      setError('Could not load pipe specifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (showTable) load(); }, [showTable, load]);

  const startEdit = spec => {
    setEditing(spec.id);
    setEditDraft({
      weightKLbPerFt:        spec.weightKLbPerFt,
      weightLLbPerFt:        spec.weightLLbPerFt,
      weightMLbPerFt:        spec.weightMLbPerFt,
      distributionFactor:    spec.distributionFactor,
      vrvBaselinePricePerFt: spec.vrvBaselinePricePerFt ?? '',
      insulationCostPerFt:   spec.insulationCostPerFt,
    });
  };

  const cancelEdit = () => { setEditing(null); setEditDraft({}); };

  const saveEdit = async spec => {
    if (!spec.id) { toast.error('Cannot edit hardcoded data — run the DB migration first.'); return; }
    setSaving(true);
    try {
      await copperApi.updatePipeSpec(spec.id, editDraft);
      toast.success(`${spec.nominalSize} updated — engine refreshed.`);
      setEditing(null);
      setEditDraft({});
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!window.confirm('Restore all pipe specs and equipment configs to Grainger-calibrated defaults?')) return;
    setRestoring(true);
    try {
      await copperApi.restoreDefaults();
      toast.success('Calibrated defaults restored.');
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const ef = (field, val) => setEditDraft(d => ({ ...d, [field]: val }));

  const numCell = (spec, field, isEditing) => {
    const raw = spec[field];
    const display = raw != null ? Number(raw).toFixed(field === 'distributionFactor' ? 3 : field.includes('Price') ? 2 : 4) : '—';
    if (!isAdmin || !isEditing) return <span className="font-mono text-xs">{display}</span>;
    return (
      <input
        type="number" step="0.0001" min="0"
        value={editDraft[field] ?? ''}
        onChange={e => ef(field, e.target.value)}
        className="w-20 text-xs font-mono border border-orange-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
      />
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      {/* Collapsible header */}
      <button type="button"
        onClick={() => setShowTable(v => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <Database size={15} className="text-gray-400" />
          <span className="font-semibold text-gray-900">Pipe Specifications Reference Table</span>
          {source && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              source === 'database'
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {source === 'database' ? 'DB active' : 'Hardcoded fallback'}
            </span>
          )}
        </div>
        {showTable
          ? <ChevronUp size={16} className="text-gray-400" />
          : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {showTable && (
        <div className="border-t border-gray-100">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-100">
            <p className="text-xs text-gray-500">
              ASTM B88/B280 weights · Grainger calibration at LME $4.25/lb baseline.
              {isAdmin ? ' Click a row to edit.' : ' Admin access required to edit.'}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={load} disabled={loading}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-white transition-colors disabled:opacity-50">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              {isAdmin && (
                <button type="button" onClick={handleRestore} disabled={restoring}
                  className="flex items-center gap-1.5 text-xs text-amber-700 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-50 transition-colors disabled:opacity-50">
                  {restoring ? <Loader2 size={12} className="animate-spin" /> : <ShieldAlert size={12} />}
                  Restore Defaults
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="px-6 py-3 text-sm text-red-600 bg-red-50 border-b border-red-100">
              {error}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center gap-2 px-6 py-6 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin" />
              <span>Loading specifications…</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Size</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">wK (lb/ft)</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">wL (lb/ft)</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">wM (lb/ft)</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Dist. Factor</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">VRV $/ft</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Insul $/ft</th>
                    {isAdmin && <th className="px-3 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {specs.map(spec => {
                    const isRow = editing === spec.id;
                    return (
                      <tr key={spec.nominalSize}
                        className={`border-b border-gray-50 transition-colors ${
                          isRow ? 'bg-orange-50' : isAdmin && spec.id ? 'hover:bg-gray-50 cursor-pointer' : ''
                        }`}
                        onClick={() => { if (isAdmin && spec.id && !isRow && !editing) startEdit(spec); }}>
                        <td className="px-4 py-2 font-semibold text-gray-800 whitespace-nowrap">{spec.nominalSize}</td>
                        <td className="px-3 py-2 text-right">{numCell(spec, 'weightKLbPerFt', isRow)}</td>
                        <td className="px-3 py-2 text-right">{numCell(spec, 'weightLLbPerFt', isRow)}</td>
                        <td className="px-3 py-2 text-right">{numCell(spec, 'weightMLbPerFt', isRow)}</td>
                        <td className="px-3 py-2 text-right">{numCell(spec, 'distributionFactor', isRow)}</td>
                        <td className="px-3 py-2 text-right">
                          {isAdmin && isRow ? (
                            <input
                              type="number" step="0.01" min="0"
                              placeholder="null"
                              value={editDraft.vrvBaselinePricePerFt ?? ''}
                              onChange={e => ef('vrvBaselinePricePerFt', e.target.value)}
                              className="w-20 text-xs font-mono border border-orange-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-orange-400"
                            />
                          ) : (
                            <span className={`font-mono ${spec.vrvBaselinePricePerFt == null ? 'text-gray-300' : ''}`}>
                              {spec.vrvBaselinePricePerFt != null ? `$${Number(spec.vrvBaselinePricePerFt).toFixed(2)}` : '—'}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{numCell(spec, 'insulationCostPerFt', isRow)}</td>
                        {isAdmin && (
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {isRow ? (
                              <div className="flex items-center gap-1.5 justify-end">
                                <button type="button" onClick={e => { e.stopPropagation(); saveEdit(spec); }}
                                  disabled={saving}
                                  className="text-xs bg-orange-500 text-white px-2.5 py-1 rounded font-semibold hover:bg-orange-600 disabled:opacity-50">
                                  {saving ? '…' : 'Save'}
                                </button>
                                <button type="button" onClick={e => { e.stopPropagation(); cancelEdit(); }}
                                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              spec.id && !editing && (
                                <button type="button" onClick={e => { e.stopPropagation(); startEdit(spec); }}
                                  className="text-xs text-orange-600 hover:text-orange-800 opacity-0 group-hover:opacity-100 px-2 py-1 rounded border border-orange-200 hover:bg-orange-50">
                                  Edit
                                </button>
                              )
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Legend */}
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 space-y-0.5">
                <p><strong>wK/L/M</strong> = Type K / L / M wall weight (lb/ft) — ASTM B88/B280</p>
                <p><strong>Dist. Factor</strong> = GraingerRetail ÷ (wL × $4.25) — encodes mill premium + markup. Editing this changes how retail price scales.</p>
                <p><strong>VRV $/ft</strong> = Baseline retail $/ft at LME $4.25/lb (Grainger −10% trade). Changes propagate to all VRV per-size calculations.</p>
                <p><strong>Insul $/ft</strong> = Foam insulation cost (fixed — not LME-linked).</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Copper Settings Tab ───────────────────────────────────────────────────────

const EQUIP_LABELS = {
  split:       'Split Systems',
  wallMounted: 'Wall Mounted',
  vrv:         'VRF Systems',
  ahuWithCU:   'AHU with CU',
};

const TONNAGE_BRACKETS = [0, 5, 10, 20, 50, 75];

function CopperTab({ config, setCopperSetting, setCopperSafetyFactor, setCopperFraction, userRole }) {
  const cs = config.copperSettings ?? DEFAULT_COPPER_SETTINGS;
  const [showAdvanced, setShowAdvanced] = useState(false);

  const lme      = Number(cs.lmeCopperPrice) || 4.25;
  const baseline = 4.25;
  const pctChange = ((lme - baseline) / baseline * 100).toFixed(1);
  const lmeColor  = lme > baseline ? 'text-red-600' : lme < baseline ? 'text-green-600' : 'text-gray-500';

  return (
    <div className="space-y-6">

      {/* LME Price — the one global factor that drives all copper costs */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap size={16} className="text-orange-500" />
          <h2 className="font-semibold text-gray-900">LME Copper Spot Price</h2>
          {lme !== baseline && (
            <span className={`ml-auto text-sm font-bold ${lmeColor}`}>
              {pctChange > 0 ? '+' : ''}{pctChange}% vs $4.25 baseline
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Update whenever the LME price changes — all unit rows recompute instantly.
          Per-unit inputs (pipe type, run length, insulation) are set inside each row of the Unit Schedule.
        </p>
        <div className="flex items-center gap-3">
          <div className="relative w-40">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number" min="0" step="0.01"
              value={lme}
              onChange={e => setCopperSetting('lmeCopperPrice', parseFloat(e.target.value) || 4.25)}
              className="input w-full pl-7"
            />
          </div>
          <span className="text-sm text-gray-500">/lb &nbsp;·&nbsp; Baseline: $4.25/lb</span>
        </div>
        <p className="mt-3 text-xs text-orange-600 opacity-75">
          Only raw copper content scales with LME — labor and fittings stay fixed.
          Formula: <em>new $/ft = baseline + weight_lb/ft × (LME − $4.25)</em>
        </p>
      </div>

      {/* Refrigerant Cylinder Price */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧯</span>
          <h2 className="font-semibold text-gray-900">Refrigerant Supplemental Charge</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Auto-calculated for all Split, Wall Mount, and VRF units based on total line-set length.
          The base cylinder price anchors the entire table — all tonnage and length factors scale from it.
          Formula: <em>charge = cylinderPrice × tonFactor × lengthFactor</em>
        </p>
        <div className="flex items-start gap-8">
          {/* Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base Cylinder Price</label>
            <div className="relative w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number" min="0" step="5"
                value={Number(cs.refrigCylinderPrice) || 280}
                onChange={e => setCopperSetting('refrigCylinderPrice', parseFloat(e.target.value) || 280)}
                className="input w-full pl-7"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Default $280 · 0-5 ton @ &lt;50 ft</p>
          </div>
          {/* Live preview table */}
          <div className="flex-1 overflow-x-auto">
            {(() => {
              const cp = Number(cs.refrigCylinderPrice) || 280;
              const tonFactors = { 0: 1.000, 5: 1.000, 10: 1.500, 20: 2.250, 50: 4.375, 75: 8.750 };
              const lenFactors = [{ label: '<50 ft', f: 1.0 }, { label: '<100 ft', f: 1.25 }, { label: '≥100 ft', f: 1.5625 }];
              const fmt = n => '$' + Math.round(n).toLocaleString();
              return (
                <table className="text-xs border-collapse w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-200 px-3 py-1.5 text-left font-semibold text-gray-600">Size</th>
                      {lenFactors.map(l => (
                        <th key={l.label} className="border border-gray-200 px-3 py-1.5 text-right font-semibold text-gray-600">{l.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(tonFactors).map(([ton, tf]) => (
                      <tr key={ton} className="even:bg-gray-50">
                        <td className="border border-gray-200 px-3 py-1 font-medium text-gray-700">{ton} ton</td>
                        {lenFactors.map(l => (
                          <td key={l.label} className="border border-gray-200 px-3 py-1 text-right font-mono text-gray-700">
                            {fmt(cp * tf * l.f)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Safety Factors */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="font-semibold text-gray-900 mb-1">Safety / Contingency Factors</h2>
        <p className="text-xs text-gray-400 mb-5">
          Applied on top of the calculated copper cost per equipment type. 1.10 = +10% contingency.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(EQUIP_LABELS).map(([key, label]) => (
            <FieldGroup key={key} label={label}>
              <div className="relative">
                <input
                  type="number" min="1.0" max="2.0" step="0.01"
                  value={cs.safetyFactors?.[key] ?? DEFAULT_COPPER_SETTINGS.safetyFactors[key]}
                  onChange={e => setCopperSafetyFactor(key, parseFloat(e.target.value) || 1.0)}
                  className="input w-full pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">×</span>
              </div>
            </FieldGroup>
          ))}
        </div>
      </div>

      {/* Advanced: Copper Fractions */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors">
          <div>
            <span className="font-semibold text-gray-900">Advanced — Copper Fractions</span>
            <p className="text-xs text-gray-400 mt-0.5">
              Fraction of installed cost that tracks LME. Calibrated from Grainger data at $4.25/lb.
              Only change these if you have measured data from your supplier.
            </p>
          </div>
          {showAdvanced ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {showAdvanced && (
          <div className="border-t border-gray-100 px-6 pb-6 pt-4 space-y-6">
            {Object.entries(EQUIP_LABELS).map(([equipKey, equipLabel]) => (
              <div key={equipKey}>
                <h3 className="text-sm font-medium text-gray-700 mb-3">{equipLabel}</h3>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                  {TONNAGE_BRACKETS.map(ton => {
                    const val = cs.copperFractions?.[equipKey]?.[ton]
                      ?? DEFAULT_COPPER_SETTINGS.copperFractions[equipKey]?.[ton]
                      ?? 0.45;
                    return (
                      <div key={ton}>
                        <label className="block text-xs text-gray-400 mb-1">
                          {ton === 0 ? '<5 ton' : `${ton} ton`}
                        </label>
                        <div className="relative">
                          <input
                            type="number" min="0" max="1" step="0.01"
                            value={val}
                            onChange={e => setCopperFraction(equipKey, ton, parseFloat(e.target.value) || 0)}
                            className="input w-full pr-6 text-xs"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">cf</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pipe Specifications Reference Table — DB-backed */}
      <PipeSpecsTable userRole={userRole} />

    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'rates',           label: 'Labor Rates',    icon: Wrench     },
  { id: 'markup',          label: 'Markup & Waste', icon: TrendingUp },
  { id: 'duct',            label: 'Duct Pricing',   icon: Wind       },
  { id: 'copper',          label: 'Copper',         icon: Zap        },
  { id: 'accessories',     label: 'Accessories',    icon: LayoutList },
  { id: 'pricing-tables',  label: 'Pricing Tables', icon: Table2     },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const {
    companySettings, saveCompanySettings, configLoading, configError,
    prices, setPrices,
  } = useContext(SettingsContext);

  // Settings page always works on company-wide defaults, never on project overrides
  const pricingConfig    = companySettings;
  const savePricingConfig = saveCompanySettings;
  const overhead = {
    overheadPct: companySettings.overheadPct,
    profitPct:   companySettings.profitPct,
  };
  const setOverhead = useCallback((value) => {
    const updates = typeof value === 'function' ? value(overhead) : value;
    saveCompanySettings(updates).catch(() => {});
  }, [overhead, saveCompanySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  const [tab,    setTab]    = useState('rates');
  const [draft,  setDraft]  = useState(null);
  const [saving, setSaving] = useState(false);

  const config = draft ?? pricingConfig;

  const set = (key, value) =>
    setDraft(prev => ({ ...(prev ?? pricingConfig), [key]: value }));

  // Copper-specific nested setters
  const setCopperSetting = (key, value) =>
    setDraft(prev => {
      const base = prev ?? pricingConfig;
      return { ...base, copperSettings: { ...(base.copperSettings ?? DEFAULT_COPPER_SETTINGS), [key]: value } };
    });

  const setCopperSafetyFactor = (equipType, value) =>
    setDraft(prev => {
      const base = prev ?? pricingConfig;
      const cs   = base.copperSettings ?? DEFAULT_COPPER_SETTINGS;
      return { ...base, copperSettings: { ...cs, safetyFactors: { ...cs.safetyFactors, [equipType]: value } } };
    });

  const setCopperFraction = (equipType, tonnage, value) =>
    setDraft(prev => {
      const base = prev ?? pricingConfig;
      const cs   = base.copperSettings ?? DEFAULT_COPPER_SETTINGS;
      return {
        ...base,
        copperSettings: {
          ...cs,
          copperFractions: {
            ...cs.copperFractions,
            [equipType]: { ...cs.copperFractions?.[equipType], [tonnage]: value },
          },
        },
      };
    });

  // Accessory price override setters
  const setAccessoryOverride = (section, key, value) =>
    setDraft(prev => {
      const base = prev ?? pricingConfig;
      const ao   = base.accessoryPriceOverrides ?? DEFAULT_ACCESSORY_OVERRIDES;
      return { ...base, accessoryPriceOverrides: { ...ao, [section]: { ...ao[section], [key]: value === '' ? '' : value } } };
    });

  const resetAccessoryOverride = (section, key) =>
    setDraft(prev => {
      const base = prev ?? pricingConfig;
      const ao   = base.accessoryPriceOverrides ?? DEFAULT_ACCESSORY_OVERRIDES;
      const next = { ...ao[section] };
      delete next[key];
      return { ...base, accessoryPriceOverrides: { ...ao, [section]: next } };
    });

  const resetAllAccessoryOverrides = () =>
    setDraft(prev => ({ ...(prev ?? pricingConfig), accessoryPriceOverrides: DEFAULT_ACCESSORY_OVERRIDES }));

  const handleSave = async () => {
    if (!draft) { toast('No changes to save.'); return; }
    setSaving(true);
    try {
      await savePricingConfig(draft);
      setDraft(null);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = draft !== null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            These are company-wide defaults. Estimators can override any value on a per-project basis
            from the project detail page — company settings will not be affected.
          </p>
        </div>
        <button onClick={handleSave} disabled={!isDirty || saving}
          className="btn-primary flex items-center gap-2 px-5 py-2 disabled:opacity-40">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>

      {/* Error banner */}
      {configError && (
        <div className="mb-5 flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>Could not load settings from server - showing cached values. ({configError})</span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}>
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {configLoading && tab !== 'duct' && (
        <div className="flex items-center gap-2 text-gray-400 py-6">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Loading settings...</span>
        </div>
      )}

      {/* LABOR RATES */}
      {tab === 'rates' && !configLoading && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-1">HVAC Equipment</h2>
            <p className="text-xs text-gray-400 mb-5">Installation labor rate ($/hr) for each equipment type.</p>
            <div className="grid grid-cols-2 gap-4">
              <RateInput label="Packaged Units (RTU / AHU)" hint="Rooftop and packaged air handlers"
                value={config.ratePackaged} onChange={v => set('ratePackaged', v)} />
              <RateInput label="Split Systems" hint="Split condensers + air handlers"
                value={config.rateSplit} onChange={v => set('rateSplit', v)} />
              <RateInput label="Wall-Mount / Mini-Splits" hint="Ductless wall-mounted units"
                value={config.rateWallMount} onChange={v => set('rateWallMount', v)} />
              <RateInput label="VRF Systems" hint="Variable refrigerant flow"
                value={config.rateVrf} onChange={v => set('rateVrf', v)} />
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Sheet Metal &amp; Piping</h2>
            <p className="text-xs text-gray-400 mb-5">Fabrication and installation labor rate ($/hr).</p>
            <div className="grid grid-cols-2 gap-4">
              <RateInput label="Sheet Metal / Duct" hint="Duct fabrication and installation"
                value={config.rateDuct} onChange={v => set('rateDuct', v)} />
              <RateInput label="Fans" hint="Fan installation"
                value={config.rateFan} onChange={v => set('rateFan', v)} />
              <RateInput label="Piping (Chilled Water)" hint="CW pipe installation"
                value={config.ratePipe} onChange={v => set('ratePipe', v)} />
              <RateInput label="Electrical / Controls" hint="Controls and electrical connections"
                value={config.rateElec} onChange={v => set('rateElec', v)} />
            </div>
          </div>
        </div>
      )}

      {/* MARKUP & WASTE */}
      {tab === 'markup' && !configLoading && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Markup Rates</h2>
            <p className="text-xs text-gray-400 mb-5">Applied to all direct costs at the bid summary level.</p>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <PctInput label="Overhead %" hint="Company operating costs"
                value={config.overheadPct} onChange={v => set('overheadPct', v)} />
              <PctInput label="Profit %" hint="Applied after overhead"
                value={config.profitPct} onChange={v => set('profitPct', v)} />
              <PctInput label="Tax %" hint="Sales / use tax (if applicable)"
                value={config.taxPct} onChange={v => set('taxPct', v)} />
            </div>
            <MarkupPreview config={config} />
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="font-semibold text-gray-900 mb-1">Material Waste Factors</h2>
            <p className="text-xs text-gray-400 mb-5">
              Extra material ordered to account for cuts, fittings, and field waste.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <PctInput label="Duct Waste Factor" hint="Typically 10-15% for sheet metal"
                value={config.ductWastePct} onChange={v => set('ductWastePct', v)} />
              <PctInput label="Pipe Waste Factor" hint="Typically 10% for CW piping"
                value={config.pipeWastePct} onChange={v => set('pipeWastePct', v)} />
            </div>
          </div>
        </div>
      )}

      {/* DUCT PRICING */}
      {tab === 'duct' && (
        <PriceSettings
          prices={prices}
          overhead={overhead}
          onPricesChange={setPrices}
          onOverheadChange={setOverhead}
          onClose={() => {}}
        />
      )}

      {/* COPPER */}
      {tab === 'copper' && !configLoading && (
        <CopperTab
          config={config}
          setCopperSetting={setCopperSetting}
          setCopperSafetyFactor={setCopperSafetyFactor}
          setCopperFraction={setCopperFraction}
          userRole={user?.role}
        />
      )}

      {/* ACCESSORIES */}
      {tab === 'accessories' && !configLoading && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-1">
              <LayoutList size={16} className="text-gray-500" />
              <h2 className="font-semibold text-gray-900">Accessory Material Prices</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              Override any accessory price with a fixed flat rate — applies to all tonnages.
              Leave blank to use the default tonnage-based table value.
              Changes take effect after clicking <strong>Save changes</strong>.
            </p>
            <AccessoryPriceSettings
              standalone
              overrides={config.accessoryPriceOverrides ?? DEFAULT_ACCESSORY_OVERRIDES}
              pricingTables={config.unitPricingTables}
              onSet={setAccessoryOverride}
              onReset={resetAccessoryOverride}
              onResetAll={resetAllAccessoryOverrides}
            />
          </div>
        </div>
      )}

      {/* PRICING TABLES */}
      {tab === 'pricing-tables' && !configLoading && (
        <PricingTablesEditor
          config={config}
          onSave={(updates) => {
            setDraft(prev => ({ ...(prev ?? pricingConfig), ...updates }));
            return savePricingConfig({ ...(draft ?? pricingConfig), ...updates });
          }}
          saving={saving}
        />
      )}

      {/* Dirty save bar */}
      {isDirty && tab !== 'duct' && tab !== 'pricing-tables' && (
        <div className="mt-8 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-5 py-3">
          <span className="text-sm text-amber-700 font-medium">You have unsaved changes.</span>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary flex items-center gap-2 px-5 py-2 disabled:opacity-40">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}
