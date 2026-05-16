import React from 'react';

export default function DiffuserTotals({ totals }) {
  return (
    <div className="mt-6">
      <div className="card">
        <h3 className="section-title">Direct Cost Summary</h3>
        <div className="space-y-3">
          {[
            { label: 'Total Units',         value: `${totals.qty} units`,                    color: '' },
            { label: 'Total Material Cost', value: `$${totals.totalMat.toLocaleString()}`,   color: 'text-green-700' },
            { label: 'Total Labor Cost',    value: `$${totals.totalLabor.toLocaleString()}`, color: 'text-blue-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
              <span className="text-sm text-gray-600">{label}</span>
              <span className={`text-sm font-semibold ${color || 'text-gray-900'}`}>{value}</span>
            </div>
          ))}
          <div className="flex justify-between items-center pt-2">
            <span className="font-semibold text-gray-900">Total Direct Cost</span>
            <span className="text-lg font-bold text-gray-900">${totals.total.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
