import React from 'react';

const fmt = (n) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function TotalCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    gray:   'bg-gray-50 border-gray-200 text-gray-900',
    green:  'bg-green-50 border-green-200 text-green-800',
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    dark:   'bg-gray-900 border-gray-700 text-white',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
  };
  return (
    <div className={`rounded-xl border px-5 py-4 ${colors[color]}`}>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color === 'dark' ? 'text-white' : ''}`}>{fmt(value)}</div>
      {sub && <div className="text-xs opacity-50 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function VavTotals({ totals, rowCount, settings }) {
  const {
    totalCfm,
    totalUnitCost,
    totalControls,
    totalOther,
    totalMiscParts,
    totalMaterial,
    totalLabor,
    totalMatPlusLab,
  } = totals;

  return (
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <TotalCard
          label="Box Equipment"
          value={totalUnitCost}
          sub={`+ ${fmt(totalControls)} controls`}
          color="gray"
        />
        <TotalCard
          label="Misc Parts"
          value={totalMiscParts}
          sub={`${(settings?.miscPct ?? 0.10) * 100}% of mat. + ${fmt(totalOther)} other`}
          color="purple"
        />
        <TotalCard
          label="Total Material"
          value={totalMaterial}
          sub="rounded to nearest $10"
          color="green"
        />
        <TotalCard
          label="Total Labor"
          value={totalLabor}
          sub="rounded to nearest $10"
          color="blue"
        />
        <TotalCard
          label="Grand Total"
          value={totalMatPlusLab}
          sub={`${rowCount} VAV box(es) · ${Math.round(totalCfm).toLocaleString()} CFM`}
          color="dark"
        />
      </div>

      {totalMatPlusLab > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">Cost Breakdown</span>
            <span>
              Material {Math.round((totalMaterial / totalMatPlusLab) * 100)}% ·
              Labor {Math.round((totalLabor / totalMatPlusLab) * 100)}%
            </span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden gap-px">
            <div
              className="bg-green-400 transition-all duration-500"
              style={{ width: `${(totalMaterial / totalMatPlusLab) * 100}%` }}
              title={`Material: ${fmt(totalMaterial)}`}
            />
            <div
              className="bg-blue-400 transition-all duration-500"
              style={{ width: `${(totalLabor / totalMatPlusLab) * 100}%` }}
              title={`Labor: ${fmt(totalLabor)}`}
            />
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-block w-2 h-2 rounded-full bg-green-400" /> Material
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-400" /> Labor
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
