/**
 * SummaryModule — mirrors the Excel "Summary" sheet.
 *
 * Project mode (URL has ?projectId=xxx):
 *   • Loads all saved module estimates from the DB via estimatesApi.list()
 *   • Auto-fills schedule rows (mat + labor) from each estimate's totalMaterial / totalLabor
 *   • Shows a "synced" badge on auto-filled rows; user can still override any value
 *   • Saves summary settings (jobSector, margin, quickTurn, region, tons) to the SUMMARY estimate
 *   • Refresh button re-pulls latest estimates from all modules
 *
 * Standalone mode (no projectId):
 *   • All schedule rows are editable manually
 */
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
  calcSummary, SCHEDULE_ROWS, REGION_TABLE, MARGIN_PRESETS, DEFAULT_SECTOR_CONFIG,
} from '@utils/summaryCalculations';
import { useEstimate }    from '@hooks/useEstimate';
import { estimatesApi }   from '@services/estimatesApi';
import { ductApi }        from '@services/api';
import EstimateProjectBanner from '@components/EstimateProjectBanner';
import { SettingsContext } from '@contexts/SettingsContext';
import {
  Download, Info, RefreshCw, Link2, Edit3,
  Wind, Building2, Gauge, BarChart3, Package, TrendingUp, ArrowRight, Clock,
} from 'lucide-react';

// ─── MODULE DISPLAY CONFIG ────────────────────────────────────────────────────
const MODULE_META = [
  { module: 'UNIT_SCHEDULE',    label: 'Unit Schedule',   route: '/unit-schedule', icon: Building2,  color: 'blue'   },
  { module: 'METAL_DUCT',       label: 'Metal Duct',      route: '/duct',          icon: Wind,       color: 'orange' },
  { module: 'DIFFUSER_SCHEDULE',label: 'Diffusers',       route: '/diffusers',     icon: Gauge,      color: 'green'  },
  { module: 'VAV_SCHEDULE',     label: 'VAV Schedule',    route: '/vav',           icon: BarChart3,  color: 'purple' },
  { module: 'ELECTRIC_HEAT',    label: 'Electric Heat',   route: '/electric-heat', icon: TrendingUp, color: 'red'    },
  { module: 'FAN_SCHEDULE',     label: 'Fan Schedule',    route: '/fans',          icon: Wind,       color: 'blue'   },
  { module: 'LOUVERS_DAMPERS',  label: 'Louvers & FDs',   route: '/louvers',       icon: Package,    color: 'green'  },
  { module: 'GENERAL_ITEMS',    label: 'General Items',   route: '/general',       icon: TrendingUp, color: 'gray'   },
];

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   bar: 'bg-blue-500',   icon: 'text-blue-600',   border: 'border-blue-200'   },
  orange: { bg: 'bg-orange-50', bar: 'bg-orange-500', icon: 'text-orange-600', border: 'border-orange-200' },
  green:  { bg: 'bg-green-50',  bar: 'bg-green-500',  icon: 'text-green-600',  border: 'border-green-200'  },
  purple: { bg: 'bg-purple-50', bar: 'bg-purple-500', icon: 'text-purple-600', border: 'border-purple-200' },
  cyan:   { bg: 'bg-cyan-50',   bar: 'bg-cyan-500',   icon: 'text-cyan-600',   border: 'border-cyan-200'   },
  red:    { bg: 'bg-red-50',    bar: 'bg-red-500',    icon: 'text-red-600',    border: 'border-red-200'    },
  gray:   { bg: 'bg-gray-50',   bar: 'bg-gray-500',   icon: 'text-gray-600',   border: 'border-gray-200'   },
};

