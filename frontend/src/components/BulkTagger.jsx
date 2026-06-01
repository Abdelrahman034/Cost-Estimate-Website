/**
 * BulkTagger — inline prefix + start-number auto-namer for table rows.
 *
 * Props:
 *   onApply(prefix, startNum)  called when user clicks Apply
 *   placeholder                optional hint for the prefix input
 */
import React, { useState } from 'react';
import { Tag } from 'lucide-react';

export default function BulkTagger({ onApply, placeholder = 'e.g. AHU-' }) {
  const [prefix, setPrefix]   = useState('');
  const [start,  setStart]    = useState(1);
  const [open,   setOpen]     = useState(false);

  const handleApply = () => {
    onApply(prefix, Number(start) || 1);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        title="Bulk auto-name rows"
        className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors font-medium ${
          open
            ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
        }`}
      >
        <Tag size={12} />
        Auto-name
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-3 flex items-end gap-2 min-w-[260px]">
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Prefix</label>
            <input
              autoFocus
              type="text"
              value={prefix}
              onChange={e => setPrefix(e.target.value)}
              placeholder={placeholder}
              className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full"
            />
          </div>
          <div className="flex flex-col gap-1 w-16">
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Start #</label>
            <input
              type="number"
              min="0"
              value={start}
              onChange={e => setStart(e.target.value)}
              className="border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full"
            />
          </div>
          <button
            type="button"
            onClick={handleApply}
            className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors whitespace-nowrap"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
