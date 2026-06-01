/**
 * BidTypePill — clickable tag that cycles a row through bid categories.
 *
 * Values:  'base' → 'alt1' → 'alt2' → 'alt3' → 'base'
 *
 * Props:
 *   value     'base' | 'alt1' | 'alt2' | 'alt3'
 *   onChange  fn(newValue)
 *   compact   bool  — smaller pill for table cells (default true)
 */
import React from 'react';

export const BID_TYPES = [
  { value: 'base', label: 'Base',  short: 'B',   bg: 'bg-gray-100',   text: 'text-gray-600',  border: 'border-gray-300'  },
  { value: 'alt1', label: 'Alt 1', short: 'A1',  bg: 'bg-blue-50',    text: 'text-blue-700',  border: 'border-blue-300'  },
  { value: 'alt2', label: 'Alt 2', short: 'A2',  bg: 'bg-amber-50',   text: 'text-amber-700', border: 'border-amber-300' },
  { value: 'alt3', label: 'Alt 3', short: 'A3',  bg: 'bg-purple-50',  text: 'text-purple-700',border: 'border-purple-300'},
];

const CYCLE = { base: 'alt1', alt1: 'alt2', alt2: 'alt3', alt3: 'base' };

export function getBidType(value) {
  return BID_TYPES.find(t => t.value === value) ?? BID_TYPES[0];
}

export default function BidTypePill({ value = 'base', onChange, compact = true }) {
  const current = getBidType(value);
  const isBase  = value === 'base';

  return (
    <button
      type="button"
      title={`Bid type: ${current.label} — click to change`}
      onClick={() => onChange(CYCLE[value] ?? 'base')}
      className={`rounded border font-semibold transition-all hover:opacity-80 whitespace-nowrap
        ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'}
        ${current.bg} ${current.text} ${current.border}
        ${isBase ? 'opacity-40 hover:opacity-70' : 'opacity-100'}
      `}
    >
      {compact ? current.short : current.label}
    </button>
  );
}
