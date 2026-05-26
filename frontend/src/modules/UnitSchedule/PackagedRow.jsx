/**
 * PackagedRow — one unit in the "New Packaged Units" section.
 * Maps to: packaged_unit_schedule table (future DB)
 *
 * Accessory selection legend:
 *   x  = We supply & install (material + labor)
 *   xx = Owner provides, we install only (labor only — no material)
 *   —  = Not included
 *
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/packaged/{id}
 */
import React from 'react';
import {
  RowWrapper, TextInput, NumInput, Select, ResultBadge,
  AccordionPanel, AccessoryGrid, AccessoryItem, SelectionBtn, fmt,
} from './shared';

const OWNER_OPTIONS = [
  { value: '',   label: 'We provide' },
  { value: 'xx', label: 'Owner provides (xx)' },
];

export default function PackagedRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const ch  = (field)   => (value)  => onChange(row.id, field, value);
  const acc = (accKey)  => (value)  => onChange(row.id, `accessories.${accKey}`, value);

  const hasTons = Number(row.coolTons) > 0;

  return (
    <RowWrapper index={index} onRemove={onRemove} onDuplicate={onDuplicate}>
      {/* Main inputs */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">Unit Name / Tag</label>
          <TextInput value={row.name} onChange={ch('name')} placeholder="e.g. RTU-1" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Cooling (Tons)</label>
          <NumInput value={row.coolTons} onChange={ch('coolTons')} placeholder="0" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Owner Provided</label>
          <Select value={row.ownerProvided} onChange={ch('ownerProvided')} options={OWNER_OPTIONS} />
        </div>
        {/* Equipment cost — either $/ton rate OR quoted price */}
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Base ($/ton)</label>
          <NumInput value={row.baseCostPerTon} onChange={ch('baseCostPerTon')} prefix="$" />
        </div>
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">Supplier Quote ($) <span className="text-gray-300">(overrides $/ton)</span></label>
          <NumInput
            value={row.quotedEquipCost == null ? '' : row.quotedEquipCost}
            onChange={(v) => onChange(row.id, 'quotedEquipCost', v === 0 ? null : v)}
            prefix="$"
            placeholder="optional"
          />
        </div>
      </div>

      {/* Accessory accordion */}
      <AccordionPanel
        title="Accessories & Options  (x = we supply/install, xx = owner provides/we install)"
        badge={hasTons ? result.accMaterial : null}
      >
        <AccessoryGrid>
          <AccessoryItem label="Standard Curb"    selValue={row.accessories.standardCurb}  onChange={acc('standardCurb')} />
          <AccessoryItem label="Metal Roof Curb"  selValue={row.accessories.metalRoofCurb} onChange={acc('metalRoofCurb')} />
          <AccessoryItem label="Curb Adapter"     selValue={row.accessories.curbAdapter}   onChange={acc('curbAdapter')} />
          <AccessoryItem label="Economizer"       selValue={row.accessories.economizer}    onChange={acc('economizer')} />
          <AccessoryItem label="PVC Condensate"   selValue={row.accessories.pvcCond}       onChange={acc('pvcCond')} />
          <AccessoryItem label="CU Condensate"    selValue={row.accessories.cuCond}        onChange={acc('cuCond')} />
          <AccessoryItem label="Thermostat"       selValue={row.accessories.thermostat}    onChange={acc('thermostat')} />
          <AccessoryItem label="New Drops"        selValue={row.accessories.newDrops}      onChange={acc('newDrops')} />
          <AccessoryItem label="Drum Louvers"     selValue={row.accessories.drumLouvers}   onChange={acc('drumLouvers')} />
          {/* Smoke detectors — qty field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Smoke Detectors (qty)</label>
            <NumInput
              value={row.accessories.smokeDetectors}
              onChange={acc('smokeDetectors')}
              placeholder="0"
            />
          </div>
          {/* Sensors — qty field */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">CO/Temp Sensors (qty)</label>
            <NumInput value={row.accessories.sensorQty} onChange={acc('sensorQty')} placeholder="0" />
          </div>
        </AccessoryGrid>

        {/* Misc & Consumables % — applied to total material */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-500 font-medium">Misc &amp; Consumables</span>
          <div className="w-16">
            <NumInput
              value={row.miscPct ?? 3}
              onChange={(v) => onChange(row.id, 'miscPct', v)}
              placeholder="3"
            />
          </div>
          <span className="text-xs text-gray-400">% of total material</span>
          {hasTons && result.miscCost > 0 && (
            <span className="text-xs text-gray-500 ml-2">
              = {result.miscCost.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}
            </span>
          )}
        </div>
      </AccordionPanel>

      {/* Results */}
      {hasTons && (
        <div className="flex flex-wrap gap-2 px-1 pb-1">
          <ResultBadge label="Equip. Cost"    value={result.equipCost}     variant="default" />
          <ResultBadge label="Accessories"    value={result.accMaterial}   variant="material" />
          <ResultBadge label={`Misc (${result.miscPct ?? 3}%)`} value={result.miscCost} variant="default" />
          <ResultBadge label="Total Material" value={result.totalMaterial} variant="material" />
          <ResultBadge label="Total Labor"    value={result.totalLabor}    variant="labor" />
          <ResultBadge label="Unit Total"     value={result.totalCost}     variant="total" />
        </div>
      )}
    </RowWrapper>
  );
}
