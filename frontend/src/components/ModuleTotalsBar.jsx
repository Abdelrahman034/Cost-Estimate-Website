// components/ModuleTotalsBar.jsx
//
// Sticky mini-summary bar shown inside each estimate module.
// Sits below the EstimateProjectBanner so totals are always visible
// without scrolling to the bottom of the module.
//
// Props:
//   material  — total material cost (number)
//   labor     — total labor cost (number)
//   total     — total cost (number)
//   hours     — total labor hours (number, optional)
//   label     — module name shown on the left (e.g. "Metal Duct")

import React from 'react';

const fmt = (n) =>
  n == null || isNaN(n)
    ? '—'
    : Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtHrs = (n) =>
  n == null || isNaN(n) || Number(n) === 0
    ? null
    : `${Number(n).toLocaleString('en-US', { maximumFractionDigits: 1 })} hrs`;

export default function ModuleTotalsBar() {
  // Removed per request — the per-module sticky totals strip is no longer shown.
  // Totals remain available at the bottom of each module and in Bid Summary.
  return null;
}

// eslint-disable-next-line no-unused-vars
function _ModuleTotalsBarLegacy({ material, labor, total, hours, label }) {
  const hasData = Number(total) > 0;
  if (!hasData) return null;

  return (
    <div className="sticky top-0 z-20 flex items-center gap-6 px-4 py-2 bg-white border-b border-gray-100 shadow-sm text-xs mb-4">
      {label && (
        <span className="font-semibold text-gray-400 uppercase tracking-wide text-[10px] mr-2">{label}</span>
      )}
      <div className="flex items-center gap-1">
        <span className="text-gray-400">Material</span>
        <span className="font-semibold text-gray-700">{fmt(material)}</span>
      </div>
      <span className="text-gray-200">·</span>
      <div className="flex items-center gap-1">
        <span className="text-gray-400">Labor</span>
        <span className="font-semibold text-gray-700">{fmt(labor)}</span>
      </div>
      {fmtHrs(hours) && (
        <>
          <span className="text-gray-200">·</span>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Hours</span>
            <span className="font-semibold text-gray-700">{fmtHrs(hours)}</span>
          </div>
        </>
      )}
      <span className="text-gray-200">·</span>
      <div className="flex items-center gap-1">
        <span className="text-gray-400">Total</span>
        <span className="font-bold text-blue-700 text-sm">{fmt(total)}</span>
      </div>
    </div>
  );
}