// ─── MODULE → SCHEDULE ROW MAPPING ───────────────────────────────────────────
// Maps DB ModuleType values to the schedule row keys used in calcSummary
const MODULE_TO_ROW = {
  GENERAL_ITEMS:    'general',
  UNIT_SCHEDULE:    'unit',
  VAV_SCHEDULE:     'vav',
  ELECTRIC_HEAT:    'heater',
  FAN_SCHEDULE:     'fan',
  LOUVERS_DAMPERS:  'louver',
  METAL_DUCT:       'duct',
  DIFFUSER_SCHEDULE:'diffusers',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt    = n => (Number(n)||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const fmtPct = n => `${(Number(n)*100).toFixed(2)}%`;

// ─── DEFAULT STATE ─────────────────────────────────────────────────────────────
const defaultSchedules = () =>
  Object.fromEntries(SCHEDULE_ROWS.map(r => [r.key, { mat: 0, labor: 0 }]));

const defaultSettings = () => ({
  jobSector: 'Commercial',
  margin:    'M',
  quickTurn: 'n',
  region:    'Houston',
});

// ─── MINI COMPONENTS ──────────────────────────────────────────────────────────
function SegBtn({ value, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
        active ? 'bg-blue-600 text-white border-blue-600'
               : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
      }`}>
      {value}
    </button>
  );
}

function KpiCard({ label, value, sub, color='gray' }) {
  const colors = {
    green:  'bg-green-50 border-green-200 text-green-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-700',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color]}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70 mb-1">{label}</div>
      <div className="text-xl font-bold font-mono">{value}</div>
      {sub && <div className="text-[11px] opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

function BidCard({ title, result, subtitle }) {
  if (!result) return null;
  return (
    <div className="rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 text-white p-5">
      <div className="text-xs font-bold uppercase tracking-widest text-white/60 mb-1">{title}</div>
      {subtitle && <div className="text-[10px] text-white/40 mb-4">{subtitle}</div>}
      {[
        { label: 'Direct Cost',  val: fmt(result.bid - result.grossProfit), muted: true },
        { label: 'Gross Profit', val: fmt(result.grossProfit),              muted: true },
        { label: 'Pre-Tax Bid',  val: fmt(result.bid),                      bold:  true },
        { label: 'Tax',          val: fmt(result.tax),                      muted: true },
      ].map(({ label, val, bold, muted }) => (
        <div key={label} className="flex justify-between items-center py-1.5 border-b border-white/10 last:border-0">
          <span className={`text-sm ${muted ? 'text-white/60' : 'text-white font-semibold'}`}>{label}</span>
          <span className={`font-mono text-sm ${bold ? 'font-bold' : 'text-white/80'}`}>{val}</span>
        </div>
      ))}
      <div className="flex justify-between items-center pt-3">
        <div>
          <div className="text-white font-bold text-lg">TOTAL BID</div>
          <div className="text-white/50 text-xs">{fmtPct(result.margin)} margin · {fmt(result.pricePerTon)}/ton</div>
        </div>
        <div className="text-2xl font-black font-mono">{fmt(result.total)}</div>
      </div>
    </div>
  );
}

// ─── MODULE BREAKDOWN CARD ────────────────────────────────────────────────────
function ModuleCard({ meta, est, maxCost }) {
  const c    = COLOR_MAP[meta.color] || COLOR_MAP.gray;
  const Icon = meta.icon;
  const mat  = Number(est?.totalMaterial) || 0;
  const lab  = Number(est?.totalLabor)    || 0;
  const cost = Number(est?.totalCost)     || 0;
  const hasData = cost > 0;
  const barPct  = maxCost > 0 ? Math.min(100, (cost / maxCost) * 100) : 0;
  const updatedAt = est?.updatedAt;

  return (
    <Link to={meta.route}
      className={`group card border hover:-translate-y-0.5 hover:shadow-md transition-all duration-150 ${c.bg} ${c.border}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className={c.icon} />
          <span className="font-semibold text-gray-800 text-sm">{meta.label}</span>
        </div>
        {updatedAt && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400">
            <Clock size={9} />
            {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      {hasData ? (
        <>
          <div className="text-xl font-bold text-gray-900 mb-1">{fmt(cost)}</div>
          <div className="flex gap-3 text-[11px] mb-2">
            <span className="text-blue-600 font-medium">M {fmt(mat)}</span>
            <span className="text-green-600 font-medium">L {fmt(lab)}</span>
          </div>
          <div className="h-1 rounded-full bg-white/60 overflow-hidden">
            <div className={`h-full ${c.bar} rounded-full transition-all duration-500`} style={{ width: `${barPct}%` }} />
          </div>
        </>
      ) : (
        <div className="text-xs text-gray-400 italic mt-1 mb-2">No data yet</div>
      )}
      <div className="flex items-center gap-1 text-[11px] font-medium text-blue-600 mt-2 group-hover:gap-2 transition-all">
        Open <ArrowRight size={11} />
      </div>
    </Link>
  );
}

// ─── MODULE BREAKDOWN GRID ────────────────────────────────────────────────────
function ModuleBreakdown({ estimates }) {
  // Build a map of module → estimate
  const estMap = Object.fromEntries(estimates.map(e => [e.module, e]));
  const maxCost = Math.max(...MODULE_META.map(m => Number(estMap[m.module]?.totalCost) || 0), 1);
  const totalCost = MODULE_META.reduce((s, m) => s + (Number(estMap[m.module]?.totalCost) || 0), 0);

  return (
    <div className="card mb-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-700 text-sm">Module Breakdown</h2>
        {totalCost > 0 && (
          <div className="flex gap-4 text-xs text-gray-500">
            {MODULE_META.filter(m => estMap[m.module]?.totalCost > 0).map(m => {
              const c = COLOR_MAP[m.color] || COLOR_MAP.gray;
              return (
                <div key={m.module} className="flex items-center gap-1">
                  <span className={`inline-block w-2 h-2 rounded-full ${c.bar}`} />
                  {m.label} ({Math.round((Number(estMap[m.module]?.totalCost) / totalCost) * 100)}%)
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {MODULE_META.map(meta => (
          <ModuleCard key={meta.module} meta={meta} est={estMap[meta.module]} maxCost={maxCost} />
        ))}
      </div>
    </div>
  );
}

// ─── ENGINEERING KPI ROW ──────────────────────────────────────────────────────
function EngineeringKpis({ totalTons, ductWeight, ductArea }) {
  const fmtn = (n, unit) => n > 0 ? `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}` : '—';
  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-500 mb-1">Total Cooling Tons</div>
        <div className="text-xl font-bold font-mono text-sky-800">{totalTons > 0 ? `${totalTons.toLocaleString()} tons` : '—'}</div>
        <div className="text-[11px] text-sky-400 mt-0.5">from Unit Schedule</div>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-500 mb-1">Total Duct Weight</div>
        <div className="text-xl font-bold font-mono text-amber-800">{fmtn(ductWeight, 'lbs')}</div>
        <div className="text-[11px] text-amber-400 mt-0.5">from Metal Duct</div>
      </div>
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-violet-500 mb-1">Total Duct Area</div>
        <div className="text-xl font-bold font-mono text-violet-800">{fmtn(ductArea, 'sq ft')}</div>
        <div className="text-[11px] text-violet-400 mt-0.5">from Metal Duct</div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export function SummaryModule({ projectInfo = {} }) {
  const { activeProjectId, pricingConfig } = useContext(SettingsContext);
  const { projectId, projectName, loadEstimate, saveEstimate, saving, lastSaved, saveError } = useEstimate('SUMMARY');

  const [schedules,       setSchedules]       = useState(defaultSchedules);
  const [syncedKeys,      setSyncedKeys]      = useState(new Set());
  const [settings,        setSettings]        = useState(defaultSettings);
  const [tons,            setTons]            = useState(0);
  const [tonsAutoFilled,  setTonsAutoFilled]  = useState(false);
  const [regionAutoSet,   setRegionAutoSet]   = useState(false);
  const [syncing,         setSyncing]         = useState(false);
  const [lastSync,        setLastSync]        = useState(null);
  const [allEstimates,    setAllEstimates]    = useState([]);
  const [ductWeight,      setDuctWeight]      = useState(0);
  const [ductArea,        setDuctArea]        = useState(0);

  // ── Auto-match region from project location ────────────────────────────────
  useEffect(() => {
    const loc = (projectInfo.location || '').trim();
    if (!loc) return;
    // Try exact match first, then case-insensitive partial match
    const exact = REGION_TABLE.find(r => r.region.toLowerCase() === loc.toLowerCase());
    const partial = !exact && REGION_TABLE.find(r =>
      loc.toLowerCase().includes(r.region.toLowerCase()) ||
      r.region.toLowerCase().includes(loc.toLowerCase())
    );
    const matched = exact || partial;
    if (matched) {
      setSettings(s => ({ ...s, region: matched.region }));
      setRegionAutoSet(true);
    } else if (loc) {
      // Location exists but not in list → use Other (×1)
      setSettings(s => ({ ...s, region: 'Other' }));
      setRegionAutoSet(true);
    }
  }, [projectInfo.location]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load SUMMARY settings from DB ─────────────────────────────────────────
  useEffect(() => {
    if (!projectId) return;
    loadEstimate().then(est => {
      if (est?.rowsJson) {
        const { settings: s, tons: t, schedules: sc } = est.rowsJson;
        if (s)  setSettings(s);
        if (t != null) setTons(t);
        // Manual overrides saved in SUMMARY — don't overwrite synced data
        if (sc) setSchedules(prev => ({ ...prev, ...sc }));
      }
    });
  }, [loadEstimate, projectId]); // eslint-disable-line

  // ── Sync schedule rows from all module estimates ───────────────────────────
  const syncFromProject = useCallback(async () => {
    if (!projectId) return;
    setSyncing(true);
    try {
      const estimates = await estimatesApi.list(projectId);
      const newSchedules = { ...defaultSchedules() };
      const newSynced    = new Set();
      let needUnitFetch  = false;
      let needDuctFetch  = false;

      for (const est of estimates) {
        const rowKey = MODULE_TO_ROW[est.module];
        if (!rowKey) continue;
        newSchedules[rowKey] = {
          mat:   Number(est.totalMaterial) || 0,
          labor: Number(est.totalLabor)    || 0,
        };
        newSynced.add(rowKey);

        // Engineering KPIs — tag modules so we can fetch them after the loop
        if (est.module === 'UNIT_SCHEDULE') needUnitFetch = true;
        if (est.module === 'METAL_DUCT')    needDuctFetch  = true;
      }

      // Fetch full estimates to extract engineering KPIs from rowsJson
      if (needUnitFetch) {
        try {
          const full = await estimatesApi.getByModule(projectId, 'UNIT_SCHEDULE');
          const rj = full?.rowsJson;
          if (rj) {
            const rowArrays = [rj.packagedRows, rj.splitRows, rj.wallMountRows, rj.vrfRows, rj.serviceRows].filter(Boolean);
            const computed = rowArrays.flat().reduce((s, r) => s + (Number(r.coolTons) || 0), 0);
            if (computed > 0) { setTons(computed); setTonsAutoFilled(true); }
          }
          // Pull copper total — prefer totalsJson (fast), fall back to summing copperPricingResult
          // from each split/wall-mount/VRF row (works for estimates saved before this update)
          let totalCopper = Number(full?.totalsJson?.totalCopper) || 0;
          if (totalCopper === 0 && full?.rowsJson) {
            const rj = full.rowsJson;
            const copperRows = [rj.splitRows, rj.wallMountRows, rj.vrfRows].filter(Boolean).flat();
            totalCopper = copperRows.reduce(
              (s, r) => s + (Number(r.copperPricingResult?.material) || 0), 0,
            );
          }
          if (totalCopper > 0) {
            newSchedules['copperPipe'] = { mat: totalCopper, labor: 0 };
            newSynced.add('copperPipe');
          }
        } catch { /* silent */ }
      }

      if (needDuctFetch) {
        try {
          const full = await estimatesApi.getByModule(projectId, 'METAL_DUCT');
          const rows = full?.rowsJson;
          if (Array.isArray(rows) && rows.length > 0) {
            // Re-run the backend calc to get accurate totals
            const { data: result } = await ductApi.calculate(rows.filter(r => r.size && r.linearFeet), {});
            if (result?.totals) {
              setDuctWeight(Number(result.totals.weight)      || 0);
              setDuctArea(  Number(result.totals.surfaceArea) || 0);
            }
          }
        } catch { /* silent */ }
      }

      setAllEstimates(estimates);
      setSchedules(newSchedules);
      setSyncedKeys(newSynced);
      setLastSync(new Date());
    } catch (e) {
      console.error('Summary sync failed:', e);
    } finally {
      setSyncing(false);
    }
  }, [projectId]);

  // Auto-sync when project changes, and whenever the tab becomes visible again
  useEffect(() => {
    if (projectId) syncFromProject();
  }, [projectId, syncFromProject]);

  useEffect(() => {
    if (!projectId) return;
    const onVisible = () => { if (document.visibilityState === 'visible') syncFromProject(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [projectId, syncFromProject]);

  // ── Auto-save settings + manual schedule overrides whenever they change ──────
  useEffect(() => {
    if (!projectId) return;
    const timer = setTimeout(() => {
      saveEstimate({
        rowsJson:      { settings, tons, schedules },
        totalMaterial: result.totalMat,
        totalLabor:    result.totalLabor,
        totalCost:     result.mercury.total,  // final bid (includes overhead, profit, tax)
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [settings, tons, schedules]); // eslint-disable-line

  const setSetting = useCallback((key, val) => setSettings(p => ({ ...p, [key]: val })), []);

  // Override a synced row (user edits manually)
  const setSchedule = useCallback((key, field, val) => {
    setSchedules(p => ({ ...p, [key]: { ...p[key], [field]: parseFloat(val) || 0 } }));
    // Remove from synced so it no longer shows as "auto"
    setSyncedKeys(prev => { const n = new Set(prev); n.delete(key); return n; });
  }, []);

  // Build margin adj from company settings (admin-configurable)
  const marginAdj = {
    L: Number(pricingConfig?.marginL ?? -0.02),
    M: Number(pricingConfig?.marginM ??  0.00),
    H: Number(pricingConfig?.marginH ??  0.02),
  };

  // Build sector config from company settings (admin-configurable)
  const sectorConfig = {
    'Commercial':   pricingConfig?.sectorCommercial   ?? undefined,
    'Public':       pricingConfig?.sectorPublic       ?? undefined,
    'Multi Family': pricingConfig?.sectorMultiFamily  ?? undefined,
  };

  const result = calcSummary(schedules, settings, tons, marginAdj, sectorConfig);

  const exportCSV = () => {
    const lines = [
      ['Schedule','Material','Labor','Total','$/ton Mat','$/ton Lab','$/ton Total','Split%'].join(','),
      ...result.rowMetrics.map(r => [
        r.label, r.mat, r.laborAdj, r.total, r.matPerTon, r.labPerTon, r.totPerTon,
        (r.split*100).toFixed(1)+'%',
      ].join(',')),
      ['Total', result.totalMat, result.totalLabor, result.totalCost,'','','',''].join(','),
      '',
      ['Mercury Bid', result.mercury.bid, '', result.mercury.total].join(','),
      ['Base Bid',    result.base.bid,    '', result.base.total].join(','),
    ];
    const blob = new Blob([lines.join('\n')], { type:'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download='bid_summary.csv'; a.click();
  };

  const chartData = result.rowMetrics
    .filter(r => r.mat + r.laborAdj > 0)
    .map(r => ({ name: r.label, material: r.mat, labor: r.laborAdj }));

  const syncedCount = syncedKeys.size;

  return (
    <div className="max-w-6xl mx-auto">
      <EstimateProjectBanner
        projectId={projectId} projectName={projectName}
        saving={saving} lastSaved={lastSaved} saveError={saveError}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bid Summary</h1>
          <p className="text-sm text-gray-500 mt-0.5">All schedules · two bid models · tax</p>
        </div>
        <div className="flex items-center gap-2">
          {syncing && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <RefreshCw size={12} className="animate-spin" /> Syncing…
            </span>
          )}
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Project sync banner ──────────────────────────────────────────── */}
      {projectId && (
        <div className={`rounded-xl border px-4 py-3 mb-5 flex items-center justify-between text-sm ${
          syncedCount > 0
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}>
          <div className="flex items-center gap-2">
            <Link2 size={15} />
            {syncedCount > 0 ? (
              <span>
                <strong>{syncedCount} module{syncedCount !== 1 ? 's' : ''}</strong> auto-synced from project estimates.
                Rows marked <span className="inline-flex items-center gap-0.5 bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[11px] font-semibold mx-1"><Link2 size={9}/> synced</span> refresh automatically when you return to this page.
              </span>
            ) : (
              <span>No saved estimates found yet — open any module, enter data, and come back here to see totals.</span>
            )}
          </div>
          {lastSync && (
            <span className="text-[11px] opacity-60">
              Last sync {lastSync.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
            </span>
          )}
        </div>
      )}

      {/* ── Module Breakdown ─────────────────────────────────────────────── */}
      {projectId && allEstimates.length > 0 && (
        <ModuleBreakdown estimates={allEstimates} />
      )}

      {/* ── Engineering KPIs ──────────────────────────────────────────────── */}
      {projectId && (
        <EngineeringKpis totalTons={tons} ductWeight={ductWeight} ductArea={ductArea} />
      )}

      {/* ── Global Settings ───────────────────────────────────────────────── */}
      <div className="card mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Job Sector</label>
            <div className="flex gap-1 flex-wrap">
              {['Commercial','Public','Multi Family'].map(s => (
                <SegBtn key={s} value={s} active={settings.jobSector===s} onClick={() => setSetting('jobSector',s)} />
              ))}
            </div>
            {(() => {
              const sc = sectorConfig[settings.jobSector] ?? DEFAULT_SECTOR_CONFIG[settings.jobSector];
              if (!sc) return null;
              const parts = [];
              if (sc.bidAddPct > 0) parts.push(`+${(sc.bidAddPct * 100).toFixed(2)}% bid add`);
              if (sc.matTaxPct === 0) parts.push('no material tax');
              else parts.push(`${(sc.matTaxPct * 100).toFixed(2)}% mat tax`);
              if (sc.notes) parts.push(sc.notes);
              return parts.length ? <p className="text-[10px] text-amber-600 mt-1">{parts.join(' · ')}</p> : null;
            })()}
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">
              Margin &nbsp;<span className="text-gray-400 font-normal">
                (L={marginAdj.L >= 0 ? '+' : ''}{(marginAdj.L*100).toFixed(0)}% / M={marginAdj.M >= 0 ? '+' : ''}{(marginAdj.M*100).toFixed(0)}% / H={marginAdj.H >= 0 ? '+' : ''}{(marginAdj.H*100).toFixed(0)}%)
              </span>
            </label>
            <div className="flex gap-1">
              {['L','M','H'].map(m => (
                <SegBtn key={m} value={m} active={settings.margin===m} onClick={() => setSetting('margin',m)} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-2">Quick Turn</label>
            <div className="flex gap-1">
              {[['n','No'],['y','Yes (+40% labor)']].map(([val,label]) => (
                <SegBtn key={val} value={label} active={settings.quickTurn===val} onClick={() => setSetting('quickTurn',val)} />
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Region
              {regionAutoSet && (
                <span className="ml-1.5 text-[10px] font-normal text-sky-500 inline-flex items-center gap-0.5">
                  <Link2 size={8} /> from project location
                </span>
              )}
            </label>
            <select
              className={`input text-sm w-full ${regionAutoSet ? 'bg-sky-50 border-sky-200' : ''}`}
              value={settings.region}
              onChange={e => { setSetting('region', e.target.value); setRegionAutoSet(false); }}
            >
              {REGION_TABLE.map(r => (
                <option key={r.region} value={r.region}>
                  {r.region === 'Other' ? 'Other (×1.00)' : `${r.region} (×${r.multiplier})`}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Schedule Cost Summary ─────────────────────────────────────────── */}
      <div className="card mb-5 p-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-800">Schedule Cost Summary</span>
            {result.quickTurnFactor > 1 && (
              <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">Quick Turn ×1.4</span>
            )}
            {result.laborMultiplier !== 1 && (
              <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Region ×{result.laborMultiplier}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> synced from module</span>
            <span className="flex items-center gap-1"><Edit3 size={10}/> click value to override</span>
          </div>
        </div>

        {/* Column headers */}
        <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[860px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              <th className="text-left px-5 py-2.5 w-40">Schedule</th>
              <th className="text-right px-3 py-2.5 w-36">Material</th>
              <th className="text-right px-3 py-2.5 w-36">Labor</th>
              <th className="text-right px-3 py-2.5 w-28 text-gray-600">Mat + Labor</th>
              <th className="text-right px-3 py-2.5 w-24">$/ton (mat)</th>
              <th className="text-right px-3 py-2.5 w-24">$/ton (lab)</th>
              <th className="text-right px-3 py-2.5 w-24">$/ton (tot)</th>
              <th className="text-right px-3 py-2.5 w-16">Split</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
          {SCHEDULE_ROWS.map(({ key, label }) => {
            const row      = result.rowMetrics.find(r => r.key === key);
            const isSynced = syncedKeys.has(key);
            const active   = row && (row.mat + row.laborAdj) > 0;
            const matPct   = active ? Math.round((row.mat / row.total) * 100) : 0;

            return (
              <tr key={key} className={`transition-colors ${active ? 'hover:bg-gray-50/70' : 'opacity-40'}`}>

                {/* Name + synced dot */}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSynced && active ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                    <span className={`font-medium ${active ? 'text-gray-800' : 'text-gray-400'}`}>{label}</span>
                  </div>
                </td>

                {/* Material — formatted display for synced, input for manual */}
                <td className="px-3 py-2 text-right">
                  {isSynced ? (
                    <span className={`font-semibold ${active ? 'text-emerald-700' : 'text-gray-300'}`}>
                      {active ? fmt(row.mat) : '—'}
                    </span>
                  ) : (
                    <div className="flex justify-end">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">$</span>
                        <input type="number" min="0" placeholder="0"
                          className="input text-xs pl-5 text-right w-28 h-7"
                          value={schedules[key]?.mat || ''}
                          onChange={e => setSchedule(key,'mat',e.target.value)} />
                      </div>
                    </div>
                  )}
                </td>

                {/* Labor */}
                <td className="px-3 py-2 text-right">
                  {isSynced ? (
                    <span className={`font-semibold ${active ? 'text-blue-700' : 'text-gray-300'}`}>
                      {active ? fmt(row.laborAdj) : '—'}
                    </span>
                  ) : (
                    <div className="flex justify-end">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-[11px]">$</span>
                        <input type="number" min="0" placeholder="0"
                          className="input text-xs pl-5 text-right w-28 h-7"
                          value={schedules[key]?.labor || ''}
                          onChange={e => setSchedule(key,'labor',e.target.value)} />
                      </div>
                    </div>
                  )}
                </td>

                {/* Mat+Labor total + mini bar */}
                <td className="px-3 py-2 text-right">
                  {active ? (
                    <div>
                      <div className="font-bold text-gray-900">{fmt(row.total)}</div>
                      <div className="flex h-1 rounded-full overflow-hidden mt-1 ml-auto w-16 bg-gray-100">
                        <div className="bg-emerald-400 h-full" style={{ width: `${matPct}%` }} />
                        <div className="bg-blue-400 h-full flex-1" />
                      </div>
                    </div>
                  ) : <span className="text-gray-300">—</span>}
                </td>

                {/* $/ton columns */}
                <td className="px-3 py-2 text-right font-mono text-gray-500">
                  {active && tons > 0 ? fmt(row.matPerTon) : <span className="text-gray-200">—</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">
                  {active && tons > 0 ? fmt(row.labPerTon) : <span className="text-gray-200">—</span>}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">
                  {active && tons > 0 ? fmt(row.totPerTon) : <span className="text-gray-200">—</span>}
                </td>

                {/* Split */}
                <td className="px-3 py-2 text-right">
                  {active ? (
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                      {(row.split*100).toFixed(1)}%
                    </span>
                  ) : <span className="text-gray-200">—</span>}
                </td>
              </tr>
            );
          })}
          </tbody>
          <tfoot>
        {/* Total footer */}
        <tr className="bg-gradient-to-r from-gray-800 to-gray-700 text-white">
          <td className="px-5 py-4">
            <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Base Schedule Total</div>
          </td>
          <td className="px-3 py-4 text-right">
            <div className="font-bold text-emerald-300">{fmt(result.totalMat)}</div>
          </td>
          <td className="px-3 py-4 text-right">
            <div className="font-bold text-blue-300">{fmt(result.totalLabor)}</div>
          </td>
          <td className="px-3 py-4 text-right">
            <div className="text-base font-black text-white">{fmt(result.totalCost)}</div>
          </td>
          <td className="px-3 py-4 text-right font-mono text-gray-300">
            {tons > 0 ? fmt(result.matPerTon) : '—'}
          </td>
          <td className="px-3 py-4 text-right font-mono text-gray-300">
            {tons > 0 ? fmt(result.laborPerTon) : '—'}
          </td>
          <td className="px-3 py-4 text-right font-mono text-gray-300">
            {tons > 0 ? fmt(result.totalPerTon) : '—'}
          </td>
          <td className="px-3 py-4 text-right">
            <span className="text-xs font-bold text-gray-300">100%</span>
          </td>
        </tr>
          </tfoot>
        </table>
        </div>
      </div>

      {/* ── High-margin warning ───────────────────────────────────────────── */}
      {result.base.selectedMargin > 0.40 && (
        <div className="mb-5 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <span className="font-semibold">High margin applied — {fmtPct(result.base.selectedMargin)}.</span>
            {' '}This job has a labor-heavy cost structure
            ({fmtPct(result.totalLabor / Math.max(result.totalCost, 1))} of direct cost is labor).
            The Base Profit Calculator has automatically increased the margin to compensate.
            Review the bid carefully before submitting — the final bid is bounded at {fmt(result.base.bid)}.
          </div>
        </div>
      )}

      {/* ── Bid Model + Overhead (side by side) ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Mercury Bid */}
        <div className="lg:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
            <Info size={11}/> Mercury Operations
          </div>
          <BidCard title="Mercury Operations Bid" result={result.mercury}
            subtitle={`Fixed OH $${result.fixedOH.toLocaleString()} · Var OH 50% · Adj ${fmtPct(result.totalAdj)}`} />
        </div>

        {/* Overhead reference (right column) */}
        <div className="lg:col-span-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">Overhead &amp; Tax</div>
          <div className="card h-full text-xs space-y-3">
            {[
              { label: 'Fixed Overhead', value: fmt(result.fixedOH), sub: `labor = ${fmt(result.totalLabor)}` },
              { label: 'Variable OH',    value: '50% of labor',      sub: `= ${fmt(result.totalLabor*0.5)}` },
              { label: 'Total Adj.',     value: fmtPct(result.totalAdj), sub: 'margin + 10% EOY target' },
              { label: 'Material Tax',   value: `${(result.taxOnMat*100).toFixed(2)}%`, sub: `= ${fmt(result.tax)}` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <div>
                  <div className="text-gray-500 font-medium">{label}</div>
                  <div className="text-[10px] text-gray-400">{sub}</div>
                </div>
                <div className="font-mono font-bold text-gray-700 text-sm">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Chart ─────────────────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-700 text-sm mb-4">Cost by Schedule</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{top:4,right:16,bottom:36,left:16}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{fontSize:10}} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{fontSize:10}} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={v=>fmt(v)} />
              <Bar dataKey="material" name="Material" fill="#34d399" stackId="a" radius={[0,0,0,0]} />
              <Bar dataKey="labor"    name="Labor"    fill="#60a5fa" stackId="a" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default SummaryModule;
