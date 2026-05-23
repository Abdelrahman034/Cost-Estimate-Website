/**
 * LouverDamperRow — one item in the "Louvers & Dampers" section.
 * Sized by face area (width × height in inches → sq ft).
 * Quantity field multiplies the per-unit cost.
 *
 * Types covered: OA/Supply/Return/Relief/Fixed Louvers + Fire/Smoke/FSD/Volume/Backdraft Dampers
 *
 * Maps to: louver_damper_schedule table (future DB)
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/louvers/{id}
 */
import React from 'react';
import { LOUVER_DAMPER_TYPES } from '@utils/unitScheduleCalculations';
import {
  RowWrapper, TextInput, NumInput, Select, ResultBadge,
  AccordionPanel, AccessoryGrid, AccessoryItem,
} from './shared';

const OWNER_OPTIONS = [
  { value: '',   label: 'We provide' },
  { value: 'xx', label: 'Owner provides (xx)' },
];

const TYPE_OPTIONS = LOUVER_DAMPER_TYPES.map(t => ({ value: t, label: t }));

// Which types have an actuator accessory (motorized dampers)
const MOTORIZED_TYPES = new Set([
  'Fire Damper', 'Smoke Damper', 'Combination FSD', 'Volume Damper',
]);

export default function LouverDamperRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const ch  = (field) => (value) => onChange(row.id, field, value);
  const acc = (key)   => (value) => onChange(row.id, `accessories.${key}`, value);

  const hasSizing  = Number(row.widthIn) > 0 && Number(row.heightIn) > 0;
  const faceArea   = result?.faceArea ?? 0;
  const isMotorized = MOTORIZED_TYPES.has(row.type);

  return (
    <RowWrapper index={index} onRemove={onRemove} onDuplicate={onDuplicate}>
      {/* Main inputs */}
      <div className="grid grid-cols-12 gap-2 items-end">
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Tag / Name</label>
          <TextInput value={row.name} onChange={ch('name')} placeholder="e.g. OAL-1" />
        </div>
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">Type</label>
          <Select value={row.type} onChange={ch('type')} options={TYPE_OPTIONS} />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">W (in)</label>
          <NumInput value={row.widthIn} onChange={ch('widthIn')} placeholder="24" />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">H (in)</label>
          <NumInput value={row.heightIn} onChange={ch('heightIn')} placeholder="24" />
        </div>
        {/* Face area display — read-only computed */}
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">Area (sqft)</label>
          <div className="w-full border border-gray-100 bg-gray-50 rounded px-2 py-1.5 text-sm text-gray-500 text-center">
            {hasSizing ? faceArea.toFixed(2) : '—'}
          </div>
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">Qty</label>
          <NumInput value={row.qty} onChange={ch('qty')} placeholder="1" />
        </div>
        <div className="col-span-1">
          <label className="text-xs text-gray-400 mb-1 block">Owner</label>
          <Select value={row.ownerProvided} onChange={ch('ownerProvided')} options={OWNER_OPTIONS} />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Unit Price ($) <span className="text-gray-300">overrides</span></label>
          <NumInput value={row.unitPrice} onChange={ch('unitPrice')} prefix="$" placeholder="auto" />
        </div>
      </div>

      {/* Accessories */}
      <AccordionPanel
        title="Accessories & Options  (x = supply+install, xx = install only)"
        badge={hasSizing ? result.accMaterial : null}
      >
        <AccessoryGrid>
          <AccessoryItem label="Screen / Guard" selValue={row.accessories.screen}   onChange={acc('screen')} />
          <AccessoryItem label="Sleeve / Frame" selValue={row.accessories.sleeve}   onChange={acc('sleeve')} />
          {isMotorized && (
            <AccessoryItem label="Actuator (motor)" selValue={row.accessories.actuator} onChange={acc('actuator')} />
          )}
        </AccessoryGrid>
      </AccordionPanel>

      {/* Results */}
      {hasSizing && (
        <div className="flex flex-wrap gap-2 px-1 pb-1">
          <ResultBadge label={`Unit Matl (×${row.qty || 1})`} value={result.unitMat * (Number(row.qty) || 1)} variant="default" />
          <ResultBadge label="Accessories"                     value={result.accMaterial}                     variant="material" />
          <ResultBadge label="Misc (3%)"                       value={result.miscCost}                        variant="default" />
          <ResultBadge label="Total Material"                  value={result.totalMaterial}                   variant="material" />
          <ResultBadge label="Total Labor"                     value={result.totalLabor}                      variant="labor" />
          <ResultBadge label="Labor Hours"                     value={result.totalHours}                      variant="default" />
          <ResultBadge label="Section Total"                   value={result.totalCost}                       variant="total" />
        </div>
      )}
    </RowWrapper>
  );
}
