/**
 * Shared UI primitives used by all unit row components.
 * Keeps individual row files lean and consistent.
 */
import React, { useState } from 'react';
import { Trash2, Copy, ChevronDown, ChevronRight } from 'lucide-react';

export const fmt = (n) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// ─── SELECTION BUTTON GROUP (x / xx / none) ───────────────────────────────────
// "x"  = We supply & install (material + labor)
// "xx" = Owner provides, we install (labor only)
// ""   = Not included
export function SelectionBtn({ value, onChange }) {
  return (
    <div className="flex rounded overflow-hidden border border-gray-200 text-xs font-semibold">
      {['', 'x', 'xx'].map((v) => (
        <button
          key={v || 'none'}
          type="button"
          onClick={() => onChange(v)}
          className={`px-2 py-1 transition-colors ${
            value === v
              ? v === 'x'   ? 'bg-green-500 text-white'
              : v === 'xx'  ? 'bg-blue-500 text-white'
              :                'bg-gray-200 text-gray-500'
              : 'bg-white text-gray-400 hover:bg-gray-50'
          }`}
        >
          {v === '' ? '—' : v}
        </button>
      ))}
    </div>
  );
}

// ─── NUMERIC INPUT ────────────────────────────────────────────────────────────
export function NumInput({ value, onChange, placeholder = '0', className = '', prefix = '' }) {
  return (
    <div className="relative">
      {prefix && (
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">{prefix}</span>
      )}
      <input
        type="number"
        value={value || ''}
        onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
        placeholder={placeholder}
        className={`w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${prefix ? 'pl-5' : ''} ${className}`}
      />
    </div>
  );
}

// ─── TEXT INPUT ───────────────────────────────────────────────────────────────
export function TextInput({ value, onChange, placeholder = '', className = '' }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 ${className}`}
    />
  );
}

// ─── SELECT ───────────────────────────────────────────────────────────────────
export function Select({ value, onChange, options, className = '' }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white ${className}`}
    >
      {options.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  );
}

// ─── RESULT BADGE ─────────────────────────────────────────────────────────────
export function ResultBadge({ label, value, variant = 'default' }) {
  const colors = {
    default:  'bg-gray-100 text-gray-700',
    material: 'bg-blue-50 text-blue-700',
    labor:    'bg-green-50 text-green-700',
    total:    'bg-indigo-600 text-white',
  };
  return (
    <div className={`rounded px-2 py-1 text-xs ${colors[variant]}`}>
      <div className="font-normal opacity-70">{label}</div>
      <div className="font-bold text-sm">{fmt(value)}</div>
    </div>
  );
}

// ─── COLLAPSIBLE ACCESSORY PANEL ─────────────────────────────────────────────
export function AccordionPanel({ title, badge, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-gray-100">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors text-left"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
        {badge != null && (
          <span className="ml-auto text-xs text-blue-600 font-semibold">{fmt(badge)}</span>
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 bg-gray-50">{children}</div>
      )}
    </div>
  );
}

// ─── ACCESSORY GRID ───────────────────────────────────────────────────────────
export function AccessoryGrid({ children }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2 pt-2">
      {children}
    </div>
  );
}

// ─── ACCESSORY ITEM ───────────────────────────────────────────────────────────
export function AccessoryItem({ label, selValue, onChange, hint }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <SelectionBtn value={selValue} onChange={onChange} />
      {hint && <span className="text-xs text-gray-400 italic">{hint}</span>}
    </div>
  );
}

// ─── ROW WRAPPER ─────────────────────────────────────────────────────────────
export function RowWrapper({ index, onRemove, onDuplicate, children }) {
  return (
    <div className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
      <div className="flex items-start gap-2 px-4 py-3">
        <span className="text-xs font-semibold text-gray-400 mt-2.5 w-5 shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">{children}</div>
        {/* Action buttons */}
        <div className="flex flex-col gap-1 mt-2 shrink-0">
          <button
            type="button"
            onClick={onDuplicate}
            className="text-gray-300 hover:text-blue-500 transition-colors"
            title="Duplicate row"
          >
            <Copy size={14} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="text-gray-300 hover:text-red-500 transition-colors"
            title="Remove unit"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
