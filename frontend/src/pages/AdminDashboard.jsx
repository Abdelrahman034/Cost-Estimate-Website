/**
 * AdminDashboard.jsx
 * Cross-project analytics for admins — submissions, totals, margins, areas, top GCs.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area,
  ComposedChart, Scatter,
} from 'recharts';
import {
  TrendingUp, DollarSign, Building2, Users, MapPin,
  Briefcase, BarChart3, RefreshCw, ArrowUpRight, ArrowDownRight,
  Clock, FileText, Activity, Target, AlertCircle,
} from 'lucide-react';
import api from '@services/api';

// ─── Colour palette ───────────────────────────────────────────────────────────
const PALETTE = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
                 '#06b6d4','#f97316','#ec4899','#84cc16','#14b8a6'];

const fmt  = (n) => (n||0).toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
const fmtK = (n) => {
  if (!n) return '$0';
  if (Math.abs(n) >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(n/1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};
const fmtPct = (n) => n == null ? '—' : `${n.toFixed(1)}%`;

// ─── Reusable sub-components ─────────────────────────────────────────────────

function KPICard({ icon: Icon, label, value, sub, color = 'blue', trend }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-100'  },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  border: 'border-green-100' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  border: 'border-amber-100' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-100'},
    cyan:   { bg: 'bg-cyan-50',   icon: 'text-cyan-600',   border: 'border-cyan-100'  },
    red:    { bg: 'bg-red-50',    icon: 'text-red-600',    border: 'border-red-100'   },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-xl bg-white/70 ${c.icon}`}><Icon size={20} /></div>
        {trend != null && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {trend >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-black text-gray-900 leading-tight">{value}</div>
        <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-bold text-gray-800">{children}</h2>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>{children}</div>;
}

// Custom tooltip for currency values
function CurrencyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <div className="font-semibold text-gray-700 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-bold text-gray-800">
            {p.name?.toLowerCase().includes('count') || p.name?.toLowerCase().includes('#')
              ? p.value
              : fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyChart({ message = 'No data yet' }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-300 gap-2">
      <BarChart3 size={32} />
      <span className="text-sm">{message}</span>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [areaView, setAreaView] = useState('count'); // 'count' | 'value'
  const [gcView,   setGcView]   = useState('count'); // 'count' | 'value'
  const [monthRange, setMonthRange] = useState(12);  // last N months to show

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/analytics');
      setData(res.data);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <Activity size={28} className="animate-pulse" />
        <span className="text-sm">Loading analytics…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle size={28} className="text-red-400" />
        <p className="text-sm text-red-500">{error}</p>
        <button onClick={load} className="text-xs text-blue-600 underline">Retry</button>
      </div>
    );
  }

  const { kpis, submissionsByMonth, byArea, topGCs, bidDistribution, moduleUsage, recentProjects } = data;

  // Slice month data to selected range
  const monthData = submissionsByMonth.slice(-monthRange);

  // Donut inner label
  const totalAreaCount = byArea.reduce((s, a) => s + a.count, 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-10">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Analytics Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Cross-project bid intelligence — all time</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-lg px-3 py-2 transition-all"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard
          icon={Briefcase}
          label="Total Projects"
          value={kpis.totalProjects}
          sub={`${kpis.proposalsSent} with proposals`}
          color="blue"
        />
        <KPICard
          icon={DollarSign}
          label="Total Bid Value"
          value={fmtK(kpis.totalBidValue)}
          sub="Across all proposals"
          color="green"
        />
        <KPICard
          icon={BarChart3}
          label="Avg Bid Size"
          value={fmtK(kpis.avgBid)}
          sub="Per proposal sent"
          color="purple"
        />
        <KPICard
          icon={TrendingUp}
          label="Avg Margin"
          value={fmtPct(kpis.avgMargin)}
          sub="Bid vs. direct cost"
          color="amber"
        />
        <KPICard
          icon={Users}
          label="Unique GCs"
          value={kpis.activeGCs}
          sub="General contractors"
          color="cyan"
        />
        <KPICard
          icon={Activity}
          label="Pipeline"
          value={kpis.pipelineCount}
          sub={`${fmtK(kpis.pipelineValue)} est. value`}
          color="red"
        />
      </div>

      {/* ── Monthly Trend ── */}
      <Card>
        <div className="flex items-center justify-between mb-1">
          <SectionTitle sub="Number of projects created per month">Monthly Submission Trend</SectionTitle>
          <div className="flex gap-1">
            {[6, 12, 24].map(n => (
              <button
                key={n}
                onClick={() => setMonthRange(n)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                  monthRange === n ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:border-blue-300'
                }`}
              >
                {n}mo
              </button>
            ))}
          </div>
        </div>
        {monthData.some(m => m.count > 0) ? (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={monthData} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis yAxisId="count" orientation="left"  tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis yAxisId="value" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => fmtK(v)} />
              <Tooltip content={<CurrencyTooltip />} />
              <Bar    yAxisId="count" dataKey="count" name="# Projects" fill="#3b82f6" radius={[4,4,0,0]} opacity={0.85} />
              <Line   yAxisId="value" dataKey="value" name="Bid Value"  stroke="#10b981" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart message="Create and send proposals to see monthly trends" />
        )}
      </Card>

      {/* ── Area + GC row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* By Area */}
        <Card>
          <div className="flex items-center justify-between mb-1">
            <SectionTitle sub="Project distribution by city / region">Submissions by Area</SectionTitle>
            <div className="flex gap-1">
              {['count','value'].map(v => (
                <button key={v} onClick={() => setAreaView(v)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    areaView === v ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:border-blue-300'
                  }`}>
                  {v === 'count' ? '# Projects' : 'Bid $'}
                </button>
              ))}
            </div>
          </div>
          {byArea.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie
                    data={byArea}
                    dataKey={areaView === 'count' ? 'count' : 'value'}
                    nameKey="area"
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={2}
                  >
                    {byArea.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => areaView === 'count' ? [v, n] : [fmt(v), n]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {byArea.slice(0, 7).map((a, i) => (
                  <div key={a.area} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
                    <span className="text-xs text-gray-600 flex-1 truncate">{a.area}</span>
                    <span className="text-xs font-bold text-gray-800">
                      {areaView === 'count' ? a.count : fmtK(a.value)}
                    </span>
                    {a.avgMargin != null && (
                      <span className="text-xs text-green-600 font-medium">{fmtPct(a.avgMargin)}</span>
                    )}
                  </div>
                ))}
                <div className="text-xs text-gray-400 pt-1">{totalAreaCount} projects total</div>
              </div>
            </div>
          ) : (
            <EmptyChart message="Add locations to projects to see area breakdown" />
          )}
        </Card>

        {/* Top GCs */}
        <Card>
          <div className="flex items-center justify-between mb-1">
            <SectionTitle sub="General contractors ranked by submission volume">Top 10 General Contractors</SectionTitle>
            <div className="flex gap-1">
              {['count','value'].map(v => (
                <button key={v} onClick={() => setGcView(v)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    gcView === v ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-500 border-gray-200 hover:border-blue-300'
                  }`}>
                  {v === 'count' ? '# Bids' : 'Total $'}
                </button>
              ))}
            </div>
          </div>
          {topGCs.filter(g => g.gc !== 'Unknown GC').length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={topGCs.filter(g => g.gc !== 'Unknown GC').slice(0, 10)}
                layout="vertical"
                margin={{ top: 0, right: 30, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={gcView === 'value' ? v => fmtK(v) : undefined}
                />
                <YAxis type="category" dataKey="gc" tick={{ fontSize: 11 }} width={120} />
                <Tooltip
                  formatter={(v) => gcView === 'count' ? [v, '# Projects'] : [fmt(v), 'Total Bid']}
                />
                <Bar
                  dataKey={gcView === 'count' ? 'count' : 'value'}
                  radius={[0, 4, 4, 0]}
                >
                  {topGCs.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Add GC names to projects to see rankings" />
          )}
        </Card>
      </div>

      {/* ── Bid Distribution + Module Usage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Bid Size Distribution */}
        <Card>
          <SectionTitle sub="How your bids are sized — spot your sweet spot">Bid Value Distribution</SectionTitle>
          {bidDistribution.some(b => b.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bidDistribution} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v, n) => n === 'count' ? [v, '# Projects'] : [fmt(v), 'Total']} />
                <Bar dataKey="count" name="count" radius={[4,4,0,0]} fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Send proposals to see bid size distribution" />
          )}
        </Card>

        {/* Module Usage */}
        <Card>
          <SectionTitle sub="Which estimating modules are used most across all projects">Module Usage Frequency</SectionTitle>
          {moduleUsage.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={moduleUsage} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="module" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => [v, '# Projects']} />
                <Bar dataKey="count" radius={[4,4,0,0]}>
                  {moduleUsage.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart message="Estimating module data will appear here" />
          )}
        </Card>
      </div>

      {/* ── Avg Margin by Area ── */}
      {byArea.some(a => a.avgMargin != null) && (
        <Card>
          <SectionTitle sub="Average bid margin % per city — identify your most profitable markets">Margin by Area</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byArea.filter(a => a.avgMargin != null)} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="area" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v.toFixed(0)}%`} domain={[0, 'auto']} />
              <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, 'Avg Margin']} />
              <Bar dataKey="avgMargin" name="Avg Margin" radius={[4,4,0,0]} fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Bid Value Over Time (cumulative) ── */}
      {submissionsByMonth.some(m => m.value > 0) && (
        <Card>
          <SectionTitle sub="Cumulative bid value trend — see your pipeline growing over time">Cumulative Bid Value</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={(() => {
                let cum = 0;
                return submissionsByMonth.slice(-monthRange).map(m => ({ ...m, cumValue: (cum += m.value) }));
              })()}
              margin={{ top: 5, right: 10, bottom: 5, left: 20 }}
            >
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtK(v)} />
              <Tooltip formatter={(v) => [fmt(v), 'Cumulative Bid Value']} />
              <Area dataKey="cumValue" stroke="#3b82f6" strokeWidth={2} fill="url(#cumGrad)" name="Cumulative" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* ── Recent Projects Table ── */}
      <Card>
        <SectionTitle sub="Latest 10 projects created">Recent Projects</SectionTitle>
        {recentProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th className="pb-3 pr-4 font-semibold">Project</th>
                  <th className="pb-3 pr-4 font-semibold">Area</th>
                  <th className="pb-3 pr-4 font-semibold">General Contractor</th>
                  <th className="pb-3 pr-4 font-semibold">Bid Date</th>
                  <th className="pb-3 pr-4 font-semibold text-right">Bid Value</th>
                  <th className="pb-3 pr-4 font-semibold text-right">Margin</th>
                  <th className="pb-3 font-semibold text-right">Modules</th>
                </tr>
              </thead>
              <tbody>
                {recentProjects.map((p, i) => (
                  <tr key={p.id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${i % 2 ? 'bg-gray-50/30' : ''}`}>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-gray-800 max-w-[180px] truncate">{p.name}</div>
                      <div className="text-xs text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-1 text-gray-600">
                        <MapPin size={11} className="text-gray-400" />{p.area}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-gray-600 max-w-[140px] truncate">{p.gc}</td>
                    <td className="py-3 pr-4 text-gray-500 text-xs">
                      {p.bidDate ? (
                        <span className="flex items-center gap-1"><Clock size={11}/>{p.bidDate}</span>
                      ) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold text-gray-800">
                      {p.bidValue > 0 ? fmt(p.bidValue) : <span className="text-gray-300 font-normal">No proposal</span>}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {p.margin != null ? (
                        <span className={`font-bold ${p.margin >= 20 ? 'text-green-600' : p.margin >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                          {fmtPct(p.margin)}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="py-3 text-right">
                      <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        {p.estimateCount}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyChart message="No projects yet — create your first estimate to see it here" />
        )}
      </Card>

      {/* ── Insight Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Top market */}
        {byArea[0] && (
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 text-white">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={16} className="text-blue-200" />
              <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Top Market</span>
            </div>
            <div className="text-2xl font-black">{byArea[0].area}</div>
            <div className="text-blue-200 text-sm mt-1">{byArea[0].count} project{byArea[0].count !== 1 ? 's' : ''}</div>
            {byArea[0].value > 0 && <div className="text-blue-100 text-xs mt-0.5">{fmtK(byArea[0].value)} total</div>}
          </div>
        )}
        {/* Top GC */}
        {topGCs.filter(g => g.gc !== 'Unknown GC')[0] && (() => {
          const gc = topGCs.filter(g => g.gc !== 'Unknown GC')[0];
          return (
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} className="text-emerald-200" />
                <span className="text-xs font-semibold text-emerald-200 uppercase tracking-wider">Top GC</span>
              </div>
              <div className="text-2xl font-black truncate">{gc.gc}</div>
              <div className="text-emerald-200 text-sm mt-1">{gc.count} submission{gc.count !== 1 ? 's' : ''}</div>
              {gc.value > 0 && <div className="text-emerald-100 text-xs mt-0.5">{fmtK(gc.value)} total</div>}
            </div>
          );
        })()}
        {/* Avg margin */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-amber-100" />
            <span className="text-xs font-semibold text-amber-100 uppercase tracking-wider">Portfolio Margin</span>
          </div>
          <div className="text-2xl font-black">{fmtPct(kpis.avgMargin)}</div>
          <div className="text-amber-100 text-sm mt-1">Average across all bids</div>
          <div className="text-amber-200 text-xs mt-0.5">
            {kpis.pipelineCount} project{kpis.pipelineCount !== 1 ? 's' : ''} in pipeline
          </div>
        </div>
      </div>

    </div>
  );
}
