import React from 'react';
import { Trash2, Copy } from 'lucide-react';
import { FAN_TYPES, SIZE_CATEGORIES } from '@utils/fanScheduleCalculations';

const fmt = (n) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function FanRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const bg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
  const hasResult = !!result && !!row.fanType;

  const handleChange = (field, value) => onChange(row.id, field, value);

  return (
    <tr className={`${bg} border-b border-gray-100 hover:bg-blue-50/30 transition-colors`}>

      {/* ID / Tag */}
      <td className="px-3 py-2 w-24">
        <input
          type="text"
          placeholder="EF-1"
          className="input text-xs"
          value={row.tagId}
          onChange={(e) => handleChange('tagId', e.target.value)}
        />
      </td>

      {/* CFM */}
      <td className="px-3 py-2 w-24">
        <input
          type="number"
          min="0"
          placeholder="0"
          className="input text-xs"
          value={row.cfm}
          onChange={(e) => handleChange('cfm', e.target.value)}
        />
      </td>

      {/* Fan Type */}
      <td className="px-3 py-2 w-44">
        <select
          className="input text-xs"
          value={row.fanType}
          onChange={(e) => handleChange('fanType', e.target.value)}
        >
          <option value="">— select —</option>
          {FAN_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </td>

      {/* Size Category */}
      <td className="px-3 py-2 w-32">
        <select
          className="input text-xs"
          value={row.sizeCategory}
          onChange={(e) => handleChange('sizeCategory', e.target.value)}
        >
          {SIZE_CATEGORIES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
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

      {/* Other Cost */}
      <td className="px-3 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
            className="input text-xs pl-5"
            value={row.otherCost || ''}
            onChange={(e) => handleChange('otherCost', parseFloat(e.target.value) || 0)}
          />
        </div>
      </td>

      {/* Roof Penetration toggle */}
      <td className="px-3 py-2 text-center w-16">
        <button
          type="button"
          title="Roof penetration required"
          onClick={() => handleChange('roofPen', !row.roofPen)}
          className={`w-12 rounded border py-1 text-xs font-semibold transition-all ${
            row.roofPen
              ? 'bg-red-50 text-red-700 border-red-300'
              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
          }`}
        >
          {row.roofPen ? 'Yes' : 'No'}
        </button>
      </td>

      {/* Wall Penetration toggle */}
      <td className="px-3 py-2 text-center w-16">
        <button
          type="button"
          title="Wall (concrete) penetration required"
          onClick={() => handleChange('wallPen', !row.wallPen)}
          className={`w-12 rounded border py-1 text-xs font-semibold transition-all ${
            row.wallPen
              ? 'bg-orange-50 text-orange-700 border-orange-300'
              : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
          }`}
        >
          {row.wallPen ? 'Yes' : 'No'}
        </button>
      </td>

      {/* Penetrations $ (computed) */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700 w-24">
        {hasResult && result.penetrations > 0
          ? <span className="text-orange-600 font-semibold">{fmt(result.penetrations)}</span>
          : <span className="text-gray-300">—</span>}
      </td>

      {/* Misc Parts (computed) */}
      <td className="px-3 py-2 text-xs font-mono text-gray-500 w-24">
        {hasResult ? fmt(result.miscParts) : <span className="text-gray-300">—</span>}
      </td>

      {/* Total Material (computed) */}
      <td className="px-3 py-2 text-xs font-mono w-28">
        {hasResult
          ? <span className="text-green-700 font-semibold">{fmt(result.totalMaterial)}</span>
          : <span className="text-gray-300">—</span>}
      </td>

      {/* Labor Input (manual override in $) */}
      <td className="px-3 py-2 w-28">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="table"
            className={`input text-xs pl-5 ${row.laborInput > 0 ? 'border-purple-300 bg-purple-50' : ''}`}
            value={row.laborInput || ''}
            onChange={(e) => handleChange('laborInput', parseFloat(e.target.value) || 0)}
            title="Override labor cost — leave blank to use table"
          />
        </div>
      </td>

      {/* Labor Table (computed) */}
      <td className="px-3 py-2 text-xs font-mono text-gray-600 w-28">
        {hasResult ? (
          <span className={result.usedManualLabor ? 'line-through text-gray-300' : ''}>
            {result.laborTable > 0 ? fmt(result.laborTable) : <span className="text-gray-400 italic text-[10px]">no table</span>}
          </span>
        ) : <span className="text-gray-300">—</span>}
      </td>

      {/* Labor Final */}
      <td className="px-3 py-2 text-xs font-mono w-28">
        {hasResult && result.laborFinal > 0
          ? <span className={`font-semibold ${result.usedManualLabor ? 'text-purple-700' : 'text-blue-700'}`}>
              {fmt(result.laborFinal)}
              {result.usedManualLabor && (
                <span className="ml-1 text-[9px] bg-purple-100 text-purple-600 px-1 rounded">manual</span>
              )}
            </span>
          : <span className="text-gray-300">—</span>}
      </td>

      {/* Mat + Lab */}
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
          <button onClick={onRemove} className="text-gray-300 hover:text-red-500 transition-colors p-1">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  );
}
