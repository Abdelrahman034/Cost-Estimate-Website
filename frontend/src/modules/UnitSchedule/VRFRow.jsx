/**
 * VRFRow — one VRF system in the "VRF Systems" section.
 * VRF is unique: each row represents an entire zone system, not a single unit.
 * It has condensing units, indoor units, and copper line length as key inputs.
 *
 * Maps to: vrf_unit_schedule table (future DB)
 *
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/vrf/{id}
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

export default function VRFRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const ch  = (field) => (value) => onChange(row.id, field, value);
  const acc = (key)   => (value) => onChange(row.id, `accessories.${key}`, value);

  const hasTons = Number(row.coolTons) > 0;

  return (
    <RowWrapper index={index} onRemove={onRemove} onDuplicate={onDuplicate}>
      {/* Main inputs — two rows for VRF because of extra fields */}
      <div className="grid grid-cols-12 gap-2 items-end mb-2">
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">System Name / Tag</label>
          <TextInput value={row.name} onChange={ch('name')} placeholder="e.g. VRF-1" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Total Cool (Tons)</label>
          <NumInput value={row.coolTons} onChange={ch('coolTons')} placeholder="0" />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">CU Units</label>
          <NumInput value={row.condensingUnits} onChange={ch('condensingUnits')} placeholder="1" />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">IDU Units</label>
          <NumInput value={row.indoorUnits} onChange={ch('indoorUnits')} placeholder="1" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">IDU Avg (Tons)</label>
          <NumInput value={row.indoorCoolAvgTons} onChange={ch('indoorCoolAvgTons')} placeholder="auto" />
        </div>
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">CU Line Avg Len (ft)</label>
          <NumInput value={row.cuLineAvgLength} onChange={ch('cuLineAvgLength')} placeholder="0" />
        </div>
      </div>

      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-3">
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
          <AccessoryItem label="Condenser Rails"  selValue={row.accessories.condenserRails}  onChange={acc('condenserRails')} />
          <AccessoryItem label="Drain Pan"        selValue={row.accessories.drainPan}        onChange={acc('drainPan')} />
          <AccessoryItem label="CU Line"          selValue={row.accessories.cuLine}          onChange={acc('cuLine')} hint="Uses avg length × IDU count" />
          <AccessoryItem label="Refrig. Charge"   selValue={row.accessories.refrigCharge}    onChange={acc('refrigCharge')} />
          <AccessoryItem label="PVC Condensate"   selValue={row.accessories.pvcCond}         onChange={acc('pvcCond')} />
          <AccessoryItem label="CU Condensate"    selValue={row.accessories.cuCond}          onChange={acc('cuCond')} />
          <AccessoryItem label="Thermostat"       selValue={row.accessories.thermostat}      onChange={acc('thermostat')} />
          <AccessoryItem label="Smoke Detectors"  selValue={row.accessories.smokeDetectors}  onChange={acc('smokeDetectors')} />
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
          <ResultBadge label="Labor Hours"    value={result.totalHours}    variant="default" />
          <ResultBadge label="System Total"   value={result.totalCost}     variant="total" />
        </div>
      )}
    </RowWrapper>
  );
}
