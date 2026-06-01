import React from 'react';
import BidTypePill from '@components/BidTypePill';
import { Trash2, Copy } from 'lucide-react';
import { DIFFUSER_TYPES } from '@utils/diffuserCalculations';

const SOURCE_BADGE = {
  table:  { label: 'Table',  cls: 'bg-gray-100 text-gray-500' },
  market: { label: 'Market', cls: 'bg-green-100 text-green-700' },
  custom: { label: 'Custom', cls: 'bg-blue-100 text-blue-700' },
  quoted: { label: 'Quoted', cls: 'bg-purple-100 text-purple-700' },
  none:   { label: '',       cls: '' },
};

const dash = <span className="text-gray-300">—</span>;

export default function DiffuserRow({ row, result, index, onChange, onRemove, onDuplicate, onAdd }) {
  const bg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
  const hasResult = !!result && result.qty > 0 && !!result.typeId;
  const badge = SOURCE_BADGE[result?.priceSource ?? 'none'] ?? SOURCE_BADGE.none;

  return (
    <tr className={`${bg} border-b border-gray-100 hover:bg-blue-50/30 transition-colors`}>

      {/* Tag / ID — Excel col C */}
      <td className="px-3 py-2 w-20">
        <input
          type="text"
          placeholder="e.g. E1"
          className="input text-xs"
          value={row.tag ?? ''}
          onChange={(e) => onChange(row.id, 'tag', e.target.value)}
        />
      </td>

      {/* Type — Excel col D */}
      <td className="px-3 py-2 w-52">
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

      {/* Qty — Excel col K */}
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

      {/* Sheetrock — Excel col E ("x" = adds frame charge col H) */}
      <td className="px-3 py-2 text-center w-20">
        <button
          type="button"
          title="Sheetrock ceiling — adds frame charge (col H)"
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

      {/* Quoted Price — Excel col F */}
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
        {hasResult && badge.label && (
          <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${badge.cls}`}>
            {badge.label}
          </span>
        )}
      </td>

      {/* Unit Price — Excel col G */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700 w-24">
        {hasResult ? <span className="font-semibold">${result.effectiveUnitPrice.toLocaleString()}</span> : dash}
      </td>

      {/* Frame — Excel col H */}
      <td className="px-3 py-2 text-xs font-mono w-20">
        {hasResult
          ? result.framePrice > 0
            ? <span className="text-amber-600 font-semibold">${result.framePrice}</span>
            : dash
          : dash}
      </td>

      {/* Misc Materials — Excel col I */}
      <td className="px-3 py-2 text-xs font-mono text-gray-500 w-24">
        {hasResult ? <span>${result.miscMat.toLocaleString()}</span> : dash}
      </td>

      {/* Labor / unit — Excel col J */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700 w-24">
        {hasResult ? <span>${result.laborPerUnit.toLocaleString()}</span> : dash}
      </td>

      {/* Total Material — Excel col L */}
      <td className="px-3 py-2 text-xs font-mono w-28">
        {hasResult
          ? <span className="text-green-700 font-semibold">${result.totalMat.toLocaleString()}</span>
          : dash}
      </td>

      {/* Total Labor — Excel col M */}
      <td className="px-3 py-2 text-xs font-mono w-24">
        {hasResult
          ? <span className="text-blue-700 font-semibold">${result.totalLabor.toLocaleString()}</span>
          : dash}
      </td>

      {/* Total — Excel col N */}
      <td className="px-3 py-2 text-xs font-mono w-28">
        {hasResult
          ? <span className="bg-gray-900 text-white px-2 py-1 rounded text-xs font-bold">${result.total.toLocaleString()}</span>
          : dash}
      </td>

      {/* Notes */}
      <td className="px-3 py-2">
        <input
          type="text"
          placeholder="notes…"
          className="input text-xs min-w-[100px]"
          value={row.notes ?? ''}
          onChange={(e) => onChange(row.id, 'notes', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && onAdd) { e.preventDefault(); onAdd(); } }}
        />
      </td>

      {/* Bid Type */}
      <td className="px-2 py-2 text-center">
        <BidTypePill value={row.bidType || 'base'} onChange={(v) => onChange(row.id, 'bidType', v)} />
      </td>

      {/* Actions */}
      <td className="px-2 py-2 w-16">
        <div className="flex items-center gap-1">
          <button onClick={onDuplicate} title="Duplicate row"
            className="text-gray-500 hover:text-blue-500 transition-colors p-1">
            <Copy size={13} />
          </button>
          <button onClick={onRemove} title="Remove row"
            className="text-gray-500 hover:text-red-500 transition-colors p-1">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}
