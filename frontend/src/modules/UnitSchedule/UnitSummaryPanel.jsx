/**
 * Unit Summary Panel
 * Mirrors the "Unit Summary" section at the top of the Unit Sched Excel tab (rows 2-11).
 * Rolls up totals from all system-type sections.
 *
 * API_TODO: This data comes from GET /api/estimates/{projectId}/unit-schedule/summary
 */
import React from 'react';
import { Building2 } from 'lucide-react';

const fmt = (n) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const SECTION_COLORS = {
  'Packaged Unit':       'bg-purple-100 text-purple-800',
  'Standard Split':      'bg-green-100 text-green-800',
  'Wall Mount Split':    'bg-orange-100 text-orange-800',
  'VRF':                 'bg-red-100 text-red-800',
  'Service of Existing': 'bg-blue-100 text-blue-800',
};

export default function UnitSummaryPanel({ summary }) {
  const { sections = [], grand = {} } = summary || {};

  const activeSections = sections.filter(s => (s.totalCost || 0) > 0);

  return (
    <div className="card p-4 bg-gradient-to-r from-slate-800 to-slate-700 text-white">
      <div className="flex items-center gap-2 mb-3">
        <Building2 size={16} className="text-slate-300" />
        <span className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
          Unit Schedule Summary
        </span>
      </div>

      {activeSections.length === 0 ? (
        <p className="text-slate-400 text-sm">Enter unit data below to see the summary.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
          {sections.map((s) => (
            <div key={s.type} className="bg-white/10 rounded-lg p-3">
              <div className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${SECTION_COLORS[s.type] || 'bg-gray-200 text-gray-700'}`}>
                {s.type}
              </div>
              <div className="text-xs text-slate-300 mb-0.5">Material</div>
              <div className="text-sm font-semibold text-white">{fmt(s.totalMaterial)}</div>
              <div className="text-xs text-slate-300 mt-1 mb-0.5">Labor</div>
              <div className="text-sm font-semibold text-white">{fmt(s.totalLabor)}</div>
              <div className="border-t border-white/20 mt-2 pt-2">
                <div className="text-xs text-slate-300">Total</div>
                <div className="text-base font-bold text-white">{fmt(s.totalCost)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grand total bar */}
      <div className="flex items-center justify-between border-t border-white/20 pt-3 mt-1">
        <span className="text-sm text-slate-300 font-medium">Grand Total (All Units)</span>
        <div className="flex items-center gap-6 text-right">
          <div>
            <div className="text-xs text-slate-400">Total Material</div>
            <div className="text-sm font-semibold text-slate-100">{fmt(grand.totalMaterial)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Total Labor</div>
            <div className="text-sm font-semibold text-slate-100">{fmt(grand.totalLabor)}</div>
          </div>
          <div className="border-l border-white/20 pl-6">
            <div className="text-xs text-slate-300 uppercase tracking-wide">Combined</div>
            <div className="text-2xl font-bold text-white">{fmt(grand.totalCost)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
