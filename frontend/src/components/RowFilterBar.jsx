/**
 * RowFilterBar — shared search/filter bar for estimate module tables.
 *
 * Props:
 *   value       string   current filter text
 *   onChange    fn       called with new text
 *   total       number   total row count (before filter)
 *   filtered    number   row count after filter
 *   placeholder string   optional custom placeholder
 */
import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

export default function RowFilterBar({ value, onChange, total, filtered, placeholder = 'Search rows…' }) {
  const inputRef = useRef(null);
  const active = value.length > 0;
  const hidden = active ? total - filtered : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50/60">
      <div className="relative flex-1 max-w-xs">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-7 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
        />
        {active && (
          <button
            type="button"
            onClick={() => { onChange(''); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {active && (
        <span className="text-xs text-gray-500 shrink-0">
          {filtered === 0
            ? <span className="text-red-500">No matches</span>
            : <><span className="font-semibold text-gray-700">{filtered}</span> of {total}</>
          }
          {hidden > 0 && <span className="ml-1 text-gray-400">({hidden} hidden)</span>}
        </span>
      )}

      {!active && total > 0 && (
        <span className="text-xs text-gray-400 shrink-0">{total} row{total !== 1 ? 's' : ''}</span>
      )}
    </div>
  );
}
