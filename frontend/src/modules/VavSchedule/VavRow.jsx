import React from 'react';
import BidTypePill from '@components/BidTypePill';
import { Trash2, Copy } from 'lucide-react';

const fmt = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function VavRow({ row, result, index, onChange, onRemove, onDuplicate, onAdd }) {
  const bg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
  const hasResult = !!result;
  const derivedUnitCost = Number(row.pricePerCfm) > 0;

  const handleChange = (field, value) => onChange(row.id, field, value);

  return (
    <tr className={`${bg} border-b border-gray-100 hover:bg-purple-50/30 transition-colors`}>

      {/* Building */}
      <td className="px-3 py-2 w-20">
        <input
          type="text"
          placeholder="A"
          className="input text-xs"
          value={row.building}
          onChange={(e) => handleChange('building', e.target.value)}
        />
      </td>

      {/* ID / Tag */}
      <td className="px-3 py-2 w-24">
        <input
          type="text"
          placeholder="VAV-1"
          className="input text-xs"
          value={row.idTag}
          onChange={(e) => handleChange('idTag', e.target.value)}
        />
      </td>

      {/* Fan CFM */}
      <td className="px-3 py-2 w-24">
        <input
          type="number"
          min="0"
          placeholder="0"
          className="input text-xs"
          value={row.fanCfm || ''}
          onChange={(e) => handleChange('fanCfm', e.target.value)}
        />
      </td>

      {/* Dia */}
      <td className="px-3 py-2 w-20">
        <input
          type="text"
          placeholder='6"'
          className="input text-xs"
          value={row.dia}
          onChange={(e) => handleChange('dia', e.target.value)}
        />
      </td>

      {/* Price / CFM */}
      <td className="px-3 py-2 w-24">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="—"
            className="input text-xs pl-5"
            value={row.pricePerCfm || ''}
            onChange={(e) => handleChange('pricePerCfm', parseFloat(e.target.value) || 0)}
            title="Optional — drives Unit Cost = CFM × Price/CFM"
          />
        </div>
      </td>

      {/* Unit Cost (col H) — input, or derived when Price/CFM set */}
      <td className="px-3 py-2 w-28">
        {derivedUnitCost ? (
          <span className="text-xs font-mono text-gray-600" title="Derived from CFM × Price/CFM">
            {fmt(result?.unitCost)} <span className="text-[9px] text-purple-500">auto</span>
          </span>
        ) : (
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
        )}
      </td>

      {/* Controls (col I) */}
      <td className="px-3 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            className="input text-xs pl-5"
            value={row.controls || ''}
            onChange={(e) => handleChange('controls', parseFloat(e.target.value) || 0)}
          />
        </div>
      </td>

      {/* Other (col J) */}
      <td className="px-3 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            className="input text-xs pl-5"
            value={row.other || ''}
            onChange={(e) => handleChange('other', parseFloat(e.target.value) || 0)}
          />
        </div>
      </td>

      {/* Misc Parts (computed, col K) */}
      <td className="px-3 py-2 text-xs font-mono text-gray-500 w-24">
        {hasResult ? fmt(result.miscParts) : <span className="text-gray-300">—</span>}
      </td>

      {/* Total Material (computed, col L) */}
      <td className="px-3 py-2 text-xs font-mono w-28">
        {hasResult
          ? <span className="text-green-700 font-semibold">{fmt(result.totalMaterial)}</span>
          : <span className="text-gray-300">—</span>}
      </td>

      {/* Labor (input, col M) */}
      <td className="px-3 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            className="input text-xs pl-5"
            value={row.labor || ''}
            onChange={(e) => handleChange('labor', parseFloat(e.target.value) || 0)}
          />
        </div>
      </td>

      {/* Mat + Lab (computed, col N) */}
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
          onKeyDown={(e) => { if (e.key === 'Enter' && onAdd) { e.preventDefault(); onAdd(); } }}
        />
      </td>

      {/* Bid Type */}
      <td className="px-2 py-2 text-center">
        <BidTypePill value={row.bidType || 'base'} onChange={(v) => handleChange('bidType', v)} />
      </td>

      {/* Duplicate / Delete */}
      <td className="px-3 py-2 w-16">
        <div className="flex items-center gap-1">
          <button
            onClick={onDuplicate}
            title="Duplicate row"
            className="text-gray-500 hover:text-blue-500 transition-colors p-1"
          >
            <Copy size={14} />
          </button>
          <button onClick={onRemove} className="text-gray-500 hover:text-red-500 transition-colors p-1">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
