/**
 * PricingTablesEditor.jsx
 *
 * Tabbed editor for all unit schedule pricing tables (service, accessories, labor hours, etc.).
 * Allows admins to view, edit, and save pricing tables to the database.
 * Includes a "Load from Hardcoded" button to seed defaults.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp, RotateCcw, Save, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import {
  SERVICE_PRICING_TABLE,
  PKG_ACCESSORY_TABLES, PKG_LABOR_HOURS,
  SPLIT_ACCESSORY_TABLES, SPLIT_LABOR_HOURS,
  WALL_MOUNT_ACCESSORY_TABLES, WALL_MOUNT_LABOR_HOURS,
  VRF_ACCESSORY_TABLES, VRF_LABOR_HOURS,
  FAN_BASE_PRICE_TABLE, FAN_ACCESSORY_TABLES, FAN_LABOR_HOURS,
  LOUVER_DAMPER_PRICING, LD_ACCESSORIES,
  DEFAULT_UNIT_PRICING_TABLES,
} from '@utils/unitScheduleCalculations';
import toast from 'react-hot-toast';

// Table definitions: path within the pricing tables structure + display name
const TABLE_DEFINITIONS = [
  { path: 'servicePricingTable', name: 'Service Pricing', section: 'Service' },
  { path: 'packaged.accessories', name: 'Packaged Accessories', section: 'Packaged' },
  { path: 'packaged.laborHours', name: 'Packaged Labor Hours', section: 'Packaged' },
  { path: 'split.accessories', name: 'Split Accessories', section: 'Split' },
  { path: 'split.laborHours', name: 'Split Labor Hours', section: 'Split' },
  { path: 'wallMount.accessories', name: 'Wall Mount Accessories', section: 'Wall Mount' },
  { path: 'wallMount.laborHours', name: 'Wall Mount Labor Hours', section: 'Wall Mount' },
  { path: 'vrf.accessories', name: 'VRF Accessories', section: 'VRF' },
  { path: 'vrf.laborHours', name: 'VRF Labor Hours', section: 'VRF' },
  { path: 'fan.basePriceTable', name: 'Fan Base Prices', section: 'Fans' },
  { path: 'fan.accessories', name: 'Fan Accessories', section: 'Fans' },
  { path: 'fan.laborHours', name: 'Fan Labor Hours', section: 'Fans' },
  { path: 'louverDamper.pricing', name: 'Louver/Damper Pricing', section: 'Louver/Damper' },
  { path: 'louverDamper.accessories', name: 'Louver/Damper Accessories', section: 'Louver/Damper' },
];

/**
 * Deep get from object using dot-notation path
 */
