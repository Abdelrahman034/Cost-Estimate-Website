import React from 'react';
import { Trash2, Copy } from 'lucide-react';

const fmt = (n) =>
  n == null
    ? '—'
    : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function ElectricHeatRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const bg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
  const hasResult = !!result && (parseFloat(row.unitCost) > 0 || parseFloat(row.labor) > 0);

  const handleChange = (field, value) => onChange(row.id, field, value);

  return (
    <tr className={`${bg} border-b border-gray-100 hover:bg-blue-50/30 transition-colors`}>

      {/* Item # */}
      <td className="px-3 py-2 text-xs text-gray-400 font-mono text-center w-12">
        {index + 1}
      </td>

      {/* Tag / ID */}
      <td className="px-3 py-2 w-28">
        <input
          type="text"
          placeholder="EH-1"
          className="input text-xs"
          value={row.tagId}
          onChange={(e) => handleChange('tagId', e.target.value)}
        />
      </td>

      {/* Building */}
      <td className="px-3 py-2 w-24">
        <input
          type="text"
          placeholder="A"
          className="input text-xs"
          value={row.building}
          onChange={(e) => handleChange('building', e.target.value)}
        />
      </td>

      {/* KW */}
      <td className="px-3 py-2 w-24">
        <input
          type="number"
          min="0"
          step="0.1"
          placeholder="0"
          className="input text-xs"
          value={row.kw || ''}
          onChange={(e) => handleChange('kw', parseFloat(e.target.value) || 0)}
        />
      </td>

      {/* Unit Cost */}
      <td className="px-3 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            className="input text-xs pl-5"
            value={row.unitCost || ''}
            onChange={(e) => handleChange('unitCost', parseFloat(e.target.value) || 0)}
          />
        </div>
      </td>

      {/* Misc Parts (computed) */}
      <td className="px-3 py-2 text-xs font-mono text-gray-500 w-28">
        {hasResult
          ? fmt(result.miscParts)
          : <span className="text-gray-300">—</span>}
      </td>

      {/* Total Materials (computed) */}
      <td className="px-3 py-2 text-xs font-mono w-28">
        {hasResult
          ? <span className="text-green-700 font-semibold">{fmt(result.totalMaterial)}</span>
          : <span className="text-gray-300">—</span>}
      </td>

      {/* Labor (manual) */}
      <td className="px-3 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            className={`input text-xs pl-5 ${parseFloat(row.labor) > 0 ? 'border-blue-300 bg-blue-50' : ''}`}
            value={row.labor || ''}
            onChange={(e) => handleChange('labor', parseFloat(e.target.value) || 0)}
          />
        </div>
      </td>

      {/* Mat + Lab (computed) */}
      <td className="px-3 py-2 text-xs font-mono w-28">
        {hasResult && result.matPlusLab > 0
          ? <span className="bg-gray-900 text-white px-2 py-1 rounded text-xs font-bold">
              {fmt(result.matPlusLab)}
            </span>
          : <span className="text-gray-300">—</span>}
      </td>

      {/* Notes */}
      <td className="px-3 py-2 w-36">
        <input
          type="text"
          placeholder="notes..."
          className="input text-xs"
          value={row.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
        />
      </td>

      {/* Duplicate / Delete */}
      <td className="px-3 py-2 w-16">
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            title="Duplicate row"
            className="text-gray-300 hover:text-blue-500 transition-colors p-1"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={onRemove}
            title="Delete row"
            className="text-gray-300 hover:text-red-500 transition-colors p-1"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
