/**
 * Dashboard.jsx — Live project bid dashboard.
 * Reads module totals from localStorage (written by each estimating module).
 * Re-renders automatically whenever any module saves new totals.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Wind, Building2, Gauge, Sparkles, ArrowRight,
  TrendingUp, DollarSign, Package, BarChart3,
  GitCompare, Clock, RefreshCw, AlertCircle,
} from 'lucide-react';
import { readAllModuleTotals, subscribeToTotals } from '@utils/projectTotals';

const fmt = (n) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtTime = (ts) => {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const COLOR_MAP = {
  blue:   { bg: 'bg-blue-50',   bar: 'bg-blue-500',   icon: 'text-blue-600'   },
  orange: { bg: 'bg-orange-50', bar: 'bg-orange-500', icon: 'text-orange-600' },
  green:  { bg: 'bg-green-50',  bar: 'bg-green-500',  icon: 'text-green-600'  },
  purple: { bg: 'bg-purple-50', bar: 'bg-purple-500', icon: 'text-purple-600' },
  cyan:   { bg: 'bg-cyan-50',   bar: 'bg-cyan-500',   icon: 'text-cyan-600'   },
  red:    { bg: 'bg-red-50',    bar: 'bg-red-500',    icon: 'text-red-600'    },
};

const MODULE_ICONS = {
  unit_schedule: Building2,
  metal_duct:    Wind,
  diffuser:      Gauge,
  vav_schedule:  BarChart3,
  cw_pipe:       Package,
  elec_heat:     TrendingUp,
};

function StackedBar({ material, labor, total }) {
  if (!total) return <div className="h-1.5 rounded-full bg-gray-200 mt-2" />;
  const mPct = Math.round((material / total) * 100);
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden mt-2 gap-px">
      <div className="bg-blue-400"  style={{ width: `${mPct}%` }} />
      <div className="bg-green-400" style={{ width: `${100 - mPct}%` }} />
    </div>
  );
}

function ModuleCard({ mod, maxTotal }) {
  const c    = COLOR_MAP[mod.color] || COLOR_MAP.blue;
  const Icon = MODULE_ICONS[mod.key] || Package;
  const hasData = mod.totalCost > 0;
  const barPct  = maxTotal > 0 ? (mod.totalCost / maxTotal) * 100 : 0;

  return (
    <Link
      to={mod.route}
      className={`group card hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 ${c.bg} border-transparent`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={18} className={c.icon} />
          <span className="font-semibold text-gray-800 text-sm">{mod.label}</span>
        </div>
        {mod.savedAt && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Clock size={10} />
            {fmtTime(mod.savedAt)}
          </span>
        )}
      </div>

      {hasData ? (
        <>
          <div className="text-2xl font-bold text-gray-900 mb-1">{fmt(mod.totalCost)}</div>
          <div className="flex gap-3 text-xs mb-2">
            <span className="text-blue-600 font-medium">M {fmt(mod.totalMaterial)}</span>
            <span className="text-green-600 font-medium">L {fmt(mod.totalLabor)}</span>
          </div>
          <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
            <div className={`h-full ${c.bar} rounded-full transition-all duration-500`} style={{ width: `${barPct}%` }} />
          </div>
          <StackedBar material={mod.totalMaterial} labor={mod.totalLabor} total={mod.totalCost} />
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-2">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> Material</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-400" /> Labor</span>
          </div>
        </>
      ) : (
        <div className="text-sm text-gray-400 italic mt-1 mb-3">No data yet — open module to estimate</div>
      )}

      <div className="flex items-center gap-1 text-xs font-medium text-blue-600 mt-3 group-hover:gap-2 transition-all">
        Open module <ArrowRight size={12} />
      </div>
    </Link>
  );
}

function GrandTotalBanner({ mods }) {
  const totalMat   = mods.reduce((s, m) => s + m.totalMaterial, 0);
  const totalLab   = mods.reduce((s, m) => s + m.totalLabor,    0);
  const totalCost  = mods.reduce((s, m) => s + m.totalCost,     0);
  const activeCount = mods.filter(m => m.totalCost > 0).length;

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-6 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-slate-400 mb-1">Total Bid (All Modules)</div>
          <div className="text-4xl font-bold">{fmt(totalCost)}</div>
          {activeCount > 0 && (
            <div className="text-sm text-slate-400 mt-1">
              {activeCount} of {mods.length} modules have data
            </div>
          )}
        </div>
        <div className="flex gap-8">
          <div>
            <div className="text-xs text-slate-400 mb-1">Total Material</div>
            <div className="text-xl font-semibold text-blue-300">{fmt(totalMat)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 mb-1">Total Labor</div>
            <div className="text-xl font-semibold text-green-300">{fmt(totalLab)}</div>
          </div>
          {totalCost > 0 && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Labor %</div>
              <div className="text-xl font-semibold text-amber-300">
                {Math.round((totalLab / totalCost) * 100)}%
              </div>
            </div>
          )}
        </div>
      </div>
      {totalCost > 0 && (
        <div className="mt-4">
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            {mods.filter(m => m.totalCost > 0).map(m => {
              const c = COLOR_MAP[m.color] || COLOR_MAP.blue;
              return (
                <div key={m.key} className={`${c.bar} transition-all duration-500`}
                  style={{ width: `${(m.totalCost / totalCost) * 100}%` }}
                  title={`${m.label}: ${fmt(m.totalCost)}`} />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {mods.filter(m => m.totalCost > 0).map(m => {
              const c = COLOR_MAP[m.color] || COLOR_MAP.blue;
              return (
                <div key={m.key} className="flex items-center gap-1 text-xs text-slate-400">
                  <span className={`inline-block w-2 h-2 rounded-full ${c.bar}`} />
                  {m.label} ({Math.round((m.totalCost / totalCost) * 100)}%)
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const QUICK_ACTIONS = [
  { to: '/unit-schedule', label: 'Unit Schedule',    icon: Building2,  color: 'blue'   },
  { to: '/duct',          label: 'Metal Duct',       icon: Wind,       color: 'orange' },
  { to: '/supplier-rfq',  label: 'Supplier RFQ',     icon: Package,    color: 'purple' },
  { to: '/scenarios',     label: 'Scenario Compare', icon: GitCompare, color: 'green'  },
  { to: '/changelog',     label: 'Change Log',       icon: Clock,      color: 'cyan'   },
  { to: '/proposal-pdf',  label: 'Proposal PDF',     icon: DollarSign, color: 'red'    },
];

export default function Dashboard({ projectInfo }) {
  const [mods, setMods] = useState(() => readAllModuleTotals());

  useEffect(() => {
    return subscribeToTotals(() => setMods(readAllModuleTotals()));
  }, []);

  const refresh = useCallback(() => setMods(readAllModuleTotals()), []);
  const maxTotal   = Math.max(...mods.map(m => m.totalCost), 1);
  const hasAnyData = mods.some(m => m.totalCost > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {projectInfo.projectName || 'Project Dashboard'}
          </h1>
          {projectInfo.projectName && (
            <p className="text-sm text-gray-500 mt-1">
              {[projectInfo.location, projectInfo.owner,
                projectInfo.bidDate ? `Bid: ${projectInfo.bidDate}` : null]
                .filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <button onClick={refresh}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <GrandTotalBanner mods={mods} />

      {!hasAnyData && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <AlertCircle size={18} className="shrink-0 text-amber-500" />
          Open any estimating module and enter data — totals appear here automatically.
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Module Breakdown</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mods.map(mod => <ModuleCard key={mod.key} mod={mod} maxTotal={maxTotal} />)}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ to, label, icon: Icon, color }) => {
            const c = COLOR_MAP[color] || COLOR_MAP.blue;
            return (
              <Link key={to} to={to}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${c.bg} ${c.icon} hover:opacity-80 transition-opacity`}>
                <Icon size={15} />{label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="card bg-gray-800 border-gray-700 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={15} className="text-amber-300" />
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Recommended Workflow</h3>
        </div>
        <ol className="space-y-2">
          {[
            'Set project info — click the project name in the header',
            'Fill out Unit Schedule (packaged units, splits, fans, louvers)',
            'Complete Metal Duct and Diffuser schedules',
            'Use Supplier RFQ to get real equipment quotes',
            'Run Scenario Compare to stress-test your margin',
            'Export a polished Proposal PDF and send it to the GC',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
