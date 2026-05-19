/**
 * SplitRow — one unit in the "Split Systems" section.
 * Maps to: split_unit_schedule table (future DB)
 *
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/split/{id}
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

export default function SplitRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const ch  = (field)  => (value) => onChange(row.id, field, value);
  const acc = (key)    => (value) => onChange(row.id, `accessories.${key}`, value);

  const hasTons = Number(row.coolTons) > 0;

  return (
    <RowWrapper index={index} onRemove={onRemove} onDuplicate={onDuplicate}>
      {/* Main inputs */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">Unit Name / Tag</label>
          <TextInput value={row.name} onChange={ch('name')} placeholder="e.g. AC-1" />
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
          <AccessoryItem label="Condenser Rails"      selValue={row.accessories.condenserRails}  onChange={acc('condenserRails')} />
          <AccessoryItem label="Drain Pan"            selValue={row.accessories.drainPan}        onChange={acc('drainPan')} />
          <AccessoryItem label="CU Line  (<100 ft)"   selValue={row.accessories.cuLineUnder100}  onChange={acc('cuLineUnder100')} />
          <AccessoryItem label="CU Line  (≥100 ft)"   selValue={row.accessories.cuLineOver100}   onChange={acc('cuLineOver100')} />
          <AccessoryItem label="CU Roll  (<100 ft)"   selValue={row.accessories.cuRollUnder100}  onChange={acc('cuRollUnder100')} />
          <AccessoryItem label="CU Roll  (≥100 ft)"   selValue={row.accessories.cuRollOver100}   onChange={acc('cuRollOver100')} />
          <AccessoryItem label="OA Damper"            selValue={row.accessories.oaDamper}        onChange={acc('oaDamper')} />
          <AccessoryItem label="Float Switch"         selValue={row.accessories.floatSwitch}     onChange={acc('floatSwitch')} />
          <AccessoryItem label="PVC Condensate"       selValue={row.accessories.pvcCond}         onChange={acc('pvcCond')} />
          <AccessoryItem label="CU Condensate"        selValue={row.accessories.cuCond}          onChange={acc('cuCond')} />
          <AccessoryItem label="Thermostat"           selValue={row.accessories.thermostat}      onChange={acc('thermostat')} />
          <AccessoryItem label="Duct Transitions"     selValue={row.accessories.ductTransitions} onChange={acc('ductTransitions')} />
          <AccessoryItem label="Smoke Detectors"      selValue={row.accessories.smokeDetectors}  onChange={acc('smokeDetectors')} />
          {/* Sensors qty */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">CO/Temp Sensors (qty)</label>
            <NumInput value={row.accessories.sensorQty} onChange={acc('sensorQty')} placeholder="0" />
          </div>
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
