/**
 * FanRow — one fan in the "Fans" section.
 * Fans are sized by CFM rather than tons; every other calculation pattern is
 * identical to the equipment row components (x/xx accessories, result badges).
 *
 * Maps to: fan_schedule table (future DB)
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/fans/{id}
 */
import React from 'react';
import { FAN_TYPES, FAN_MOUNT_TYPES, FAN_DRIVE_TYPES } from '@utils/unitScheduleCalculations';
import {
  RowWrapper, TextInput, NumInput, Select, ResultBadge,
  AccordionPanel, AccessoryGrid, AccessoryItem,
} from './shared';

const OWNER_OPTIONS = [
  { value: '',   label: 'We provide' },
  { value: 'xx', label: 'Owner provides (xx)' },
];
const TYPE_OPTIONS     = FAN_TYPES.map(t => ({ value: t, label: t }));
const MOUNT_OPTIONS    = FAN_MOUNT_TYPES.map(t => ({ value: t, label: t }));
const DRIVE_OPTIONS    = FAN_DRIVE_TYPES.map(t => ({ value: t, label: t }));

export default function FanRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const ch  = (field) => (value) => onChange(row.id, field, value);
  const acc = (key)   => (value) => onChange(row.id, `accessories.${key}`, value);

  const hasCFM = Number(row.cfm) > 0;

  return (
    <RowWrapper index={index} onRemove={onRemove} onDuplicate={onDuplicate}>
      {/* Main inputs */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Tag / Name</label>
          <TextInput value={row.name} onChange={ch('name')} placeholder="e.g. EF-1" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Fan Type</label>
          <Select value={row.type} onChange={ch('type')} options={TYPE_OPTIONS} />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">CFM</label>
          <NumInput value={row.cfm} onChange={ch('cfm')} placeholder="0" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Mount</label>
          <Select value={row.mount} onChange={ch('mount')} options={MOUNT_OPTIONS} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Drive</label>
          <Select value={row.drive} onChange={ch('drive')} options={DRIVE_OPTIONS} />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">Owner</label>
          <Select value={row.ownerProvided} onChange={ch('ownerProvided')} options={OWNER_OPTIONS} />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">Unit Price</label>
          <NumInput value={row.unitPrice} onChange={ch('unitPrice')} prefix="$" placeholder="auto" />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">Quote ($)</label>
          <NumInput
            value={row.quotedEquipCost == null ? '' : row.quotedEquipCost}
            onChange={(v) => onChange(row.id, 'quotedEquipCost', v === 0 ? null : v)}
            prefix="$" placeholder="opt."
          />
        </div>
      </div>

      {/* Accessories */}
      <AccordionPanel
        title="Accessories & Options  (x = supply+install, xx = install only)"
        badge={hasCFM ? result.accMaterial : null}
      >
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
          <ResultBadge label="Equip. Cost"    value={result.equipCost}     variant="default" />
          <ResultBadge label="Accessories"    value={result.accMaterial}   variant="material" />
          <ResultBadge label="Misc (3%)"      value={result.miscCost}      variant="default" />
          <ResultBadge label="Total Material" value={result.totalMaterial} variant="material" />
          <ResultBadge label="Total Labor"    value={result.totalLabor}    variant="labor" />
          <ResultBadge label="Labor Hours"    value={result.totalHours}    variant="default" />
          <ResultBadge label="Unit Total"     value={result.totalCost}     variant="total" />
        </div>
      )}
    </RowWrapper>
  );
}