function deepGet(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

/**
 * Deep set in object using dot-notation path
 */
function deepSet(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((acc, key) => {
    if (!acc[key]) acc[key] = {};
    return acc[key];
  }, obj);
  target[lastKey] = value;
  return obj;
}

/**
 * Render editable table for an array of [key, value] pairs
 */
function ArrayTableEditor({ data, onChange, isFlat = false }) {
  if (!Array.isArray(data)) {
    return <div className="text-xs text-red-600">Invalid data structure</div>;
  }

  const handleChange = (index, field, value) => {
    const updated = [...data];
    if (field === 'key') {
      updated[index] = [parseFloat(value) || 0, updated[index][1]];
    } else {
      updated[index] = [updated[index][0], parseFloat(value) || 0];
    }
    onChange(updated);
  };

  const addRow = () => {
    onChange([...data, [0, 0]]);
  };

  const removeRow = (index) => {
    onChange(data.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Key</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Value</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 w-8">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={row[0] ?? ''}
                    onChange={e => handleChange(i, 'key', e.target.value)}
                    className="input w-full text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={row[1] ?? ''}
                    onChange={e => handleChange(i, 'value', e.target.value)}
                    className="input w-full text-xs"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => removeRow(i)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="Delete row"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        + Add row
      </button>
    </div>
  );
}

/**
 * Render editable object of key → [value, value...] pairs (like accessory tables)
 */
function ObjectTableEditor({ data, onChange }) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return <div className="text-xs text-red-600">Invalid data structure</div>;
  }

  const handleKeyChange = (oldKey, newKey) => {
    if (oldKey === newKey) return;
    const updated = { ...data };
    if (newKey && newKey !== oldKey) {
      updated[newKey] = updated[oldKey];
      delete updated[oldKey];
    }
    onChange(updated);
  };

  const handleValueChange = (key, value) => {
    onChange({ ...data, [key]: value });
  };

  const addRow = () => {
    const newKey = `new_key_${Date.now()}`;
    onChange({ ...data, [newKey]: 0 });
  };

  const removeKey = (key) => {
    const updated = { ...data };
    delete updated[key];
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <div className="border border-gray-200 rounded overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Key</th>
              <th className="px-3 py-2 text-left font-semibold text-gray-700">Value</th>
              <th className="px-3 py-2 text-center font-semibold text-gray-700 w-8">Delete</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Object.entries(data).map(([key, value]) => (
              <tr key={key} className="hover:bg-gray-50">
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={key}
                    onChange={e => handleKeyChange(key, e.target.value)}
                    className="input w-full text-xs font-mono"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={value ?? ''}
                    onChange={e => handleValueChange(key, parseFloat(e.target.value) || 0)}
                    className="input w-full text-xs"
                  />
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    onClick={() => removeKey(key)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="Delete entry"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
      >
        + Add entry
      </button>
    </div>
  );
}

/**
 * Single table editor section
 */
function TableSection({ definition, tables, onTableChange }) {
  const [expanded, setExpanded] = useState(false);
  const data = deepGet(tables, definition.path);
  const isArray = Array.isArray(data);
  const isObject = typeof data === 'object' && data !== null && !isArray;

  const handleChange = (newData) => {
    const updated = { ...tables };
    deepSet(updated, definition.path, newData);
    onTableChange(updated);
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="text-left">
          <div className="font-semibold text-sm text-gray-800">{definition.name}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {isArray ? `${data.length} rows` : `${Object.keys(data || {}).length} entries`}
          </div>
        </div>
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {expanded && (
        <div className="px-4 py-4 bg-white border-t border-gray-100">
          {isArray && <ArrayTableEditor data={data} onChange={handleChange} />}
          {isObject && <ObjectTableEditor data={data} onChange={handleChange} />}
        </div>
      )}
    </div>
  );
}

/**
 * Main PricingTablesEditor component
 */
export default function PricingTablesEditor({ config, onSave, saving = false }) {
  const [tables, setTables] = useState(() => config?.unitPricingTables || DEFAULT_UNIT_PRICING_TABLES);
  const [showConfirm, setShowConfirm] = useState(false);

  const isDirty = JSON.stringify(tables) !== JSON.stringify(config?.unitPricingTables || DEFAULT_UNIT_PRICING_TABLES);

  const sections = useMemo(() => {
    const grouped = {};
    TABLE_DEFINITIONS.forEach(def => {
      if (!grouped[def.section]) grouped[def.section] = [];
      grouped[def.section].push(def);
    });
    return grouped;
  }, []);

  const loadDefaults = () => {
    if (!window.confirm('Load all pricing tables from hardcoded defaults? This will replace any saved values.')) return;
    setTables(JSON.parse(JSON.stringify(DEFAULT_UNIT_PRICING_TABLES)));
    setShowConfirm(false);
  };

  const handleSave = async () => {
    try {
      await onSave({ unitPricingTables: tables });
      setShowConfirm(false);
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const resetDraft = () => {
    setTables(JSON.parse(JSON.stringify(config?.unitPricingTables || DEFAULT_UNIT_PRICING_TABLES)));
    setShowConfirm(false);
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-1">Pricing Tables Editor</p>
          <p className="text-xs">Edit any pricing table below. Click <strong>Load from Hardcoded</strong> to reset to defaults, then save to persist changes to the database.</p>
        </div>
      </div>

      {/* Control buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={loadDefaults}
          className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded px-3 py-2 font-medium transition-colors"
          title="Load all tables from hardcoded defaults"
        >
          <RefreshCw size={12} />
          Load from Hardcoded
        </button>
        {isDirty && (
          <>
            <button
              onClick={resetDraft}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 font-medium transition-colors"
            >
              <RotateCcw size={12} />
              Discard changes
            </button>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={saving}
              className="ml-auto flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 font-medium transition-colors disabled:opacity-40"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              {saving ? 'Saving...' : 'Save to Database'}
            </button>
          </>
        )}
        {!isDirty && (
          <span className="text-xs text-gray-400">No unsaved changes</span>
        )}
      </div>

      {/* Save confirmation */}
      {showConfirm && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm text-amber-800 mb-3">
            Save all pricing table changes to the database? This will override any previous admin customizations.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-xs px-3 py-2 disabled:opacity-40"
            >
              {saving ? 'Saving...' : 'Confirm & Save'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={saving}
              className="text-xs text-amber-700 hover:text-amber-900 font-medium transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tables organized by section */}
      <div className="space-y-6">
        {Object.entries(sections).map(([sectionName, defs]) => (
          <div key={sectionName}>
            <h3 className="font-semibold text-gray-800 text-sm mb-3">{sectionName}</h3>
            <div className="space-y-2">
              {defs.map(def => (
                <TableSection
                  key={def.path}
                  definition={def}
                  tables={tables}
                  onTableChange={setTables}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
