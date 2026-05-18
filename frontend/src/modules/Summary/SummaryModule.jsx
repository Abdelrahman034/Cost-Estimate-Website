import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { rollUpSummary, applyOverheadAndMargin } from '@utils/ductCalculations';
import { DollarSign, TrendingUp, Clock, Package } from 'lucide-react';

const defaultModules = [
  { name: 'Metal Duct', materialCost: 0, laborCost: 0, laborHours: 0 },
  { name: 'CW Pipe', materialCost: 0, laborCost: 0, laborHours: 0 },
  { name: 'VAV Boxes', materialCost: 0, laborCost: 0, laborHours: 0 },
  { name: 'Equipment', materialCost: 0, laborCost: 0, laborHours: 0 },
  { name: 'Controls', materialCost: 0, laborCost: 0, laborHours: 0 },
  { name: 'Diffusers', materialCost: 0, laborCost: 0, laborHours: 0 },
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function SummaryModule({ projectInfo }) {
  const [modules, setModules] = useState(defaultModules);
  const [overhead, setOverhead] = useState({ overheadPct: 0.15, profitPct: 0.10 });

  const handleModuleChange = (index, field, value) => {
    setModules((prev) => prev.map((m, i) =>
      i === index ? { ...m, [field]: parseFloat(value) || 0 } : m
    ));
  };

  const summary = rollUpSummary(modules);
  const bid = applyOverheadAndMargin(summary.directCost, overhead.overheadPct, overhead.profitPct);

  const chartData = modules
    .filter((m) => m.materialCost + m.laborCost > 0)
    .map((m) => ({
      name: m.name,
      material: m.materialCost,
      labor: m.laborCost,
      total: m.materialCost + m.laborCost,
    }));

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bid Summary</h1>
        <p className="text-sm text-gray-500 mt-1">
          Roll up all modules into a final bid — the same logic as your Excel Summary sheet
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Material', value: `$${summary.materialCost.toLocaleString()}`, icon: Package, color: 'green' },
          { label: 'Total Labor', value: `$${summary.laborCost.toLocaleString()}`, icon: Clock, color: 'blue' },
          { label: 'Total Hours', value: `${summary.laborHours.toLocaleString()} hrs`, icon: Clock, color: 'purple' },
          { label: 'Final Bid', value: `$${bid.total.toLocaleString()}`, icon: DollarSign, color: 'red' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`card bg-${color}-50 border-${color}-200`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon size={16} className={`text-${color}-500`} />
              <span className="text-xs font-medium text-gray-500">{label}</span>
            </div>
            <div className={`text-xl font-bold text-${color}-700`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Module Input Table */}
        <div className="card">
          <h3 className="section-title">Module Costs</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Module</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Material $</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Labor $</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Hrs</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m, i) => (
                  <tr key={m.name} className={`border-t border-gray-100 ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-3 py-2 font-medium text-gray-700">{m.name}</td>
                    {['materialCost', 'laborCost', 'laborHours'].map((field) => (
                      <td key={field} className="px-2 py-1.5">
                        <input
                          type="number"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                          value={m[field] || ''}
                          placeholder="0"
                          onChange={(e) => handleModuleChange(i, field, e.target.value)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Overhead Settings + Bid */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="section-title text-sm">Overhead & Profit</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Overhead %</label>
                <input
                  type="number"
                  className="input"
                  value={Math.round(overhead.overheadPct * 100)}
                  onChange={(e) => setOverhead({ ...overhead, overheadPct: parseInt(e.target.value) / 100 })}
                />
              </div>
              <div>
                <label className="label">Profit %</label>
                <input
                  type="number"
                  className="input"
                  value={Math.round(overhead.profitPct * 100)}
                  onChange={(e) => setOverhead({ ...overhead, profitPct: parseInt(e.target.value) / 100 })}
                />
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-gray-900 to-blue-900 text-white">
            <h3 className="text-sm font-semibold text-gray-300 mb-4">BID SUMMARY</h3>
            {[
              { label: 'Direct Cost', val: bid.directCost },
              { label: `Overhead (${Math.round(overhead.overheadPct * 100)}%)`, val: bid.overhead },
              { label: 'Subtotal', val: bid.subtotal, bold: true },
              { label: `Profit (${Math.round(overhead.profitPct * 100)}%)`, val: bid.profit },
            ].map(({ label, val, bold }) => (
              <div key={label} className="flex justify-between py-2 border-b border-white/10 last:border-0">
                <span className={`text-sm ${bold ? 'text-white font-semibold' : 'text-gray-300'}`}>{label}</span>
                <span className={`text-sm ${bold ? 'font-bold' : 'text-gray-200'}`}>${val.toLocaleString()}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-3">
              <span className="font-bold text-lg">TOTAL BID</span>
              <span className="text-2xl font-black">${bid.total.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card">
          <h3 className="section-title">Cost by Module</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Bar dataKey="material" name="Material" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="labor" name="Labor" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
