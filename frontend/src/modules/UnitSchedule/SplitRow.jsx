/**
 * SplitRow — one unit in the "Split Systems" section.
 * Maps to: split_unit_schedule table (future DB)
 *
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/split/{id}
 *
 * Copper pricing wired to POST /api/copper-pricing.
 * LME price, safety factor, copper type, and insulation are read from
 * company copperSettings (Settings → Copper tab).
 * Per-row: mode toggle (manual/bracket) + avg length or short/long run.
 */
import React, { useState, useEffect, useRef, useContext } from 'react';
import {
  RowWrapper, TextInput, NumInput, Select, ResultBadge,
  AccordionPanel, AccessoryGrid, AccessoryItem,
} from './shared';
import CopperInputPanel from './CopperInputPanel';
import { copperApi } from '@services/api';
import { SettingsContext, DEFAULT_COPPER_SETTINGS } from '@contexts/SettingsContext';

const OWNER_OPTIONS = [
  { value: '',   label: 'We provide' },
  { value: 'xx', label: 'Owner provides (xx)' },
];

export default function SplitRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const { copperSettings } = useContext(SettingsContext);
  const cs = copperSettings ?? DEFAULT_COPPER_SETTINGS;

  const ch  = (field) => (value) => onChange(row.id, field, value);
  const acc = (key)   => (value) => onChange(row.id, `accessories.${key}`, value);

  const hasTons = Number(row.coolTons) > 0;

  const copperType = row.copper?.copperType || 'L';
  const avgLenFt   = Number(row.copper?.avgLengthFt) || 0;

  // ── Copper API state ──────────────────────────────────────────────────────
  const [copperResult,  setCopperResult]  = useState(null);
  const [copperLoading, setCopperLoading] = useState(false);
  const debounceRef = useRef(null);

  const shouldCalc = hasTons && avgLenFt > 0;

  // Sync cylinder price to row whenever settings change so calc engine sees latest value.
  useEffect(() => {
    onChange(row.id, 'refrigCylinderPrice', cs.refrigCylinderPrice ?? 280);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cs.refrigCylinderPrice]);

  useEffect(() => {
    if (!shouldCalc) { setCopperResult(null); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCopperLoading(true);
      try {
        const { data } = await copperApi.calc({
          mode:              'manual',
          equipType:         'split',
          tonnage:           Number(row.coolTons),
          avgLengthFt:       avgLenFt,
          copperType,
          includeInsulation: Boolean(row.copper?.includeInsulation),
          lmePrice:          cs.lmeCopperPrice ?? 4.25,
          safetyFactor:      cs.safetyFactors?.split ?? 1.10,
        });
        setCopperResult(data);
        onChange(row.id, 'copperPricingResult', data);
      } catch {
        setCopperResult(null);
      } finally {
        setCopperLoading(false);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    row.coolTons,
    row.copper?.copperType, row.copper?.avgLengthFt, row.copper?.includeInsulation,
    cs.lmeCopperPrice, cs.safetyFactors?.split,
  ]);

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
          <AccessoryItem label="OA Damper"            selValue={row.accessories.oaDamper}        onChange={acc('oaDamper')} />
          <AccessoryItem label="Float Switch"         selValue={row.accessories.floatSwitch}     onChange={acc('floatSwitch')} />
          <AccessoryItem label="PVC Condensate"       selValue={row.accessories.pvcCond}         onChange={acc('pvcCond')} />
          <AccessoryItem label="CU Condensate"        selValue={row.accessories.cuCond}          onChange={acc('cuCond')} />
          <AccessoryItem label="Thermostat"           selValue={row.accessories.thermostat}      onChange={acc('thermostat')} />
          <AccessoryItem label="Duct Transitions"     selValue={row.accessories.ductTransitions} onChange={acc('ductTransitions')} />
          <AccessoryItem label="Smoke Detectors"      selValue={row.accessories.smokeDetectors}  onChange={acc('smokeDetectors')} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">CO/Temp Sensors (qty)</label>
            <NumInput value={row.accessories.sensorQty} onChange={acc('sensorQty')} placeholder="0" />
          </div>
        </AccessoryGrid>

        {/* Copper panel — always visible when tonnage is set */}
        {hasTons && (
          <CopperInputPanel
            copper={row.copper || {}}
            onChange={(field, value) => onChange(row.id, `copper.${field}`, value)}
            result={copperResult}
            loading={copperLoading}
            showLengthField={true}
            equipType="split"
          />
        )}

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
          <ResultBadge label="Equip. Cost"                    value={result.equipCost}       variant="default" />
          {result.cuLineMaterial > 0 && (
            <ResultBadge label="CU Line"                      value={result.cuLineMaterial}  variant="material" />
          )}
          {result.refrigCost > 0 && (
            <ResultBadge label="Refrig. Charge"               value={result.refrigCost}      variant="material" />
          )}
          <ResultBadge label="Accessories"                    value={result.accMaterial}     variant="material" />
          <ResultBadge label={`Misc (${result.miscPct ?? 3}%)`} value={result.miscCost}      variant="default" />
          <ResultBadge label="Total Material"                 value={result.totalMaterial}   variant="material" />
          <ResultBadge label="Total Labor"                    value={result.totalLabor}      variant="labor" />
          <ResultBadge label="Labor Hours"                    value={result.totalHours}      variant="default" />
          <ResultBadge label="Unit Total"                     value={result.totalCost}       variant="total" />
        </div>
      )}
    </RowWrapper>
  );
}
