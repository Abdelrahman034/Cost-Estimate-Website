import React from 'react';
import { Trash2 } from 'lucide-react';
import { DIFFUSER_TYPES } from '../../utils/diffuserCalculations';

const SOURCE_BADGE = {
  table:  { label: 'Table',  cls: 'bg-gray-100 text-gray-500' },
  market: { label: 'Market', cls: 'bg-green-100 text-green-700' },
  custom: { label: 'Custom', cls: 'bg-blue-100 text-blue-700' },
  quoted: { label: 'Quoted', cls: 'bg-purple-100 text-purple-700' },
  none:   { label: '',       cls: '' },
};

export default function DiffuserRow({ row, result, index, onChange, onRemove }) {
  const bg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
  // Only treat as a real result when the row has a type and at least 1 unit calculated
  const hasResult = !!result && result.qty > 0 && !!result.typeId;
  const badge = SOURCE_BADGE[result?.priceSource ?? 'none'] ?? SOURCE_BADGE.none;

  return (
    <tr className={`${bg} border-b border-gray-100 hover:bg-blue-50/30 transition-colors`}>

      {/* Type */}
      <td className="px-3 py-2 w-56">
        <select
          className="input text-xs"
          value={row.typeId}
          onChange={(e) => onChange(row.id, 'typeId', e.target.value)}
        >
          <option value="">— select type —</option>
          {DIFFUSER_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </td>

      {/* Qty */}
      <td className="px-3 py-2 w-20">
        <input
          type="number"
          min="0"
          placeholder="0"
          className="input text-xs"
          value={row.qty}
          onChange={(e) => onChange(row.id, 'qty', e.target.value)}
        />
      </td>

      {/* Sheetrock */}
      <td className="px-3 py-2 text-center w-20">
        <button
          type="button"
          title="Sheetrock ceiling — adds $25 frame"
          onClick={() => onChange(row.id, 'sheetrock', !row.sheetrock)}
          className={`w-16 rounded-lg border py-1.5 text-xs font-semibold transition-all ${
            row.sheetrock
              ? 'bg-amber-50 text-amber-700 border-amber-300'
              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
          }`}
        >
          {row.sheetrock ? 'Yes' : 'No'}
        </button>
      </td>

      {/* Quoted Price (custom per-row override) */}
      <td className="px-3 py-2 w-32">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0 = estimated"
            className="input text-xs pl-5"
            value={row.quotedPrice || ''}
            onChange={(e) => onChange(row.id, 'quotedPrice', parseFloat(e.target.value) || 0)}
          />
        </div>
        {hasResult && (
          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        )}
      </td>

      {/* Unit Price (effective) */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700 w-24">
        {hasResult ? (
          <span className="font-semibold">${result.effectiveUnitPrice.toLocaleString()}</span>
        ) : <span className="text-gray-300">—</span>}
      </td>

      {/* Frame */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700 w-20">
        {hasResult ? (
          result.framePrice > 0
            ? <span className="text-amber-600 font-semibold">${result.framePrice}</span>
            : <span className="text-gray-300">—</span>
        ) : <span className="text-gray-300">—</span>}
      </td>

      {/* Misc Materials */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700 w-24">
        {hasResult ? (
          <span className="text-gray-500">${result.miscMat.toLocaleString()}</span>
        ) : <span className="text-gray-300">—</span>}
      </td>

      {/* Labor / unit */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700 w-24">
        {hasResult ? (
          <span>${result.laborPerUnit.toLocaleString()}</span>
        ) : <span className="text-gray-300">—</span>}
      </td>

      {/* Total Material */}
      <td className="px-3 py-2 text-xs font-mono w-28">
        {hasResult ? (
          <span className="text-green-700 font-semibold">${result.totalMat.toLocaleString()}</span>
        ) : <span className="text-gray-300">—</span>}
      </td>

      {/* Total Labor */}
      <td className="px-3 py-2 text-xs font-mono w-24">
        {hasResult ? (
          <span className="text-blue-700 font-semibold">${result.totalLabor.toLocaleString()}</span>
        ) : <span className="text-gray-300">—</span>}
      </td>

      {/* Total */}
      <td className="px-3 py-2 text-xs font-mono w-28">
        {hasResult ? (
          <span className="bg-gray-900 text-white px-2 py-1 rounded text-xs font-bold">
            ${result.total.toLocaleString()}
          </span>
        ) : <span className="text-gray-300">—</span>}
      </td>

      {/* Delete */}
      <td className="px-3 py-2 w-8">
        <button onClick={onRemove} className="text-gray-300 hover:text-red-500 transition-colors p-1">
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
