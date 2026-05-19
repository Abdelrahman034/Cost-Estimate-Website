/**
 * WallMountRow — one unit in the "Wall Mounted Split Systems" section.
 * Maps to: wall_mount_unit_schedule table (future DB)
 *
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/wall-mount/{id}
 */
import React from 'react';
import {
  RowWrapper, TextInput, NumInput, Select, ResultBadge,
  AccordionPanel, AccessoryGrid, AccessoryItem,
} from './shared';

const OWNER_OPTIONS = [
  { value: '',   label: 'We provide' },
  { value: 'xx', label: 'Owner provides (xx)' },
];

export default function WallMountRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const ch  = (field) => (value) => onChange(row.id, field, value);
  const acc = (key)   => (value) => onChange(row.id, `accessories.${key}`, value);

  const hasTons = Number(row.coolTons) > 0;

  return (
    <RowWrapper index={index} onRemove={onRemove} onDuplicate={onDuplicate}>
      {/* Main inputs */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">Unit Name / Tag</label>
          <TextInput value={row.name} onChange={ch('name')} placeholder="e.g. MITU-1" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Cooling (Tons)</label>
          <NumInput value={row.coolTons} onChange={ch('coolTons')} placeholder="0" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Owner Provided</label>
          <Select value={row.ownerProvided} onChange={ch('ownerProvided')} options={OWNER_OPTIONS} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Base ($/ton)</label>
          <NumInput value={row.baseCostPerTon} onChange={ch('baseCostPerTon')} prefix="$" />
        </div>
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">Supplier Quote ($)</label>
          <NumInput
            value={row.quotedEquipCost == null ? '' : row.quotedEquipCost}
            onChange={(v) => onChange(row.id, 'quotedEquipCost', v === 0 ? null : v)}
            prefix="$" placeholder="optional"
          />
        </div>
      </div>

      {/* Accessories */}
      <AccordionPanel
        title="Accessories & Options  (x = supply+install, xx = install only)"
        badge={hasTons ? result.accMaterial : null}
      >
        <AccessoryGrid>
          <AccessoryItem label="Condenser Rails"    selValue={row.accessories.condenserRails} onChange={acc('condenserRails')} />
          <AccessoryItem label="Condensate Pump"    selValue={row.accessories.condPump}       onChange={acc('condPump')} />
          <AccessoryItem label="CU Line  (<100 ft)" selValue={row.accessories.cuUnder100}     onChange={acc('cuUnder100')} />
          <AccessoryItem label="CU Line  (≥100 ft)" selValue={row.accessories.cuOver100}      onChange={acc('cuOver100')} />
          <AccessoryItem label="PVC Condensate"     selValue={row.accessories.pvcCond}        onChange={acc('pvcCond')} />
          <AccessoryItem label="CU Condensate"      selValue={row.accessories.cuCond}         onChange={acc('cuCond')} />
          <AccessoryItem label="Thermostat"         selValue={row.accessories.thermostat}     onChange={acc('thermostat')} />
        </AccessoryGrid>
      </AccordionPanel>

      {/* Results */}
      {hasTons && (
        <div className="flex flex-wrap gap-2 px-1 pb-1">
          <ResultBadge label="Equip. Cost"    value={result.equipCost}     variant="default" />
          <ResultBadge label="Accessories"    value={result.accMaterial}   variant="material" />
          <ResultBadge label="Misc (3%)"      value={result.miscCost}      variant="default" />
          <ResultBadge label="Total Material" value={result.totalMaterial} variant="material" />
          <ResultBadge label="Total Labor"    value={result.totalLabor}    variant="labor" />
          <ResultBadge label="Unit Total"     value={result.totalCost}     variant="total" />
        </div>
      )}
    </RowWrapper>
  );
}
