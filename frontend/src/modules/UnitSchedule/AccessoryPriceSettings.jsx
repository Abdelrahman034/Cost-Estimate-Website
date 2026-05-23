/**
 * AccessoryPriceSettings.jsx
 *
 * Tabbed settings panel that lets users override accessory material prices
 * per unit type.  An empty/blank field means "use the default table value".
 *
 * Each accessory shows:
 *   • Label
 *   • Default price at 5-ton reference (or flat rate)
 *   • "Table" badge when price is tonnage-dependent
 *   • Editable override input
 *   • × reset button
 */
import React, { useState } from 'react';
import { RotateCcw, Tag } from 'lucide-react';
import {
  PKG_ACCESSORY_TABLES,
  SPLIT_ACCESSORY_TABLES,
  WALL_MOUNT_ACCESSORY_TABLES,
  VRF_ACCESSORY_TABLES,
  lookupByTons,
} from '@utils/unitScheduleCalculations';

const REF_TONS = 5; // tonnage used to display "default at X tons"

function refPrice(table) {
  if (!Array.isArray(table)) return Number(table) || 0;
  return lookupByTons(table, REF_TONS);
}

// ── Section / accessory definitions ─────────────────────────────────────────

const SECTIONS = [
  {
    key:   'packaged',
    label: 'Packaged RTU',
    color: 'purple',
    accessories: [
      { key: 'standardCurb',  label: 'Standard Curb',   table: PKG_ACCESSORY_TABLES.standardCurb,  byTon: true },
      { key: 'metalRoofCurb', label: 'Metal Roof Curb', table: PKG_ACCESSORY_TABLES.metalRoofCurb, byTon: true },
      { key: 'curbAdapter',   label: 'Curb Adapter',    table: PKG_ACCESSORY_TABLES.curbAdapter,   byTon: true },
      { key: 'economizer',    label: 'Economizer',      table: PKG_ACCESSORY_TABLES.economizer,    byTon: true },
      { key: 'newDrops',      label: 'New Drops',       table: PKG_ACCESSORY_TABLES.newDrops,      byTon: true },
      { key: 'drumLouvers',   label: 'Drum Louvers',    table: PKG_ACCESSORY_TABLES.drumLouvers,   byTon: true },
      { key: 'pvcCond',       label: 'PVC Condensate',  table: PKG_ACCESSORY_TABLES.pvcCond },
      { key: 'cuCond',        label: 'CU Condensate',   table: PKG_ACCESSORY_TABLES.cuCond },
      { key: 'thermostat',    label: 'Thermostat',      table: PKG_ACCESSORY_TABLES.thermostat },
      { key: 'statWire',      label: 'Stat Wire',       table: PKG_ACCESSORY_TABLES.statWire },
      { key: 'smokeDetector', label: 'Smoke Detector',  table: PKG_ACCESSORY_TABLES.smokeDetector },
      { key: 'sensors',       label: 'Sensor (each)',   table: PKG_ACCESSORY_TABLES.sensors },
    ],
  },
  {
    key:   'split',
    label: 'Standard Split',
    color: 'green',
    accessories: [
      { key: 'condenserRails',  label: 'Condenser Rails',   table: SPLIT_ACCESSORY_TABLES.condenserRails,  byTon: true },
      { key: 'drainPan',        label: 'Drain Pan',         table: SPLIT_ACCESSORY_TABLES.drainPan,        byTon: true },
      { key: 'cuLineUnder100',  label: 'CU Line <100 ft',   table: SPLIT_ACCESSORY_TABLES.cuLineUnder100,  byTon: true },
      { key: 'cuLineOver100',   label: 'CU Line >100 ft',   table: SPLIT_ACCESSORY_TABLES.cuLineOver100,   byTon: true },
      { key: 'cuRollUnder100',  label: 'CU Roll <100 ft',   table: SPLIT_ACCESSORY_TABLES.cuRollUnder100,  byTon: true },
      { key: 'cuRollOver100',   label: 'CU Roll >100 ft',   table: SPLIT_ACCESSORY_TABLES.cuRollOver100,   byTon: true },
      { key: 'oaDamper',        label: 'OA Damper',         table: SPLIT_ACCESSORY_TABLES.oaDamper,        byTon: true },
      { key: 'ductTransitions', label: 'Duct Transitions',  table: SPLIT_ACCESSORY_TABLES.ductTransitions, byTon: true },
      { key: 'floatSwitch',     label: 'Float Switch',      table: SPLIT_ACCESSORY_TABLES.floatSwitch },
      { key: 'pvcCond',         label: 'PVC Condensate',    table: SPLIT_ACCESSORY_TABLES.pvcCond },
      { key: 'cuCond',          label: 'CU Condensate',     table: SPLIT_ACCESSORY_TABLES.cuCond },
      { key: 'thermostat',      label: 'Thermostat',        table: SPLIT_ACCESSORY_TABLES.thermostat },
      { key: 'statWire',        label: 'Stat Wire',         table: SPLIT_ACCESSORY_TABLES.statWire },
      { key: 'smokeDetector',   label: 'Smoke Detector',    table: SPLIT_ACCESSORY_TABLES.smokeDetector },
      { key: 'sensors',         label: 'Sensor (each)',     table: SPLIT_ACCESSORY_TABLES.sensors },
    ],
  },
  {
    key:   'wallMount',
    label: 'Wall Mount',
    color: 'orange',
    accessories: [
      { key: 'condenserRails', label: 'Condenser Rails', table: WALL_MOUNT_ACCESSORY_TABLES.condenserRails, byTon: true },
      { key: 'condPump',       label: 'Condensate Pump', table: WALL_MOUNT_ACCESSORY_TABLES.condPump,       byTon: true },
      { key: 'cuUnder100',     label: 'CU Line <100 ft', table: WALL_MOUNT_ACCESSORY_TABLES.cuUnder100,     byTon: true },
      { key: 'cuOver100',      label: 'CU Line >100 ft', table: WALL_MOUNT_ACCESSORY_TABLES.cuOver100,      byTon: true },
      { key: 'pvcCond',        label: 'PVC Condensate',  table: WALL_MOUNT_ACCESSORY_TABLES.pvcCond },
      { key: 'cuCond',         label: 'CU Condensate',   table: WALL_MOUNT_ACCESSORY_TABLES.cuCond },
      { key: 'thermostat',     label: 'Thermostat',      table: WALL_MOUNT_ACCESSORY_TABLES.thermostat },
      { key: 'statWire',       label: 'Stat Wire',       table: WALL_MOUNT_ACCESSORY_TABLES.statWire },
    ],
  },
  {
    key:   'vrf',
    label: 'VRF System',
    color: 'red',
    accessories: [
      { key: 'condenserRails',    label: 'Condenser Rails',         table: VRF_ACCESSORY_TABLES.condenserRails,    byTon: true },
      { key: 'drainPan',          label: 'Drain Pan',               table: VRF_ACCESSORY_TABLES.drainPan,          byTon: true },
      { key: 'cuLineRatePerFt',   label: 'CU Line Rate ($/ft)',     table: VRF_ACCESSORY_TABLES.cuLineRatePerFt,   byTon: true, unit: '/ft' },
      { key: 'refrigChargePerTon',label: 'Refrigerant ($/ton)',     table: VRF_ACCESSORY_TABLES.refrigChargePerTon, unit: '/ton' },
      { key: 'pvcCond',           label: 'PVC Condensate',          table: VRF_ACCESSORY_TABLES.pvcCond },
      { key: 'cuCond',            label: 'CU Condensate',           table: VRF_ACCESSORY_TABLES.cuCond },
      { key: 'thermostat',        label: 'Thermostat',              table: VRF_ACCESSORY_TABLES.thermostat },
      { key: 'statWire',          label: 'Stat Wire',               table: VRF_ACCESSORY_TABLES.statWire },
      { key: 'smokeDetector',     label: 'Smoke Detector',          table: VRF_ACCESSORY_TABLES.smokeDetector },
      { key: 'sensors',           label: 'Sensor (each)',           table: VRF_ACCESSORY_TABLES.sensors },
    ],
  },
];

