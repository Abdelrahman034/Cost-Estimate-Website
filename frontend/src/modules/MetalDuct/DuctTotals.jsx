import React from 'react';
import { DUCT_MATERIAL_OPTIONS } from '@utils/ductCalculations';

// ─── Styling per material ─────────────────────────────────────────────────────
const MAT_STYLE = {
  galvanized:   { header: 'bg-blue-600',   badge: 'bg-blue-100 text-blue-700',   border: 'border-blue-200' },
  blackSteel:   { header: 'bg-gray-700',   badge: 'bg-gray-100 text-gray-700',   border: 'border-gray-300' },
  stainless304: { header: 'bg-yellow-600', badge: 'bg-yellow-100 text-yellow-700', border: 'border-yellow-200' },
  stainless316: { header: 'bg-orange-600', badge: 'bg-orange-100 text-orange-700', border: 'border-orange-200' },
  aluminum:     { header: 'bg-purple-600', badge: 'bg-purple-100 text-purple-700', border: 'border-purple-200' },
};

// ─── Shared sub-components ────────────────────────────────────────────────────
function Row({ label, value, color = 'text-gray-900', indent = false }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className={`text-sm ${indent ? 'pl-4 text-gray-500' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mt-4 mb-1">
      {children}
    </div>
  );
}

// ─── Single material summary card ─────────────────────────────────────────────
function MaterialCard({ matKey, label, t }) {
  const style = MAT_STYLE[matKey] ?? MAT_STYLE.galvanized;
  const fmt   = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtn  = (n, unit = '') => `${Number(n || 0).toLocaleString()}${unit ? ' ' + unit : ''}`;

  const hasIns    = (t.insulationCost || 0) > 0;
  const hasIntIns = (t.internalInsulationCost || 0) > 0;
  const hasFlex   = (t.flexDuctCost || 0) > 0;
  const hasVD     = (t.vdCost || 0) > 0;
  const hasOT     = (t.offtakeCost || 0) > 0;

  return (
    <div className={`card p-0 overflow-hidden border ${style.border}`}>
      {/* Header */}
      <div className={`${style.header} px-4 py-2.5 flex items-center justify-between`}>
        <span className="text-white font-semibold text-sm">{label}</span>
        <span className="text-white text-sm font-bold">{fmt(t.totalCost)}</span>
      </div>

      <div className="px-4 py-3 space-y-0">
        {/* Physical */}
        <Row label="Linear Feet"   value={fmtn(t.linearFeet,  'LF')} />
        <Row label="Surface Area"  value={fmtn(t.surfaceArea, 'sq ft')} />
        <Row label="Weight"        value={fmtn(t.weight,      'lbs')} />
        <Row label="Labor Hours"   value={fmtn(t.laborHours,  'hrs')} color="text-blue-600" />

        {/* Material */}
        <SectionLabel>Material</SectionLabel>
        <Row label="Sheet Metal (duct)"   value={fmt(t.ductMaterialCost)}  color="text-green-700" />
        {hasIns    && <Row label="Insulation (duct wrap)"  value={fmt(t.insulationCost)}         color="text-green-600" indent />}
        {hasIntIns && <Row label="Internal Insulation"     value={fmt(t.internalInsulationCost)} color="text-green-600" indent />}
        {hasFlex   && <Row label="Flex Duct"               value={fmt(t.flexDuctCost)}           color="text-orange-600" indent />}
        {hasVD     && <Row label="Volume Dampers"          value={fmt(t.vdCost)}                 color="text-green-600" indent />}
        <Row label="Incidentals" value={fmt(t.incidentalsCost)} color="text-green-500" indent />
        <div className="flex justify-between items-center py-1.5 border-b border-gray-200">
          <span className="text-sm font-semibold text-gray-700">Total Material</span>
          <span className="text-sm font-bold text-green-700">{fmt(t.materialCost)}</span>
        </div>

        {/* Labor */}
        <SectionLabel>Labor</SectionLabel>
        <Row label="Install &amp; Sheet Metal Labor" value={fmt(t.laborCost)} color="text-blue-600" />
        {hasIns && <Row label="incl. Insulation Wrap Labor" value={fmt(t.insulationLaborCost || 0)} color="text-blue-400" indent />}
        {hasOT  && <Row label="incl. Offtake Labor"         value={fmt(t.offtakeCost || 0)}         color="text-red-400"  indent />}
      </div>
    </div>
  );
}

// ─── Grand total strip ────────────────────────────────────────────────────────
function GrandTotal({ totals }) {
  const fmt  = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtn = (n, unit = '') => `${Number(n || 0).toLocaleString()}${unit ? ' ' + unit : ''}`;

  return (
    <div className="card border border-gray-300 bg-gray-50">
      <h3 className="section-title mb-3">Combined Grand Total</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'Total Linear Feet',  value: fmtn(totals.linearFeet,  'LF')    },
          { label: 'Total Surface Area', value: fmtn(totals.surfaceArea, 'sq ft') },
          { label: 'Total Weight',       value: fmtn(totals.weight,      'lbs')   },
          { label: 'Total Labor Hours',  value: fmtn(totals.laborHours,  'hrs'), color: 'text-blue-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center bg-white rounded-xl border border-gray-200 px-3 py-2">
            <div className="text-xs text-gray-500 mb-0.5">{label}</div>
            <div className={`text-sm font-bold ${color || 'text-gray-800'}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <div className="space-y-1">
          <div className="flex gap-8">
            <span className="text-sm text-gray-600">Total Material</span>
            <span className="text-sm font-semibold text-green-700">{fmt(totals.materialCost)}</span>
          </div>
          <div className="flex gap-8">
            <span className="text-sm text-gray-600">Total Labor</span>
            <span className="text-sm font-semibold text-blue-700">{fmt(totals.laborCost)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 mb-0.5">Total Direct Cost</div>
          <div className="text-2xl font-bold text-gray-900">{fmt(totals.totalCost)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function DuctTotals({ totals, byMaterial = {} }) {
  // Render material cards in the canonical DUCT_MATERIAL_OPTIONS order
  const activeGroups = DUCT_MATERIAL_OPTIONS.filter((m) => byMaterial[m.value]);
  const multiMaterial = activeGroups.length > 1;

  return (
    <div className="mt-6 space-y-4">
      {/* Per-material cards */}
      {multiMaterial && (
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
          Cost by Material
        </h3>
      )}
      <div className={multiMaterial ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : ''}>
        {activeGroups.map((m) => (
          <MaterialCard
            key={m.value}
            matKey={m.value}
            label={m.label}
            t={byMaterial[m.value]}
          />
        ))}
      </div>

      {/* Grand total — always shown; full-width combined strip */}
      {multiMaterial
        ? <GrandTotal totals={totals} />
        : (
          // Single material — just add the Total Direct Cost line to the bottom of the card
          <div className="card border border-gray-200 flex justify-between items-center py-2">
            <span className="font-bold text-gray-900">Total Direct Cost</span>
            <span className="text-xl font-bold text-gray-900">
              ${Number(totals.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        )
      }
    </div>
  );
}
