/**
 * GeneralModule — "General Items" tab
 *
 * Mirrors the Excel "General" sheet exactly:
 *   • 8 sub-calculators (Permitting, Logistics, Crane, Demo, Rentals, Air Balance, Warranty, Travel)
 *   • 2 free-entry rows (NA rows)
 *   • Summary table at the top rolling up Mat + Labor totals
 *
 * Cross-module context (auto-filled in project mode, manually entered otherwise):
 *   directJobCost     — total mat+labor from all schedules
 *   scheduleLaborCost — labor from schedules only (used by Logistics, Travel)
 *   totalLaborCost    — grand total labor incl. general (used by Rentals)
 *   totalTons         — installed cooling tons (Warranty)
 *   totalUnits        — installed unit count (Warranty)
 *   grillCount        — diffuser count (Air Balance)
 */
import React, { useState, useCallback, useEffect, useContext } from 'react';
import { ChevronDown, ChevronRight, Calculator, Download, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  calcGeneralBatch,
  DEFAULTS,
  CRANE_TABLE,
  DUCT_DEMO_TABLE,
  RENTALS_TABLE,
} from '@utils/generalCalculations';
import { useEstimate } from '@hooks/useEstimate';
import { useAutoSave } from '@hooks/useAutoSave';
import { estimatesApi } from '@services/estimatesApi';
import EstimateProjectBanner from '@components/EstimateProjectBanner';
import { SettingsContext } from '@contexts/SettingsContext';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const fmt = (n) =>
  n == null || n === '' ? '—'
  : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function YesNoToggle({ value, onChange, yesLabel = 'Yes', noLabel = 'No' }) {
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold w-fit">
      {['Yes', 'No'].map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 transition-all ${
            value === opt
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-400 hover:bg-gray-50'
          }`}
        >
          {opt === 'Yes' ? yesLabel : noLabel}
        </button>
      ))}
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div className="grid grid-cols-12 gap-3 items-start py-2.5 border-b border-gray-50 last:border-0">
      <div className="col-span-4">
        <div className="text-sm font-medium text-gray-700">{label}</div>
        {hint && <div className="text-[11px] text-gray-400 mt-0.5 leading-tight">{hint}</div>}
      </div>
      <div className="col-span-8 flex items-center gap-3 flex-wrap">{children}</div>
    </div>
  );
}

function NumInput({ value, onChange, prefix = '$', min = 0, step = 1, className = '' }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{prefix}</span>}
      <input
        type="number"
        min={min}
        step={step}
        value={value ?? ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={`input text-sm ${prefix ? 'pl-5' : ''} w-28 ${className}`}
      />
    </div>
  );
}

function ResultBadge({ label, value, color = 'gray' }) {
  const colors = {
    gray:  'bg-gray-100 text-gray-700',
    green: 'bg-green-50 text-green-700',
    blue:  'bg-blue-50 text-blue-700',
    total: 'bg-gray-900 text-white',
  };
  return (
    <div className={`rounded-lg px-3 py-1.5 text-xs ${colors[color]}`}>
      <div className="text-[10px] font-medium opacity-70 mb-0.5">{label}</div>
      <div className="font-bold font-mono">{fmt(value)}</div>
    </div>
  );
}

function SectionCard({ title, subtitle, result, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const active = result?.required === 'Yes';

  return (
    <div className={`rounded-xl border transition-all ${active ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
          <div>
            <span className="font-semibold text-gray-800 text-sm">{title}</span>
            {subtitle && <span className="text-xs text-gray-400 ml-2">{subtitle}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {result && (
            <>
              {result.required === 'Yes' ? (
                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Required</span>
              ) : (
                <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Not required</span>
              )}
              {result.totalCost > 0 && (
                <span className="text-sm font-bold text-gray-900 font-mono">{fmt(result.totalCost)}</span>
              )}
            </>
          )}
        </div>
      </button>
      {open && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{children}</div>}
    </div>
  );
}

// ─── DEFAULT STATE ────────────────────────────────────────────────────────────

const defaultInputs = () => ({
  permitting:  { required: 'Yes', incRate: DEFAULTS.permitting.incRate },
  logistics:   { required: 'Yes', logisticsRate: DEFAULTS.fieldLogistics.logisticsRate, incRate: 0 },
  craneNew:    { required: 'No',  liftedUnitCount: 0, extraLiftDays: 0, sizeCategory: 'Small', incRate: 0 },
  demolition:  { required: 'No',  splitsToDemoCount: 0, rtusToDemoCount: 0, cranedUnitCount: 0, xlDuctRuns: 0, lDuctRuns: 0, mDuctRuns: 0, sDuctRuns: 0, partialDuctDiscount: 0, incRate: 0 },
  rentals:     { required: 'Yes', incRate: 0 },
  airBalance:  { required: 'Yes', mercuryProvided: 'No', systemsToBalance: 0, incRate: 0 },
  warranty:    { required: 'Yes', perTonRate: 10, perUnitRate: 50, incRate: 0 },
  teamTravel:  { required: 'No',  perDiemRate: 0.15, accommodationRate: 0.20, incRate: 0 },
});

const defaultContext = () => ({
  directJobCost:     0,
  scheduleLaborCost: 0,
  totalLaborCost:    0,
  totalTons:         0,
  totalUnits:        0,
  grillCount:        0,
});

const defaultFreeRows = () => [
  { label: 'NA', matCost: 0, laborCost: 0 },
  { label: 'NA', matCost: 0, laborCost: 0 },
];

// ─── MAIN MODULE ─────────────────────────────────────────────────────────────

export default function GeneralModule() {
  const { activeProjectId } = useContext(SettingsContext);
  const [inputs,   setInputs]   = useState(defaultInputs());
  const [context,  setContext]  = useState(defaultContext());
  const [freeRows, setFreeRows] = useState(defaultFreeRows());
  const [results,  setResults]  = useState(null);

  const { projectId, projectName, loadEstimate, saveEstimate, saving, lastSaved, saveError } = useEstimate('GENERAL_ITEMS');

  const payload = { inputs, context, freeRows };

  // Build the full save payload including computed totals so Summary can read them.
  const buildSavePayload = useCallback((currentResults) => {
    const s = currentResults?.summary;
    return {
      rowsJson:      payload,
      totalMaterial: s?.totalMat   ?? 0,
      totalLabor:    s?.totalLabor ?? 0,
      totalCost:     s?.grandTotal ?? 0,
    };
  }, [payload]); // eslint-disable-line

  const { markAsLoaded } = useAutoSave(
    payload,
    () => saveEstimate(buildSavePayload(results)),
    !!projectId,
  );

  // Auto-populate context fields from sibling module estimates on load.
  const populateContext = useCallback(async (pid) => {
    try {
      const all = await estimatesApi.list(pid);
      const SCHEDULE_MODULES = ['METAL_DUCT','UNIT_SCHEDULE','DIFFUSER_SCHEDULE',
                                 'FAN_SCHEDULE','ELECTRIC_HEAT','LOUVERS_DAMPERS'];
      const schedules = all.filter(e => SCHEDULE_MODULES.includes(e.module));

      const directJobCost     = schedules.reduce((s, e) => s + (Number(e.totalMaterial) || 0) + (Number(e.totalLabor) || 0), 0);
      const scheduleLaborCost = schedules.reduce((s, e) => s + (Number(e.totalLabor)    || 0), 0);

      // Tons + unit count from UNIT_SCHEDULE
      const unitEst   = all.find(e => e.module === 'UNIT_SCHEDULE');
      const totalTons = Number(unitEst?.totalsJson?.totalTons) || 0;
      // rowsJson is { serviceRows, packagedRows, splitRows, wallMountRows, vrfRows }
      let totalUnits = 0;
      if (unitEst) {
        const full = await estimatesApi.getByModule(pid, 'UNIT_SCHEDULE');
        const rj = full?.rowsJson;
        if (rj && typeof rj === 'object') {
          const isFilled = r => r.name?.trim() || Number(r.coolTons) > 0;
          const groups = ['serviceRows','packagedRows','splitRows','wallMountRows'];
          groups.forEach(g => {
            if (Array.isArray(rj[g])) totalUnits += rj[g].filter(isFilled).length;
          });
          // VRF: count condensingUnits + indoorUnits per filled row
          if (Array.isArray(rj.vrfRows)) {
            rj.vrfRows.filter(isFilled).forEach(r => {
              totalUnits += (Number(r.condensingUnits) || 1) + (Number(r.indoorUnits) || 1);
            });
          }
        }
      }

      // Grill/diffuser count from DIFFUSER_SCHEDULE rowsJson (flat array of rows with qty)
      let grillCount = 0;
      const diffEst = all.find(e => e.module === 'DIFFUSER_SCHEDULE');
      if (diffEst) {
        const full = await estimatesApi.getByModule(pid, 'DIFFUSER_SCHEDULE');
        if (Array.isArray(full?.rowsJson)) {
          grillCount = full.rowsJson.reduce((s, r) => s + (Number(r.qty) || 0), 0);
        }
      }

      setContext(prev => ({
        ...prev,
        directJobCost,
        scheduleLaborCost,
        // totalLaborCost is set after results are computed (scheduleLaborCost + general labor)
        totalLaborCost: scheduleLaborCost,
        totalTons,
        totalUnits,
        grillCount,
      }));
    } catch {
      // silently skip — user can fill manually
    }
  }, []);

  useEffect(() => {
    if (!projectId) return;
    // Always refresh context from sibling modules so Cross-Module Inputs stay current.
    populateContext(projectId);
    loadEstimate().then(est => {
      if (est?.rowsJson) {
        const { inputs: i, freeRows: f } = est.rowsJson;
        // Restore user inputs and free rows, but NOT context — that comes from populateContext.
        if (i) setInputs(i);
        if (f) setFreeRows(f);
        markAsLoaded(est.rowsJson);
      } else {
        markAsLoaded(null);
      }
    });
  }, [loadEstimate, projectId]); // eslint-disable-line

  // Calculate on every change (live).
  useEffect(() => {
    setResults(calcGeneralBatch(inputs, context, freeRows));
  }, [inputs, context, freeRows]);

  // Fix #3: whenever results change, push updated totals to DB so Summary stays in sync.
  // Also keep totalLaborCost (used by Rentals) = scheduleLaborCost + general labor.
  useEffect(() => {
    if (!results) return;
    const generalLabor = results.summary?.totalLabor ?? 0;
    setContext(prev => {
      const updated = prev.scheduleLaborCost + generalLabor;
      if (updated === prev.totalLaborCost) return prev; // no change, avoid re-render loop
      return { ...prev, totalLaborCost: updated };
    });
    if (!projectId) return;
    saveEstimate(buildSavePayload(results));
  }, [results]); // eslint-disable-line

  const setSection = useCallback((section, key, value) => {
    setInputs(prev => ({ ...prev, [section]: { ...prev[section], [key]: value } }));
  }, []);

  const setCtx = useCallback((key, value) => {
    setContext(prev => ({ ...prev, [key]: value }));
  }, []);

  const setFreeRow = useCallback((i, key, value) => {
    setFreeRows(prev => prev.map((r, idx) => idx === i ? { ...r, [key]: value } : r));
  }, []);

  const exportCSV = () => {
    if (!results) return;
    const { summaryRows, summary } = results;
    const lines = [
      ['Item', 'Material ($)', 'Labor ($)', 'Total ($)'].join(','),
      ...summaryRows.map(r => [r.label, r.mat, r.labor, r2(r.mat + r.labor)].join(',')),
      ['Totals', summary.totalMat, summary.totalLabor, summary.grandTotal].join(','),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'general_items.csv'; a.click();
  };

  const r2 = n => Math.round(n * 100) / 100;
  const s  = results;

  return (
    <div className="max-w-4xl mx-auto">
      <EstimateProjectBanner
        projectId={projectId} projectName={projectName}
        saving={saving} lastSaved={lastSaved} saveError={saveError}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Items</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Permitting, logistics, crane, demolition, rentals, air balance, warranty &amp; travel
          </p>
        </div>
        {s && (
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={15} /> Export CSV
          </button>
        )}
      </div>

      {/* ── Project Context Inputs ──────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Info size={15} className="text-blue-500" />
          <h3 className="font-semibold text-gray-700 text-sm">Cross-Module Inputs</h3>
          <span className="text-[11px] text-gray-400">Auto-filled in project mode — or enter manually</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { key: 'directJobCost',     label: 'Direct Job Cost ($)',       hint: 'Total mat+labor from all schedules' },
            { key: 'scheduleLaborCost', label: 'Schedule Labor Cost ($)',    hint: 'Labor from schedules only (Logistics, Travel)' },
            { key: 'totalLaborCost',    label: 'Grand Total Labor ($)',      hint: 'Incl. general items (Rentals)' },
            { key: 'totalTons',         label: 'Installed Cooling (tons)',   hint: 'From Unit Schedule' },
            { key: 'totalUnits',        label: 'Installed Units',            hint: 'From Unit Schedule' },
            { key: 'grillCount',        label: 'Grills / Diffusers (count)', hint: 'From Diffuser Schedule' },
          ].map(({ key, label, hint }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
              <input
                type="number" min="0" step="1"
                className="input text-sm w-full"
                value={context[key] || ''}
                onChange={e => setCtx(key, parseFloat(e.target.value) || 0)}
              />
              <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary Table ───────────────────────────────────────────────────── */}
      {s && (
        <div className="card mb-5 bg-gray-50">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Summary — General Items</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-semibold text-gray-500 text-xs">Item</th>
                <th className="text-right py-2 font-semibold text-green-700 text-xs">Material</th>
                <th className="text-right py-2 font-semibold text-blue-700 text-xs">Labor</th>
                <th className="text-right py-2 font-semibold text-gray-700 text-xs">Total</th>
              </tr>
            </thead>
            <tbody>
              {s.summaryRows.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 text-gray-700">{row.label}</td>
                  <td className="py-2 text-right font-mono text-gray-600">{row.mat > 0 ? fmt(row.mat) : '—'}</td>
                  <td className="py-2 text-right font-mono text-gray-600">{row.labor > 0 ? fmt(row.labor) : '—'}</td>
                  <td className="py-2 text-right font-mono font-semibold text-gray-800">{fmt(row.mat + row.labor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300">
                <td className="py-3 font-bold text-gray-900">Totals</td>
                <td className="py-3 text-right font-bold font-mono text-green-700">{fmt(s.summary.totalMat)}</td>
                <td className="py-3 text-right font-bold font-mono text-blue-700">{fmt(s.summary.totalLabor)}</td>
                <td className="py-3 text-right font-bold font-mono text-gray-900 text-base">{fmt(s.summary.grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Section Calculators ─────────────────────────────────────────────── */}
      <div className="space-y-3">

        {/* 1. Permitting */}
        <SectionCard title="Permitting" result={s?.permitting} defaultOpen>
          <FieldRow label="Required" hint="Permit required aside from AC system changeouts or service">
            <YesNoToggle value={inputs.permitting.required} onChange={v => setSection('permitting','required',v)} />
          </FieldRow>
          <FieldRow label="Direct Job Cost" hint="Auto-filled from cross-module inputs above">
            <span className="font-mono text-sm text-gray-700">{fmt(context.directJobCost)}</span>
          </FieldRow>
          <FieldRow label="Base Cost (%)" hint="MAX(0.5% of project cost, $175) — Excel cell C20">
            <span className="font-mono text-sm text-blue-700">{fmt(s?.permitting.baseCost)}</span>
            <span className="text-xs text-gray-400">= MAX(0.5% × {fmt(context.directJobCost)}, $175)</span>
          </FieldRow>
          <FieldRow label="Incidental Rate" hint="Multiplied on top of base cost">
            <NumInput value={Math.round((inputs.permitting.incRate ?? 0.10) * 100)} onChange={v => setSection('permitting','incRate',v/100)} prefix="" step={1} />
            <span className="text-xs text-gray-400">%</span>
          </FieldRow>
          {s?.permitting && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <ResultBadge label="Base Cost" value={s.permitting.baseCost} />
              <ResultBadge label="Incidental" value={s.permitting.incCost} />
              <ResultBadge label="Total" value={s.permitting.totalCost} color="total" />
            </div>
          )}
        </SectionCard>

        {/* 2. Field Logistics */}
        <SectionCard title="Field Logistics" result={s?.logistics}>
          <FieldRow label="Required" hint="Required for all jobs currently">
            <YesNoToggle value={inputs.logistics.required} onChange={v => setSection('logistics','required',v)} />
          </FieldRow>
          <FieldRow label="Schedule Labor Total" hint="Auto-filled from cross-module inputs (D28)">
            <span className="font-mono text-sm text-gray-700">{fmt(context.scheduleLaborCost)}</span>
          </FieldRow>
          <FieldRow label="Logistics Rate" hint="Relative to field labor — default 6% ($45k/$750k)">
            <NumInput value={Math.round((inputs.logistics.logisticsRate ?? 0.06) * 100)} onChange={v => setSection('logistics','logisticsRate',v/100)} prefix="" step={1} />
            <span className="text-xs text-gray-400">%</span>
          </FieldRow>
          {s?.logistics && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <ResultBadge label="Base Cost" value={s.logistics.baseCost} />
              <ResultBadge label="Total" value={s.logistics.totalCost} color="total" />
            </div>
          )}
        </SectionCard>

        {/* 3. Crane Service */}
        <SectionCard title="Crane Service (New Units)" result={s?.craneNew}>
          <FieldRow label="Required">
            <YesNoToggle value={inputs.craneNew.required} onChange={v => setSection('craneNew','required',v)} />
          </FieldRow>
          <FieldRow label="Lifted Unit Count" hint="New units + removed units that need crane">
            <NumInput value={inputs.craneNew.liftedUnitCount} onChange={v => setSection('craneNew','liftedUnitCount',v)} prefix="" />
            <span className="text-xs text-gray-400">units (max 8/day)</span>
          </FieldRow>
          <FieldRow label="Extra Lift Days" hint="Additional days beyond the calculated minimum">
            <NumInput value={inputs.craneNew.extraLiftDays} onChange={v => setSection('craneNew','extraLiftDays',v)} prefix="" />
          </FieldRow>
          <FieldRow label="Largest Unit Category" hint="Determines crane size and daily rate">
            <select
              className="input text-sm"
              value={inputs.craneNew.sizeCategory}
              onChange={e => setSection('craneNew','sizeCategory',e.target.value)}
            >
              {CRANE_TABLE.map(c => (
                <option key={c.category} value={c.category}>{c.category} — {c.desc} — {fmt(c.pricePerDay)}/day</option>
              ))}
            </select>
          </FieldRow>
          {s?.craneNew && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100 text-xs text-gray-500 space-y-1">
              <div>Crane size: {s.craneNew.craneSize}t · Rate: {fmt(s.craneNew.cranePricePerDay)}/day · Days: {s.craneNew.daysRequired} (= ROUNDUP({inputs.craneNew.liftedUnitCount}/8, 0) + {inputs.craneNew.extraLiftDays})</div>
            </div>
          )}
          {s?.craneNew && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <ResultBadge label="Days Required" value={s.craneNew.daysRequired} color="gray" />
              <ResultBadge label="Base Cost" value={s.craneNew.baseCost} />
              <ResultBadge label="Total" value={s.craneNew.totalCost} color="total" />
            </div>
          )}
        </SectionCard>

        {/* 4. Demolition */}
        <SectionCard title="Demolition" result={s?.demolition}>
          <FieldRow label="Required">
            <YesNoToggle value={inputs.demolition.required} onChange={v => setSection('demolition','required',v)} />
          </FieldRow>
          <FieldRow label="RTUs to Demo" hint="Package units">
            <NumInput value={inputs.demolition.rtusToDemoCount} onChange={v => setSection('demolition','rtusToDemoCount',v)} prefix="" />
            <span className="text-xs text-gray-400">× $400/unit</span>
          </FieldRow>
          <FieldRow label="Split Systems to Demo">
            <NumInput value={inputs.demolition.splitsToDemoCount} onChange={v => setSection('demolition','splitsToDemoCount',v)} prefix="" />
            <span className="text-xs text-gray-400">× $600/unit</span>
          </FieldRow>
          <FieldRow label="Craned Unit Count" hint="Units needing crane for demo — ≤5 = $800 surcharge, >5 = $1500">
            <NumInput value={inputs.demolition.cranedUnitCount} onChange={v => setSection('demolition','cranedUnitCount',v)} prefix="" />
          </FieldRow>
          <div className="mt-3 mb-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Duct Runs to Demo</div>
          {[
            { key: 'xlDuctRuns', label: 'XL Duct (>25 ton)',    rate: 1200 },
            { key: 'lDuctRuns',  label: 'L Duct (10–25 ton)',   rate: 800  },
            { key: 'mDuctRuns',  label: 'M Duct (5–10 ton)',    rate: 600  },
            { key: 'sDuctRuns',  label: 'S Duct (<5 ton)',      rate: 400  },
          ].map(({ key, label, rate }) => (
            <FieldRow key={key} label={label}>
              <NumInput value={inputs.demolition[key]} onChange={v => setSection('demolition',key,v)} prefix="" />
              <span className="text-xs text-gray-400">× {fmt(rate)}/run</span>
            </FieldRow>
          ))}
          <FieldRow label="Partial Duct Discount" hint="Discount for partial vs complete duct removal">
            <NumInput value={Math.round((inputs.demolition.partialDuctDiscount ?? 0) * 100)} onChange={v => setSection('demolition','partialDuctDiscount',v/100)} prefix="" step={1} />
            <span className="text-xs text-gray-400">%</span>
          </FieldRow>
          {s?.demolition && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <ResultBadge label="Unit Demo" value={s.demolition.unitDemoCost} />
              <ResultBadge label="Duct Demo (net)" value={s.demolition.ductDemoNet} />
              <ResultBadge label="Total" value={s.demolition.totalCost} color="total" />
            </div>
          )}
        </SectionCard>

        {/* 5. Rentals */}
        <SectionCard title="Rentals (Scissor &amp; Material Lifts)" result={s?.rentals}>
          <FieldRow label="Required" hint="Required for most jobs with suspended ductwork or units">
            <YesNoToggle value={inputs.rentals.required} onChange={v => setSection('rentals','required',v)} />
          </FieldRow>
          <FieldRow label="Grand Total Labor" hint="Auto-filled (includes general items — Summary E23)">
            <span className="font-mono text-sm text-gray-700">{fmt(context.totalLaborCost || context.scheduleLaborCost)}</span>
          </FieldRow>
          {s?.rentals && s.rentals.required === 'Yes' && (
            <>
              <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100 text-xs text-gray-500 space-y-1">
                <div>Team size: <strong className="text-gray-700">{s.rentals.estimatedStaff} staff</strong></div>
                <div>Scissor lifts: <strong className="text-gray-700">{s.rentals.scissorLiftCount}</strong> × {fmt(s.rentals.scissorCost / s.rentals.scissorLiftCount || 0)}</div>
                <div>Material lifts: <strong className="text-gray-700">{s.rentals.matLiftCount}</strong> × {fmt(s.rentals.matLiftCost / s.rentals.matLiftCount || 0)}</div>
              </div>
              {/* Reference table */}
              <div className="mt-3 overflow-x-auto">
                <table className="text-[11px] w-full border border-gray-100 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="px-2 py-1 text-left">Labor Threshold</th>
                      <th className="px-2 py-1 text-center">Staff</th>
                      <th className="px-2 py-1 text-center">Scissor Lifts</th>
                      <th className="px-2 py-1 text-center">Mat Lifts</th>
                      <th className="px-2 py-1 text-right">Scissor $</th>
                      <th className="px-2 py-1 text-right">Mat Lift $</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RENTALS_TABLE.map((row, i) => {
                      const isActive = s.rentals.estimatedStaff === row.staff &&
                                       s.rentals.scissorCost === row.scissorCost;
                      return (
                        <tr key={i} className={isActive ? 'bg-blue-50 font-semibold' : 'bg-white'}>
                          <td className="px-2 py-1 text-gray-600">{row.threshold === 0 ? '$0' : fmt(row.threshold)}+</td>
                          <td className="px-2 py-1 text-center">{row.staff}</td>
                          <td className="px-2 py-1 text-center">{row.scissorLifts}</td>
                          <td className="px-2 py-1 text-center">{row.matLifts}</td>
                          <td className="px-2 py-1 text-right">{fmt(row.scissorCost)}</td>
                          <td className="px-2 py-1 text-right">{fmt(row.matLiftCost)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {s?.rentals && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <ResultBadge label="Scissor Lifts" value={s.rentals.scissorCost} />
              <ResultBadge label="Material Lifts" value={s.rentals.matLiftCost} />
              <ResultBadge label="Total" value={s.rentals.totalCost} color="total" />
            </div>
          )}
        </SectionCard>

        {/* 6. Air Balance */}
        <SectionCard title="Air Balancing" result={s?.airBalance}>
          <FieldRow label="Required" hint="Required unless no ductwork is done">
            <YesNoToggle value={inputs.airBalance.required} onChange={v => setSection('airBalance','required',v)} />
          </FieldRow>
          <FieldRow label="Mercury Provided" hint="If Mercury provides balancing, cost is divided by 3">
            <YesNoToggle value={inputs.airBalance.mercuryProvided} onChange={v => setSection('airBalance','mercuryProvided',v)} yesLabel="Mercury" noLabel="3rd Party" />
          </FieldRow>
          {s?.airBalance && (
            <FieldRow label="TP Certified">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.airBalance.tpCertified === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {s.airBalance.tpCertified}
              </span>
            </FieldRow>
          )}
          <FieldRow label="Systems to Balance" hint="Count of systems with ductwork needing balancing">
            <NumInput value={inputs.airBalance.systemsToBalance} onChange={v => setSection('airBalance','systemsToBalance',v)} prefix="" />
            <span className="text-xs text-gray-400">× $450/system</span>
          </FieldRow>
          <FieldRow label="Grills / Diffusers" hint="Auto-filled from Diffuser Schedule">
            <span className="font-mono text-sm text-gray-700">{context.grillCount || 0}</span>
            <span className="text-xs text-gray-400">× $45/grill</span>
          </FieldRow>
          {s?.airBalance && s.airBalance.required === 'Yes' && (
            <div className="mt-2 p-3 bg-white rounded-lg border border-gray-100 text-xs text-gray-500">
              Raw cost: {inputs.airBalance.systemsToBalance}×$450 + {context.grillCount}×$45 = {fmt(s.airBalance.rawCost)}
              {inputs.airBalance.mercuryProvided === 'Yes' && ` ÷ 3 = ${fmt(s.airBalance.baseCost)}`}
            </div>
          )}
          {s?.airBalance && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <ResultBadge label="Base Cost" value={s.airBalance.baseCost} />
              <ResultBadge label="Total" value={s.airBalance.totalCost} color="total" />
            </div>
          )}
        </SectionCard>

        {/* 7. Warranty */}
        <SectionCard title="Warranty" result={s?.warranty}>
          <FieldRow label="Required">
            <YesNoToggle value={inputs.warranty.required} onChange={v => setSection('warranty','required',v)} />
          </FieldRow>
          <FieldRow label="Installed Cooling (tons)" hint="Auto-filled from Unit Schedule">
            <span className="font-mono text-sm text-gray-700">{context.totalTons || 0}</span>
          </FieldRow>
          <FieldRow label="Installed Units" hint="Auto-filled from Unit Schedule">
            <span className="font-mono text-sm text-gray-700">{context.totalUnits || 0}</span>
          </FieldRow>
          <FieldRow label="Rate per Ton" hint="$10/ton default">
            <NumInput value={inputs.warranty.perTonRate ?? 10} onChange={v => setSection('warranty','perTonRate',v)} />
          </FieldRow>
          <FieldRow label="Rate per Unit" hint="$50/unit default">
            <NumInput value={inputs.warranty.perUnitRate ?? 50} onChange={v => setSection('warranty','perUnitRate',v)} />
          </FieldRow>
          {s?.warranty && s.warranty.required === 'Yes' && (
            <div className="mt-2 p-3 bg-white rounded-lg border border-gray-100 text-xs text-gray-500">
              {context.totalTons}t × ${inputs.warranty.perTonRate} + {context.totalUnits} units × ${inputs.warranty.perUnitRate} = {fmt(s.warranty.baseCost)}
            </div>
          )}
          {s?.warranty && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <ResultBadge label="Base Cost" value={s.warranty.baseCost} />
              <ResultBadge label="Total" value={s.warranty.totalCost} color="total" />
            </div>
          )}
        </SectionCard>

        {/* 8. Team Travel */}
        <SectionCard title="Team Travel" result={s?.teamTravel}>
          <FieldRow label="Required" hint="Required for jobs >30 min from Houston area suburbs">
            <YesNoToggle value={inputs.teamTravel.required} onChange={v => setSection('teamTravel','required',v)} />
          </FieldRow>
          <FieldRow label="Schedule Labor Total">
            <span className="font-mono text-sm text-gray-700">{fmt(context.scheduleLaborCost)}</span>
          </FieldRow>
          <FieldRow label="Per Diem Rate" hint="Currently assuming 15% of labor cost">
            <NumInput value={Math.round((inputs.teamTravel.perDiemRate ?? 0.15) * 100)} onChange={v => setSection('teamTravel','perDiemRate',v/100)} prefix="" step={1} />
            <span className="text-xs text-gray-400">%</span>
          </FieldRow>
          <FieldRow label="Accommodation Rate" hint="Currently assuming 20% of labor cost for lodging">
            <NumInput value={Math.round((inputs.teamTravel.accommodationRate ?? 0.20) * 100)} onChange={v => setSection('teamTravel','accommodationRate',v/100)} prefix="" step={1} />
            <span className="text-xs text-gray-400">%</span>
          </FieldRow>
          {s?.teamTravel && (
            <div className="flex gap-3 mt-3 flex-wrap">
              <ResultBadge label="Base Cost" value={s.teamTravel.baseCost} />
              <ResultBadge label="Total" value={s.teamTravel.totalCost} color="total" />
            </div>
          )}
        </SectionCard>

        {/* Free rows */}
        <div className="card">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Additional Items</h3>
          {freeRows.map((row, i) => (
            <div key={i} className="grid grid-cols-12 gap-3 items-center py-2.5 border-b border-gray-100 last:border-0">
              <div className="col-span-4">
                <input
                  type="text"
                  className="input text-sm w-full"
                  placeholder={`Item ${i + 1} label`}
                  value={row.label}
                  onChange={e => setFreeRow(i, 'label', e.target.value)}
                />
              </div>
              <div className="col-span-3">
                <label className="text-[10px] text-gray-400 mb-1 block">Material ($)</label>
                <NumInput value={row.matCost} onChange={v => setFreeRow(i, 'matCost', v)} />
              </div>
              <div className="col-span-3">
                <label className="text-[10px] text-gray-400 mb-1 block">Labor ($)</label>
                <NumInput value={row.laborCost} onChange={v => setFreeRow(i, 'laborCost', v)} />
              </div>
              <div className="col-span-2 text-right">
                <div className="text-[10px] text-gray-400 mb-1">Total</div>
                <div className="font-mono text-sm font-semibold text-gray-700">
                  {fmt((Number(row.matCost) || 0) + (Number(row.laborCost) || 0))}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
