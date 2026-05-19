/**
 * ServiceRow — one unit in the "Service of Existing Units" section.
 * Maps to: unit_service_schedule table (future DB)
 *
 * API_TODO: PATCH /api/estimates/{projectId}/unit-schedule/service/{id}
 */
import React from 'react';
import { SYSTEM_TYPES } from '@utils/unitScheduleCalculations';
import { RowWrapper, TextInput, NumInput, Select, ResultBadge, fmt } from './shared';

const SYSTEM_OPTIONS = Object.values(SYSTEM_TYPES).map(v => ({ value: v, label: v }));

export default function ServiceRow({ row, result, index, onChange, onRemove, onDuplicate }) {
  const ch = (field) => (value) => onChange(row.id, field, value);

  return (
    <RowWrapper index={index} onRemove={onRemove} onDuplicate={onDuplicate}>
      {/* Main inputs row */}
      <div className="grid grid-cols-12 gap-2 items-end">
        {/* Name */}
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">Unit Name / Tag</label>
          <TextInput value={row.name} onChange={ch('name')} placeholder="e.g. AHU-1" />
        </div>
        {/* System Type */}
        <div className="col-span-3">
          <label className="text-xs text-gray-400 mb-1 block">System Type</label>
          <Select value={row.systemType} onChange={ch('systemType')} options={SYSTEM_OPTIONS} />
        </div>
        {/* Cool Tons */}
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">Cool (Tons)</label>
          <NumInput value={row.coolTons} onChange={ch('coolTons')} placeholder="0" />
        </div>
        {/* PM Materials override */}
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">PM Matl. (+$)</label>
          <NumInput value={row.pmMaterials} onChange={ch('pmMaterials')} prefix="$" />
        </div>
        {/* PM Labor override */}
        <div className="col-span-2">
          <label className="text-xs text-gray-400 mb-1 block">PM Labor (+$)</label>
          <NumInput value={row.pmLabor} onChange={ch('pmLabor')} prefix="$" />
        </div>
      </div>

      {/* Results row — only shown when there's tonnage data */}
      {(Number(row.coolTons) > 0 || row.systemType) && (
        <div className="flex flex-wrap gap-2 mt-2">
          <ResultBadge label="Service Matl."  value={result.serviceMaterialCost} variant="material" />
          <ResultBadge label="Service Labor"  value={result.serviceLaborCost}    variant="labor" />
          <ResultBadge label="Total Material" value={result.totalMaterial}       variant="material" />
          <ResultBadge label="Total Labor"    value={result.totalLabor}          variant="labor" />
          <ResultBadge label="Unit Total"     value={result.totalCost}           variant="total" />
        </div>
      )}
    </RowWrapper>
  );
}
