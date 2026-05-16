import React from 'react';

export default function DuctTotals({ totals }) {
  return (
    <div className="mt-6">
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

          <div className="pt-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
              Accessory Breakdown
            </div>
            <div className="space-y-2">
              {[
                { label: 'External Insulation', value: totals.insulationCost || 0, color: 'text-blue-600' },
                { label: 'Internal Insulation', value: totals.internalInsulationCost || 0, color: 'text-purple-600' },
                { label: 'Flex Duct', value: totals.flexDuctCost || 0, color: 'text-orange-600' },
                { label: 'VD', value: totals.vdCost || 0, color: 'text-green-600' },
                { label: 'Offtake', value: totals.offtakeCost || 0, color: 'text-red-600' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{label}</span>
                  <span className={`text-sm font-semibold ${color}`}>
                    ${Number(value).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <span className="font-semibold text-gray-900">Total Direct Cost</span>
            <span className="text-lg font-bold text-gray-900">
              ${totals.totalCost.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
