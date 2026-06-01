/**
 * FanRow — one fan in the "Fans" section.
 *
 * Excel column mapping (Fan Schedule sheet):
 *   G  = unitPrice        H = otherCost
 *   I  = roof penetration J = wall penetration  → penetrationType field
 *   K  = penetrationCost (auto, $100 roof / $200 wall)
 *   L  = miscCost = (G+H) × 20%  (auto)
 *   M  = totalMaterial = G+H+K+L + accessories
 *   N  = laborInput (manual override)
 *   O  = labor table: fanType + sizeCategory × $25/hr
 *   P  = laborFinal = laborInput > 0 ? laborInput : tableLabor
 *
 * Maps to: fan_schedule table (future DB)
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/fans/{id}
 */
import React from 'react';
import {
  RowWrapper, TextInput, NumInput, Select, ResultBadge,
  AccordionPanel, AccessoryGrid, AccessoryItem, fmt,
} from './shared';

const OWNER_OPTIONS = [
  { value: '',   label: 'We provide' },
  { value: 'xx', label: 'Owner provides (xx)' },
];

// Fan types — matches Excel Fan Schedule Z column exactly
const FAN_TYPE_OPTIONS = [
  { value: 'HVLS (Big Ass)',     label: 'HVLS (Big Ass Fan)' },
  { value: 'Ceiling (Standard)', label: 'Ceiling (Standard)' },
  { value: 'Ceiling Exhaust',    label: 'Ceiling Exhaust' },
  { value: 'Inline Exhaust',     label: 'Inline Exhaust' },
  { value: 'Roof Mounted',       label: 'Roof Mounted' },
  { value: 'Shop Exhaust',       label: 'Shop Exhaust' },
  { value: 'Other',              label: 'Other' },
];

// Size categories — matches Excel Fan Schedule F column (Small/Large/Enormous)
const SIZE_OPTIONS = [
  { value: 'Small',    label: 'Small' },
  { value: 'Large',    label: 'Large' },
  { value: 'Enormous', label: 'Enormous' },
];

// Penetration type — drives K column
const PENETRATION_OPTIONS = [
  { value: '',     label: 'None' },
  { value: 'roof', label: 'Roof ($100)' },
  { value: 'wall', label: 'Wall ($200)' },
];

export default function FanRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const ch  = (field) => (value) => onChange(row.id, field, value);
  const acc = (key)   => (value) => onChange(row.id, `accessories.${key}`, value);

  const hasCFM = Number(row.cfm) > 0;

  return (
    <RowWrapper index={index} onRemove={onRemove} onDuplicate={onDuplicate} row={row} onRowChange={onChange}>
      {/* Row 1 — identity + sizing */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Tag / Name</label>
          <TextInput value={row.name} onChange={ch('name')} placeholder="e.g. EF-1" />
        </div>
        <div className="col-span-2">
          {/* Excel col E — used for labor table lookup */}
          <label className="text-xs text-gray-400 mb-1 block">Fan Type</label>
          <Select value={row.fanType || ''} onChange={ch('fanType')} options={FAN_TYPE_OPTIONS} />
        </div>
        <div className="col-span-1">
          {/* Excel col F — Small / Large / Enormous */}
          <label className="text-xs text-gray-400 mb-1 block">Size</label>
          <Select value={row.sizeCategory || 'Large'} onChange={ch('sizeCategory')} options={SIZE_OPTIONS} />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">CFM</label>
          <NumInput value={row.cfm} onChange={ch('cfm')} placeholder="0" />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">Owner</label>
          <Select value={row.ownerProvided} onChange={ch('ownerProvided')} options={OWNER_OPTIONS} />
        </div>
        <div className="col-span-2">
          {/* Excel col G — unit cost */}
          <label className="text-xs text-gray-400 mb-1 block">Unit Cost ($)</label>
          <NumInput value={row.unitPrice} onChange={ch('unitPrice')} prefix="$" placeholder="auto" />
        </div>
        <div className="col-span-2">
          {/* Excel col H — other cost (free-form extra) */}
          <label className="text-xs text-gray-400 mb-1 block">Other Cost ($)</label>
          <NumInput value={row.otherCost ?? 0} onChange={ch('otherCost')} prefix="$" placeholder="0" />
        </div>
        <div className="col-span-1">
          {/* Excel col I/J — penetration type → K col cost */}
          <label className="text-xs text-gray-400 mb-1 block">Penetration</label>
          <Select value={row.penetrationType || ''} onChange={ch('penetrationType')} options={PENETRATION_OPTIONS} />
        </div>
      </div>

      {/* Row 2 — labor override + accessories */}
      <AccordionPanel
        title="Accessories & Labor Override  (x = supply+install, xx = install only)"
        badge={hasCFM ? result.accMaterial : null}
      >
        {/* Excel col N — manual labor override */}
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-gray-100">
          <span className="text-xs text-gray-500 font-medium">Manual Labor Override ($)</span>
          <div className="w-28">
            <NumInput
              value={row.laborInput ?? 0}
              onChange={ch('laborInput')}
              prefix="$"
              placeholder="0 = use table"
            />
          </div>
          {hasCFM && (
            <span className="text-xs text-gray-400">
              Table labor: {fmt(result.tableLabor)} &nbsp;•&nbsp; {row.fanType || '–'} / {row.sizeCategory || 'Large'}
            </span>
          )}
        </div>

        <AccessoryGrid>
          <AccessoryItem label="Disconnect Switch" selValue={row.accessories.disconnectSwitch} onChange={acc('disconnectSwitch')} />
          <AccessoryItem label="GFI Outlet"        selValue={row.accessories.gfiOutlet}        onChange={acc('gfiOutlet')} />
          <AccessoryItem label="Backdraft Damper"  selValue={row.accessories.backdraftDamper}  onChange={acc('backdraftDamper')} />
          <AccessoryItem label="Roof Curb / Rails" selValue={row.accessories.curb}             onChange={acc('curb')} />
          <AccessoryItem label="Flex Connection"   selValue={row.accessories.flexConnection}   onChange={acc('flexConnection')} />
          <AccessoryItem label="VFD"               selValue={row.accessories.vfd}              onChange={acc('vfd')} />
          <AccessoryItem label="Bird Screen"       selValue={row.accessories.birdScreen}       onChange={acc('birdScreen')} />
          <AccessoryItem label="Wiring / Connect"  selValue={row.accessories.wiring}           onChange={acc('wiring')} />
        </AccessoryGrid>
      </AccordionPanel>

      {/* Results */}
      {hasCFM && (
        <div className="flex flex-wrap gap-2 px-1 pb-1">
          <ResultBadge label="Equip. Cost"      value={result.equipCost}       variant="default" />
          <ResultBadge label="Penetration"      value={result.penetrationCost} variant="default" />
          <ResultBadge label="Misc (20%)"       value={result.miscCost}        variant="default" />
          <ResultBadge label="Accessories"      value={result.accMaterial}     variant="material" />
          <ResultBadge label="Total Material"   value={result.totalMaterial}   variant="material" />
          <ResultBadge label="Labor (Table)"    value={result.tableLabor}      variant="default" />
          <ResultBadge label="Total Labor"      value={result.totalLabor}      variant="labor" />
          <ResultBadge label="Unit Total"       value={result.totalCost}       variant="total" />
        </div>
      )}
    </RowWrapper>
  );
}
