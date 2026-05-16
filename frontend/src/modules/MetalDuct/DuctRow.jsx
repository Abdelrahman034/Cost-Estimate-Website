import React from 'react';
import { Circle, CheckCircle2, Trash2 } from 'lucide-react';
import { selectGauge, getMaxDimension, calculateSurfaceArea, detectShape } from '../../utils/ductCalculations';

export default function DuctRow({ row, result, index, onChange, onRemove, sizePresets = [], unitLabel = 'ft', showScaleHint = false, scaleFactor = 1.0 }) {
  const maxDim = getMaxDimension(row.size);
  const gauge = row.size ? selectGauge(maxDim) : null;
  const shape = row.size ? detectShape(row.size) : null;

  // Actual feet after applying scale factor (mirrors Excel J4 = E2 × D4)
  const rawLf = Number(row.linearFeet || 0);
  const actualLf = rawLf * scaleFactor;

  // Preview area matches Excel N4: no waste, deduct flex length when flex is checked
  const rigidLf = row.flexDuct
    ? Math.max(0, actualLf - 5)
    : actualLf;
  const previewArea = row.size && row.linearFeet
    ? calculateSurfaceArea(row.size, rigidLf).toFixed(1)
    : null;

  const bg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
  const hasResult = !!result;

  const accessoryCell = (label, title, checked, value, field, toneClass, hoverClass) => (
    <td className="px-2 py-2 text-center">
      <button
        type="button"
        title={title}
        onClick={() => onChange(row.id, field, !checked)}
        className={`group w-full min-w-[96px] rounded-xl border px-2.5 py-2 text-left transition-all duration-150 shadow-sm ${
          checked
            ? `${toneClass} border-current ring-1 ring-inset ring-current/20`
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
        } ${hoverClass}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide leading-none opacity-80">
              {label}
            </div>
            <div className="mt-1 text-xs font-bold leading-none">
              {hasResult ? `$${Number(value || 0).toLocaleString()}` : '—'}
            </div>
          </div>
          <span className={`mt-0.5 inline-flex items-center justify-center ${checked ? 'text-current' : 'text-gray-300'}`}>
            {checked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
          </span>
        </div>
      </button>
    </td>
  );

  return (
    <tr className={`${bg} border-b border-gray-100 hover:bg-blue-50/30 transition-colors`}>
      {/* Size */}
      <td className="px-3 py-2">
        <input
          list="duct-size-presets"
          className="input text-xs font-mono"
          placeholder="24x12 or 12"
          value={row.size}
          onChange={(e) => onChange(row.id, 'size', e.target.value)}
        />
        <datalist id="duct-size-presets">
          {sizePresets.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        {shape && (
          <div className="text-xs text-gray-400 mt-0.5">
            {shape === 'rectangular' ? '⬛ Rect' : '⭕ Round'}
          </div>
        )}
      </td>

      {/* Linear measurement (mm / in / ft / custom) */}
      <td className="px-3 py-2">
        <input
          className="input text-xs"
          type="number"
          min="0"
          placeholder="0"
          value={row.linearFeet}
          onChange={(e) => onChange(row.id, 'linearFeet', e.target.value)}
        />
        {/* Show computed feet when a scale factor is active */}
        {showScaleHint && rawLf > 0 && (
          <div className="text-xs text-blue-500 mt-0.5 font-mono">
            = {actualLf.toFixed(2)} ft
          </div>
        )}
        {previewArea && !hasResult && (
          <div className="text-xs text-gray-400 mt-0.5">{previewArea} sqft</div>
        )}
      </td>

      {/* Duct Type */}
      <td className="px-3 py-2">
        <select
          className="input text-xs"
          value={row.ductType}
          onChange={(e) => onChange(row.id, 'ductType', e.target.value)}
        >
          <option value="supply">Supply</option>
          <option value="return">Return</option>
          <option value="exhaust">Exhaust</option>
          <option value="oa">Outside Air</option>
          <option value="relief">Relief</option>
        </select>
      </td>

      {/* Gauge (auto) */}
      <td className="px-3 py-2">
        {gauge ? (
          <span className="inline-flex items-center justify-center w-10 h-7 bg-blue-100 text-blue-700 rounded text-xs font-bold">
            {gauge}
          </span>
        ) : (
          <span className="text-gray-300 text-xs">—</span>
        )}
      </td>

      {/* Sq Ft */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700">
        {hasResult ? (
          <span className="font-semibold">{result.surfaceAreaWithWaste}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Labor Hrs */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700">
        {hasResult ? result.laborHours : <span className="text-gray-300">—</span>}
      </td>

      {/* Material $ */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700">
        {hasResult ? (
          <span className="text-green-700 font-semibold">
            ${result.totalMaterialCost.toLocaleString()}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Labor $ */}
      <td className="px-3 py-2 text-xs font-mono text-gray-700">
        {hasResult ? (
          <span className="text-blue-700 font-semibold">
            ${result.laborCost.toLocaleString()}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {/* Total $ */}
      <td className="px-3 py-2 text-xs font-mono">
        {hasResult ? (
          <span className="bg-gray-900 text-white px-2 py-1 rounded text-xs font-bold">
            ${result.totalCost.toLocaleString()}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>

      {accessoryCell('Ext. Ins', 'External duct wrap', row.insulated, result?.insulationCost, 'insulated', 'bg-blue-50 text-blue-700 border-blue-200', 'hover:bg-blue-100')}
      {accessoryCell('Int. Ins', 'Internal insulation (fiberglass lined)', row.internalInsulation || false, result?.internalInsulationCost, 'internalInsulation', 'bg-purple-50 text-purple-700 border-purple-200', 'hover:bg-purple-100')}
      {accessoryCell('Flex', 'Flex duct connection', row.flexDuct || false, result?.flexDuctCost, 'flexDuct', 'bg-orange-50 text-orange-700 border-orange-200', 'hover:bg-orange-100')}
      {accessoryCell('VD', 'Volume damper', row.vd || false, result?.vdCost, 'vd', 'bg-green-50 text-green-700 border-green-200', 'hover:bg-green-100')}
      {accessoryCell('OT', 'Offtake connection', row.offtake || false, result?.offtakeCost, 'offtake', 'bg-red-50 text-red-700 border-red-200', 'hover:bg-red-100')}

      {/* Delete */}
      <td className="px-3 py-2">
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition-colors p-1"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}
