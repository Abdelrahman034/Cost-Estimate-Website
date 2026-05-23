import React from 'react';

const fmt = (n) =>
  `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const fmtKw = (n) =>
  `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kW`;

export default function ElectricHeatTotals({ totals, rowCount, settings }) {
  return (
    <div className="mt-4 card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700 text-sm">Totals — {rowCount} heater(s)</h3>
        <span className="text-xs text-gray-400">
          Misc parts rate: {Math.round(settings.miscPct * 100)}%
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total kW</div>
          <div className="text-lg font-bold text-gray-700">{fmtKw(totals.totalKw)}</div>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Unit Cost</div>
          <div className="text-lg font-bold text-blue-700">{fmt(totals.totalUnitCost)}</div>
        </div>

        <div className="bg-amber-50 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Misc Parts</div>
          <div className="text-lg font-bold text-amber-700">{fmt(totals.totalMiscParts)}</div>
        </div>

        <div className="bg-green-50 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total Material</div>
          <div className="text-lg font-bold text-green-700">{fmt(totals.totalMaterial)}</div>
        </div>

        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total Labor</div>
          <div className="text-lg font-bold text-purple-700">{fmt(totals.totalLabor)}</div>
          <div className="text-[9px] text-gray-400 mt-0.5">rounded to $10</div>
        </div>

        <div className="bg-gray-900 rounded-lg p-3 text-center">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Mat + Lab</div>
          <div className="text-lg font-bold text-white">{fmt(totals.totalMatPlusLab)}</div>
          <div className="text-[9px] text-gray-400 mt-0.5">rounded to $10</div>
        </div>
      </div>
    </div>
  );
}