const TAB_COLORS = {
  purple: { tab: 'border-purple-500 text-purple-700 bg-purple-50', badge: 'bg-purple-100 text-purple-600' },
  green:  { tab: 'border-green-500 text-green-700 bg-green-50',   badge: 'bg-green-100 text-green-600' },
  orange: { tab: 'border-orange-500 text-orange-700 bg-orange-50',badge: 'bg-orange-100 text-orange-600' },
  red:    { tab: 'border-red-500 text-red-700 bg-red-50',         badge: 'bg-red-100 text-red-600' },
};

// ── Single accessory row ─────────────────────────────────────────────────────

function AccessoryRow({ acc, sectionKey, overrides, onSet, onReset }) {
  const defaultVal = refPrice(acc.table);
  const override   = overrides[acc.key];
  const hasOverride = override != null && override !== '';

  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-lg ${hasOverride ? 'bg-amber-50 border border-amber-200' : 'hover:bg-gray-50'}`}>
      {/* Label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-medium text-gray-700">{acc.label}</span>
          {acc.byTon && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 font-medium">
              <Tag size={8} /> varies by ton
            </span>
          )}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          Default: ${defaultVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}{acc.unit || ''}{acc.byTon ? ' at 5T' : ''}
        </div>
      </div>

      {/* Override input */}
      <div className="relative w-32 shrink-0">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
        <input
          type="number"
          min="0"
          step="1"
          placeholder={String(Math.round(defaultVal))}
          value={override ?? ''}
          onChange={e => onSet(sectionKey, acc.key, e.target.value)}
          className={`input text-sm pl-5 pr-2 w-full ${hasOverride ? 'border-amber-400 bg-amber-50' : ''}`}
        />
      </div>

      {/* Reset */}
      <button
        onClick={() => onReset(sectionKey, acc.key)}
        disabled={!hasOverride}
        title="Reset to default"
        className={`p-1.5 rounded transition-colors ${hasOverride ? 'text-amber-600 hover:bg-amber-100' : 'text-gray-300 cursor-not-allowed'}`}
      >
        <RotateCcw size={13} />
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function AccessoryPriceSettings({ overrides, onSet, onReset, onResetAll, onClose }) {
  const [activeTab, setActiveTab] = useState('packaged');

  const section = SECTIONS.find(s => s.key === activeTab);
  const colors  = TAB_COLORS[section?.color] || TAB_COLORS.purple;

  // Count active overrides per section
  const overrideCount = (key) =>
    Object.values(overrides[key] || {}).filter(v => v != null && v !== '').length;

  return (
    <div className="card p-4 mb-4 border-amber-200 bg-amber-50/30">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-700 text-sm">Accessory Material Prices</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Override any accessory price (applies as a flat rate for all tonnages).
            Leave blank to use the default tonnage-based table value.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onResetAll}
            className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={11} /> Reset all
          </button>
          <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 ml-2">
            Close
          </button>
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-3">
        {SECTIONS.map(s => {
          const isActive = activeTab === s.key;
          const count    = overrideCount(s.key);
          const c        = TAB_COLORS[s.color];
          return (
            <button
              key={s.key}
              onClick={() => setActiveTab(s.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors
                ${isActive ? `${c.tab} border-b-2` : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              {s.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/70' : c.badge}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Accessory grid */}
      {section && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {section.accessories.map(acc => (
            <AccessoryRow
              key={acc.key}
              acc={acc}
              sectionKey={activeTab}
              overrides={overrides[activeTab] || {}}
              onSet={onSet}
              onReset={onReset}
            />
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
        <strong>Tip:</strong> Table-based accessories show their default at 5 tons.
        Your override applies uniformly at all tonnages — useful when you have a fixed vendor quote.
      </div>
    </div>
  );
}
