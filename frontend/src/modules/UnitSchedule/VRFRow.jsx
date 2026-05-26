/**
 * VRFRow — one VRF system in the "VRF Systems" section.
 * VRF is unique: each row represents an entire zone system.
 * cuLineAvgLength (main row input) is the avg length per indoor unit.
 *
 * Maps to: vrf_unit_schedule table (future DB)
 *
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/vrf/{id}
 *
 * Copper pricing wired to POST /api/copper-pricing (equipType='vrv').
 * LME, safety factor, type, insulation come from company copperSettings.
 * cuLineAvgLength feeds the engine as avgLengthFt (× indoorUnits in controller).
 * The CopperInputPanel shows showLengthField=false since length is in main row.
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

export default function VRFRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const { copperSettings } = useContext(SettingsContext);
  const cs = copperSettings ?? DEFAULT_COPPER_SETTINGS;

  const ch  = (field) => (value) => onChange(row.id, field, value);
  const acc = (key)   => (value) => onChange(row.id, `accessories.${key}`, value);

  const hasTons = Number(row.coolTons) > 0;

  const copperType = row.copper?.copperType || 'L';
  const cuLen      = Number(row.cuLineAvgLength) || 0;

  // ── Copper API state ──────────────────────────────────────────────────────
  const [copperResult,  setCopperResult]  = useState(null);
  const [copperLoading, setCopperLoading] = useState(false);
  const debounceRef = useRef(null);

  const shouldCalc = hasTons && cuLen > 0;

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
          equipType:         'vrv',
          tonnage:           Number(row.coolTons),
          // avgLengthFt = per-unit length; controller multiplies by indoorUnits
          avgLengthFt:       cuLen,
          indoorUnits:       Number(row.indoorUnits) || 1,
          copperType,
          includeInsulation: Boolean(row.copper?.includeInsulation),
          lmePrice:          cs.lmeCopperPrice ?? 4.25,
          safetyFactor:      cs.safetyFactors?.vrv ?? 1.15,
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
    row.coolTons, row.cuLineAvgLength, row.indoorUnits,
    row.copper?.copperType, row.copper?.includeInsulation,
    cs.lmeCopperPrice, cs.safetyFactors?.vrv,
  ]);

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
          <label className="text-xs text-gray-400 mb-1 block">Avg CU Line (ft)</label>
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
          <AccessoryItem label="PVC Condensate"   selValue={row.accessories.pvcCond}         onChange={acc('pvcCond')} />
          <AccessoryItem label="CU Condensate"    selValue={row.accessories.cuCond}          onChange={acc('cuCond')} />
          <AccessoryItem label="Thermostat"       selValue={row.accessories.thermostat}      onChange={acc('thermostat')} />
          <AccessoryItem label="Smoke Detectors"  selValue={row.accessories.smokeDetectors}  onChange={acc('smokeDetectors')} />
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
            showLengthField={false}
            equipType="vrv"
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
          <ResultBadge label="Equip. Cost"    value={result.equipCost}       variant="default" />
          {result.cuLineMaterial > 0 && (
            <ResultBadge label="CU Line"      value={result.cuLineMaterial}  variant="material" />
          )}
          {result.refrigCost > 0 && (
            <ResultBadge label="Refrig. Charge" value={result.refrigCost}   variant="material" />
          )}
          <ResultBadge label="Accessories"    value={result.accMaterial}     variant="material" />
          <ResultBadge label={`Misc (${result.miscPct ?? 3}%)`} value={result.miscCost} variant="default" />
          <ResultBadge label="Total Material" value={result.totalMaterial}   variant="material" />
          <ResultBadge label="Total Labor"    value={result.totalLabor}      variant="labor" />
          <ResultBadge label="Labor Hours"    value={result.totalHours}      variant="default" />
          <ResultBadge label="System Total"   value={result.totalCost}       variant="total" />
        </div>
      )}
    </RowWrapper>
  );
}
