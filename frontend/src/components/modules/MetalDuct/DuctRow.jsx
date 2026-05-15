import React from 'react';
import { Trash2 } from 'lucide-react';
import { selectGauge, getMaxDimension, calculateSurfaceArea, detectShape } from '../../../utils/ductCalculations';

export default function DuctRow({ row, result, index, onChange, onRemove, sizePresets = [] }) {
  const maxDim = getMaxDimension(row.size);
  const gauge = row.size ? selectGauge(maxDim) : null;
  const shape = row.size ? detectShape(row.size) : null;
  const previewArea = row.size && row.linearFeet
    ? calculateSurfaceArea(row.size, row.linearFeet).toFixed(1)
    : null;

  const bg = index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
  const hasResult = !!result;

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

      {/* Linear Feet */}
      <td className="px-3 py-2">
        <input
          className="input text-xs"
          type="number"
          min="0"
          placeholder="0"
          value={row.linearFeet}
          onChange={(e) => onChange(row.id, 'linearFeet', e.target.value)}
        />
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
          <div>
            <div className="font-semibold">{result.surfaceAreaWithWaste}</div>
            <div className="text-gray-400">+10% waste</div>
          </div>
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

      {/* Options: External Insulation */}
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          title="External duct wrap"
          className="w-4 h-4 text-blue-600 rounded cursor-pointer"
          checked={row.insulated}
          onChange={(e) => onChange(row.id, 'insulated', e.target.checked)}
        />
      </td>

      {/* Options: Internal Insulation */}
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          title="Internal insulation (fiberglass lined)"
          className="w-4 h-4 text-purple-600 rounded cursor-pointer"
          checked={row.internalInsulation || false}
          onChange={(e) => onChange(row.id, 'internalInsulation', e.target.checked)}
        />
      </td>

      {/* Options: Flex Duct */}
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          title="Flex duct connection"
          className="w-4 h-4 text-orange-600 rounded cursor-pointer"
          checked={row.flexDuct || false}
          onChange={(e) => onChange(row.id, 'flexDuct', e.target.checked)}
        />
      </td>

      {/* Options: VD (Volume Damper) */}
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          title="Volume damper"
          className="w-4 h-4 text-green-600 rounded cursor-pointer"
          checked={row.vd || false}
          onChange={(e) => onChange(row.id, 'vd', e.target.checked)}
        />
      </td>

      {/* Options: Offtake */}
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          title="Offtake connection"
          className="w-4 h-4 text-red-600 rounded cursor-pointer"
          checked={row.offtake || false}
          onChange={(e) => onChange(row.id, 'offtake', e.target.checked)}
        />
      </td>

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
