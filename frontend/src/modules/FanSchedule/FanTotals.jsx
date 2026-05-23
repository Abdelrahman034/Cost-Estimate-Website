import React from 'react';

const fmt = (n) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function TotalCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    gray:   'bg-gray-50 border-gray-200 text-gray-900',
    green:  'bg-green-50 border-green-200 text-green-800',
    blue:   'bg-blue-50 border-blue-200 text-blue-800',
    dark:   'bg-gray-900 border-gray-700 text-white',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
  };
  return (
    <div className={`rounded-xl border px-5 py-4 ${colors[color]}`}>
      <div className="text-xs font-semibold uppercase tracking-wider opacity-60 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color === 'dark' ? 'text-white' : ''}`}>{fmt(value)}</div>
      {sub && <div className="text-xs opacity-50 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function FanTotals({ totals, rowCount, settings }) {
  const {
    totalUnitCost,
    totalOtherCost,
    totalPenetrations,
    totalMiscParts,
    totalMaterial,
    totalLaborFinal,
    totalMatPlusLab,
  } = totals;

  return (
    <div className="mt-6 space-y-4">
      {/* Primary totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <TotalCard
          label="Fan Equipment"
          value={totalUnitCost}
          sub={`+ ${fmt(totalOtherCost)} other`}
          color="gray"
        />
        <TotalCard
          label="Penetrations"
          value={totalPenetrations}
          sub={`${fmt(totalMiscParts)} misc parts`}
          color="orange"
        />
        <TotalCard
          label="Total Material"
          value={totalMaterial}
          sub={`${(settings?.miscPct ?? 0.20) * 100}% misc uplift applied`}
          color="green"
        />
        <TotalCard
          label="Total Labor"
          value={totalLaborFinal}
          sub={`$${settings?.laborRate ?? 25}/hr`}
          color="blue"
        />
        <TotalCard
          label="Grand Total"
          value={totalMatPlusLab}
          sub={`${rowCount} fan(s) · rounded to $10`}
          color="dark"
        />
      </div>

      {/* Breakdown bar */}
      {totalMatPlusLab > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
            <span className="font-semibold text-gray-700">Cost Breakdown</span>
            <span>
              Material {Math.round((totalMaterial / totalMatPlusLab) * 100)}% ·
              Labor {Math.round((totalLaborFinal / totalMatPlusLab) * 100)}%
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
              style={{ width: `${(totalLaborFinal / totalMatPlusLab) * 100}%` }}
              title={`Labor: ${fmt(totalLaborFinal)}`}
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
