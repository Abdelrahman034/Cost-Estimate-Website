/**
 * CopperInputPanel
 * Per-row copper line-set pricing panel (Run Length mode only).
 *
 * User picks Pipe Type (K/L/M) and enters an average run length.
 * VRF rows pass showLengthField=false because their length comes from
 * the "Avg CU Line" field in the main row inputs.
 *
 * LME price and safety factors are company-wide (Settings → Copper tab)
 * and shown read-only here.
 */
import React, { useContext } from 'react';
import { Zap } from 'lucide-react';
import { NumInput } from './shared';
import { SettingsContext, DEFAULT_COPPER_SETTINGS } from '@contexts/SettingsContext';

const TYPE_OPTIONS = [
  { value: 'L', label: 'Type L', hint: 'Medium wall — standard HVAC' },
  { value: 'K', label: 'Type K', hint: 'Heavy wall — more copper, higher cost & labor' },
  { value: 'M', label: 'Type M', hint: 'Light wall — less copper, lower cost & labor' },
];

const fmt = n =>
  (n ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function CopperInputPanel({
  copper = {},
  onChange,
  result,
  loading,
  showLengthField = true,
  equipType,
}) {
  const { copperSettings } = useContext(SettingsContext);
  const cs  = copperSettings ?? DEFAULT_COPPER_SETTINGS;
  const lme = Number(cs.lmeCopperPrice) || 4.25;
  const sf  = cs.safetyFactors?.[equipType] ?? 1.10;

  const baseline = 4.25;
  const pctChg   = ((lme - baseline) / baseline * 100).toFixed(1);
  const lmeColor = lme > baseline ? 'text-red-600' : lme < baseline ? 'text-green-600' : 'text-gray-400';

  const ch = field => value => onChange(field, value);

  return (
    <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">

      {/* Header — active LME from settings (read-only) */}
      <div className="flex items-center gap-2 mb-3">
        <Zap size={13} className="text-orange-500 flex-shrink-0" />
        <span className="text-xs font-semibold text-orange-700 uppercase tracking-wide">
          Copper Line Set
        </span>
        <span className="text-xs text-gray-500 ml-1">
          LME <strong>${lme.toFixed(2)}</strong>/lb
        </span>
        {lme !== baseline && (
          <span className={`text-xs font-semibold ${lmeColor}`}>
            ({pctChg > 0 ? '+' : ''}{pctChg}%)
          </span>
        )}
        <span className="text-xs text-gray-400 ml-1">· sf ×{sf.toFixed(2)}</span>
      </div>

      {/* Inputs */}
      <div className="flex flex-wrap gap-3 items-end">

        {/* Pipe Type — K/L/M; weight ratio scales both material and labor */}
        <div className="flex-shrink-0">
          <label className="text-xs text-gray-500 font-medium block mb-1">
            Pipe Type
            <span className="text-gray-400 font-normal ml-1">(affects material &amp; labor)</span>
          </label>
          <div className="flex rounded border border-orange-200 overflow-hidden text-xs">
            {TYPE_OPTIONS.map(opt => (
              <button key={opt.value} type="button"
                title={opt.hint}
                onClick={() => onChange('copperType', opt.value)}
                className={`px-3 py-1.5 font-semibold transition-colors ${
                  (copper.copperType || 'L') === opt.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-orange-50'
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {TYPE_OPTIONS.find(o => o.value === (copper.copperType || 'L'))?.hint}
          </p>
        </div>

        {/* Run length */}
        {showLengthField ? (
          <div className="w-32">
            <label className="text-xs text-gray-500 font-medium block mb-1">Avg Run (ft)</label>
            <NumInput
              value={copper.avgLengthFt || 0}
              onChange={ch('avgLengthFt')}
              placeholder="0"
            />
          </div>
        ) : (
          <div className="text-xs text-gray-400 self-end pb-1.5">
            Length from <strong>"Avg CU Line"</strong> field above
          </div>
        )}

        {/* Insulation toggle */}
        <div className="flex flex-col gap-1 self-end">
          <label className="text-xs text-gray-500 font-medium">Insulation</label>
          <button type="button"
            onClick={() => onChange('includeInsulation', !copper.includeInsulation)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              copper.includeInsulation
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
            }`}>
            {copper.includeInsulation ? '✓ Include' : 'Exclude'}
          </button>
        </div>

      </div>

      {/* Live result strip */}
      {(result || loading) && (
        <div className={`mt-3 flex flex-wrap gap-3 rounded-md px-3 py-2 text-xs
          ${loading ? 'bg-gray-100 animate-pulse' : 'bg-white border border-orange-200'}`}>
          {loading ? (
            <span className="text-gray-400">Computing copper cost…</span>
          ) : result ? (
            <>
              <span>
                <span className="text-gray-400">Material </span>
                <strong className="text-orange-700">{fmt(result.material)}</strong>
              </span>
              {result.perFt != null && (
                <span>
                  <span className="text-gray-400">$/ft </span>
                  <strong className="text-orange-700">${result.perFt.toFixed(2)}</strong>
                </span>
              )}
              {result.liquidLine && (
                <span className="text-gray-400">
                  Liq {result.liquidLine.size} + Suc {result.suctionLine.size}
                </span>
              )}
              {result.insulationCost > 0 && (
                <span>
                  <span className="text-gray-400">Insul </span>
                  <span className="text-blue-600">{fmt(result.insulationCost)}</span>
                </span>
              )}
              {result.lmeInfo && (
                <span className="ml-auto text-gray-400">
                  LME {result.lmeInfo.percentChange >= 0 ? '+' : ''}{result.lmeInfo.percentChange.toFixed(1)}% vs $4.25
                </span>
              )}
            </>
          ) : null}
        </div>
      )}

    </div>
  );
}
