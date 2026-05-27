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
import React, { useMemo, useState } from 'react';
import { RotateCcw, Tag } from 'lucide-react';
import {
  DEFAULT_UNIT_PRICING_TABLES,
  mergeUnitPricingTables,
  lookupByTons,
} from '@utils/unitScheduleCalculations';

const REF_TONS = 5; // tonnage used to display "default at X tons"

function refPrice(table) {
  if (!Array.isArray(table)) return Number(table) || 0;
  return lookupByTons(table, REF_TONS);
}

// ── Section / accessory definitions ─────────────────────────────────────────

const buildSections = (tables) => [
  {
    key:   'packaged',
    label: 'Packaged RTU',
    color: 'purple',
    accessories: [
      { key: 'standardCurb',  label: 'Standard Curb',   table: tables.packaged.accessories.standardCurb,  byTon: true },
      { key: 'metalRoofCurb', label: 'Metal Roof Curb', table: tables.packaged.accessories.metalRoofCurb, byTon: true },
      { key: 'curbAdapter',   label: 'Curb Adapter',    table: tables.packaged.accessories.curbAdapter,   byTon: true },
      { key: 'economizer',    label: 'Economizer',      table: tables.packaged.accessories.economizer,    byTon: true },
      { key: 'newDrops',      label: 'New Drops',       table: tables.packaged.accessories.newDrops,      byTon: true },
      { key: 'drumLouvers',   label: 'Drum Louvers',    table: tables.packaged.accessories.drumLouvers,   byTon: true },
      { key: 'pvcCond',       label: 'PVC Condensate',  table: tables.packaged.accessories.pvcCond },
      { key: 'cuCond',        label: 'CU Condensate',   table: tables.packaged.accessories.cuCond },
      { key: 'thermostat',    label: 'Thermostat',      table: tables.packaged.accessories.thermostat },
      { key: 'statWire',      label: 'Stat Wire',       table: tables.packaged.accessories.statWire },
      { key: 'smokeDetector', label: 'Smoke Detector',  table: tables.packaged.accessories.smokeDetector },
      { key: 'sensors',       label: 'Sensor (each)',   table: tables.packaged.accessories.sensors },
    ],
  },
  {
    key:   'split',
    label: 'Standard Split',
    color: 'green',
    accessories: [
      { key: 'condenserRails',  label: 'Condenser Rails',   table: tables.split.accessories.condenserRails,  byTon: true },
      { key: 'drainPan',        label: 'Drain Pan',         table: tables.split.accessories.drainPan,        byTon: true },
      { key: 'cuLineUnder100',  label: 'CU Line <100 ft',   table: tables.split.accessories.cuLineUnder100,  byTon: true },
      { key: 'cuLineOver100',   label: 'CU Line >100 ft',   table: tables.split.accessories.cuLineOver100,   byTon: true },
      { key: 'cuRollUnder100',  label: 'CU Roll <100 ft',   table: tables.split.accessories.cuRollUnder100,  byTon: true },
      { key: 'cuRollOver100',   label: 'CU Roll >100 ft',   table: tables.split.accessories.cuRollOver100,   byTon: true },
      { key: 'oaDamper',        label: 'OA Damper',         table: tables.split.accessories.oaDamper,        byTon: true },
      { key: 'ductTransitions', label: 'Duct Transitions',  table: tables.split.accessories.ductTransitions, byTon: true },
      { key: 'floatSwitch',     label: 'Float Switch',      table: tables.split.accessories.floatSwitch },
      { key: 'pvcCond',         label: 'PVC Condensate',    table: tables.split.accessories.pvcCond },
      { key: 'cuCond',          label: 'CU Condensate',     table: tables.split.accessories.cuCond },
      { key: 'thermostat',      label: 'Thermostat',        table: tables.split.accessories.thermostat },
      { key: 'statWire',        label: 'Stat Wire',         table: tables.split.accessories.statWire },
      { key: 'smokeDetector',   label: 'Smoke Detector',    table: tables.split.accessories.smokeDetector },
      { key: 'sensors',         label: 'Sensor (each)',     table: tables.split.accessories.sensors },
    ],
  },
  {
    key:   'wallMount',
    label: 'Wall Mount',
    color: 'orange',
    accessories: [
      { key: 'condenserRails', label: 'Condenser Rails', table: tables.wallMount.accessories.condenserRails, byTon: true },
      { key: 'condPump',       label: 'Condensate Pump', table: tables.wallMount.accessories.condPump,       byTon: true },
      { key: 'cuUnder100',     label: 'CU Line <100 ft', table: tables.wallMount.accessories.cuUnder100,     byTon: true },
      { key: 'cuOver100',      label: 'CU Line >100 ft', table: tables.wallMount.accessories.cuOver100,      byTon: true },
      { key: 'pvcCond',        label: 'PVC Condensate',  table: tables.wallMount.accessories.pvcCond },
      { key: 'cuCond',         label: 'CU Condensate',   table: tables.wallMount.accessories.cuCond },
      { key: 'thermostat',     label: 'Thermostat',      table: tables.wallMount.accessories.thermostat },
      { key: 'statWire',       label: 'Stat Wire',       table: tables.wallMount.accessories.statWire },
    ],
  },
  {
    key:   'vrf',
    label: 'VRF System',
    color: 'red',
    accessories: [
      { key: 'condenserRails',    label: 'Condenser Rails',         table: tables.vrf.accessories.condenserRails,    byTon: true },
      { key: 'drainPan',          label: 'Drain Pan',               table: tables.vrf.accessories.drainPan,          byTon: true },
      { key: 'cuLineRatePerFt',   label: 'CU Line Rate ($/ft)',     table: tables.vrf.accessories.cuLineRatePerFt,   byTon: true, unit: '/ft' },
      { key: 'refrigChargePerTon',label: 'Refrigerant ($/ton)',     table: tables.vrf.accessories.refrigChargePerTon, unit: '/ton' },
      { key: 'pvcCond',           label: 'PVC Condensate',          table: tables.vrf.accessories.pvcCond },
      { key: 'cuCond',            label: 'CU Condensate',           table: tables.vrf.accessories.cuCond },
      { key: 'thermostat',        label: 'Thermostat',              table: tables.vrf.accessories.thermostat },
      { key: 'statWire',          label: 'Stat Wire',               table: tables.vrf.accessories.statWire },
      { key: 'smokeDetector',     label: 'Smoke Detector',          table: tables.vrf.accessories.smokeDetector },
      { key: 'sensors',           label: 'Sensor (each)',           table: tables.vrf.accessories.sensors },
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

export default function AccessoryPriceSettings({ overrides, pricingTables = null, onSet, onReset, onResetAll, onClose = null, standalone = false }) {
  const [activeTab, setActiveTab] = useState('packaged');

  const resolvedTables = useMemo(
    () => mergeUnitPricingTables(pricingTables || DEFAULT_UNIT_PRICING_TABLES),
    [pricingTables]
  );
  const sections = useMemo(() => buildSections(resolvedTables), [resolvedTables]);
  const section = sections.find(s => s.key === activeTab);
  const colors  = TAB_COLORS[section?.color] || TAB_COLORS.purple;

  // Count active overrides per section
  const overrideCount = (key) =>
    Object.values(overrides[key] || {}).filter(v => v != null && v !== '').length;

  const wrapperCls = standalone
    ? ''   // Settings page: no extra card wrapper, rendered inside a card already
    : 'card p-4 mb-4 border-amber-200 bg-amber-50/30';

  return (
    <div className={wrapperCls}>
      {/* Panel header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          {!standalone && <h3 className="font-semibold text-gray-700 text-sm">Accessory Material Prices</h3>}
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
          {onClose && (
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 ml-2">
              Close
            </button>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-3">
        {sections.map(s => {
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
