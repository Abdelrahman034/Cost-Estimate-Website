import React from 'react';

export default function DuctTotals({ totals, bid, overhead }) {
  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Direct Cost Summary */}
      <div className="card">
        <h3 className="section-title">Direct Cost Summary</h3>
        <div className="space-y-3">
          {[
            { label: 'Total Linear Feet', value: `${totals.linearFeet.toLocaleString()} LF`, color: '' },
            { label: 'Total Surface Area', value: `${totals.surfaceArea.toLocaleString()} sq ft`, color: '' },
            { label: 'Total Weight', value: `${totals.weight.toLocaleString()} lbs`, color: '' },
            { label: 'Total Labor Hours', value: `${totals.laborHours.toLocaleString()} hrs`, color: 'text-blue-600' },
            { label: 'Material Cost', value: `$${totals.materialCost.toLocaleString()}`, color: 'text-green-600' },
            { label: 'Labor Cost', value: `$${totals.laborCost.toLocaleString()}`, color: 'text-blue-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">{label}</span>
              <span className={`text-sm font-semibold ${color || 'text-gray-900'}`}>{value}</span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2">
            <span className="font-semibold text-gray-900">Total Direct Cost</span>
            <span className="text-lg font-bold text-gray-900">
              ${totals.totalCost.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Bid Price with Overhead */}
      <div className="card bg-gradient-to-br from-blue-700 to-blue-900 text-white">
        <h3 className="text-sm font-semibold text-blue-200 uppercase tracking-wider mb-4">
          Final Bid Price
        </h3>
        <div className="space-y-3">
          {[
            { label: 'Direct Cost', value: `$${bid.directCost.toLocaleString()}` },
            { label: `Overhead (${Math.round(overhead.overheadPct * 100)}%)`, value: `$${bid.overhead.toLocaleString()}` },
            { label: 'Subtotal', value: `$${bid.subtotal.toLocaleString()}`, bold: true },
            { label: `Profit (${Math.round(overhead.profitPct * 100)}%)`, value: `$${bid.profit.toLocaleString()}` },
          ].map(({ label, value, bold }) => (
            <div key={label} className="flex justify-between items-center border-b border-blue-600 pb-2 last:border-0">
              <span className={`text-sm ${bold ? 'font-semibold text-white' : 'text-blue-200'}`}>
                {label}
              </span>
              <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-blue-100'}`}>{value}</span>
            </div>
          ))}
          <div className="pt-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-lg">BID PRICE</span>
              <span className="text-2xl font-black">${bid.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
