/**
 * ProposalPdfModule.jsx
 *
 * Layout mirrors the Mercury Control Inc. Word proposal format:
 *   1.  Project title + address
 *   2.  Bid Summary  (Base · Tax · Bid+Tax)
 *   3.  Scope of Work
 *   4.  Equipment and Systems Provided
 *   5.  Additional HVAC Equipment
 *   6.  Ductwork Installation
 *   7.  Services Included
 *   8.  Relevant Experience
 *   9.  Conclusion
 *   10. Contact / Signature block
 *
 * All text fields are click-to-edit. Lists support add / remove per item.
 * Export PDF → browser print → Save as PDF.
 */
import React, { useState, useRef, useCallback, useContext, useEffect } from 'react';
import { FileText, Printer, Edit2, Plus, Trash2, Check, RefreshCw, Zap } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { readAllModuleTotals } from '@utils/projectTotals';
import { SettingsContext } from '@contexts/SettingsContext';
import { useEstimate } from '@hooks/useEstimate';
import { estimatesApi } from '@services/estimatesApi';
import { ductApi } from '@services/api';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const today = () =>
  new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ─── Print styles ─────────────────────────────────────────────────────────────
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #proposal-print-root, #proposal-print-root * { visibility: visible !important; }
  #proposal-print-root {
    position: fixed !important; top: 0 !important; left: 0 !important;
    width: 100% !important; padding: 1in !important; margin: 0 !important;
    font-family: Cambria, Georgia, serif !important;
    font-size: 13pt !important; line-height: 1.5 !important;
    color: #000 !important; background: white !important;
    box-sizing: border-box !important;
  }
  .no-print { display: none !important; }
  .page-break { page-break-before: always !important; }
  li { margin-bottom: 2pt !important; }
}
`;

// ─── Inline-editable single-line ──────────────────────────────────────────────
function Editable({ value, onChange, tag: Tag = 'span', className = '', placeholder = '…' }) {
  const [editing, setEditing] = useState(false);
  const [local,   setLocal]   = useState(value);
  const commit = () => { onChange(local); setEditing(false); };
  if (editing) {
    return (
      <input autoFocus value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className={`border-b border-blue-400 bg-transparent focus:outline-none w-full ${className}`}
      />
    );
  }
  return (
    <Tag className={`cursor-pointer hover:bg-blue-50 rounded px-0.5 transition-colors ${className}`}
      onClick={() => { setLocal(value); setEditing(true); }} title="Click to edit">
      {value || <span className="text-gray-300 italic">{placeholder}</span>}
    </Tag>
  );
}

// ─── Inline-editable multi-line paragraph ─────────────────────────────────────
function EditablePara({ value, onChange, className = '', placeholder = '…' }) {
  const [editing, setEditing] = useState(false);
  const [local,   setLocal]   = useState(value);
  const commit = () => { onChange(local); setEditing(false); };
  if (editing) {
    return (
      <textarea autoFocus value={local} rows={4}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        className={`border border-blue-300 rounded p-1 w-full focus:outline-none resize-y text-sm ${className}`}
      />
    );
  }
  return (
    <p className={`cursor-pointer hover:bg-blue-50 rounded px-0.5 transition-colors whitespace-pre-wrap ${className}`}
      onClick={() => { setLocal(value); setEditing(true); }} title="Click to edit">
      {value || <span className="text-gray-300 italic">{placeholder}</span>}
    </p>
  );
}

// ─── Editable bullet / numbered list ─────────────────────────────────────────
function EditableList({ items, onChange, ordered = false, itemClassName = '', noAdd = false }) {
  const [editIdx, setEditIdx] = useState(null);
  const [local,   setLocal]   = useState('');

  const commit = (i) => {
    const next = items.map((it, idx) => idx === i ? local : it);
    onChange(next);
    setEditIdx(null);
  };
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add    = ()  => onChange([...items, '']);

  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`pl-6 space-y-0.5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
      {items.map((item, i) => (
        <li key={i} className="group flex items-start gap-1">
          {editIdx === i ? (
            <input autoFocus value={local}
              onChange={e => setLocal(e.target.value)}
              onBlur={() => commit(i)}
              onKeyDown={e => { if (e.key === 'Enter') commit(i); if (e.key === 'Escape') setEditIdx(null); }}
              className="border-b border-blue-400 bg-transparent focus:outline-none flex-1 text-sm"
            />
          ) : (
            <span
              className={`flex-1 cursor-pointer hover:bg-blue-50 rounded px-0.5 transition-colors ${itemClassName}`}
              onClick={() => { setLocal(item); setEditIdx(i); }}
              title="Click to edit"
            >
              {item || <span className="text-gray-300 italic">—</span>}
            </span>
          )}
          <button onClick={() => remove(i)}
            className="no-print opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 ml-1 shrink-0"
            title="Remove">
            <Trash2 size={11} />
          </button>
        </li>
      ))}
      {!noAdd && (
        <li className="no-print list-none pl-0">
          <button onClick={add} className="text-blue-400 hover:text-blue-600 text-xs flex items-center gap-0.5 mt-1">
            <Plus size={11} /> Add item
          </button>
        </li>
      )}
    </Tag>
  );
}

// ─── Editable numbered list with bold label + body ────────────────────────────
function EditableLabelList({ items, onChange }) {
  const update = (i, field, val) =>
    onChange(items.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
  const add    = ()  => onChange([...items, { label: 'Label:', body: '' }]);

  return (
    <ol className="pl-6 list-decimal space-y-1">
      {items.map((item, i) => (
        <li key={i} className="group">
          <span className="font-bold">
            <Editable value={item.label} onChange={v => update(i, 'label', v)} />
          </span>{' '}
          <Editable value={item.body} onChange={v => update(i, 'body', v)} className="text-sm" />
          <button onClick={() => remove(i)}
            className="no-print opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 ml-2 text-xs">
            <Trash2 size={11} />
          </button>
        </li>
      ))}
      <li className="no-print list-none pl-0">
        <button onClick={add} className="text-blue-400 hover:text-blue-600 text-xs flex items-center gap-0.5 mt-1">
          <Plus size={11} /> Add item
        </button>
      </li>
    </ol>
  );
}

// ─── Section heading (bold, same size as body — matches Word doc) ─────────────
function SectionHeading({ children }) {
  return <p className="font-bold mt-5 mb-1">{children}</p>;
}

// ─── Extract equipment lines from Unit Schedule rowsJson ──────────────────────
function buildEquipmentLines(rowsJson) {
  const lines = [];
  const fmtTons = (t) => t ? `${t} Ton` : '';
  const fmtCost = (c) => c ? ` — ${fmt(c)}` : '';

  const accLabels = {
    standardCurb: 'Standard Curb', metalRoofCurb: 'Metal Roof Curb',
    curbAdapter: 'Curb Adapter', economizer: 'Economizer',
    pvcCond: 'PVC Condensate', cuCond: 'Cu Condensate',
    thermostat: 'Thermostat', smokeDetectors: 'Smoke Detectors',
    newDrops: 'New Drops', drumLouvers: 'Drum Louvers',
  };

  const accSummary = (accessories) => {
    if (!accessories) return '';
    const active = Object.entries(accessories)
      .filter(([k, v]) => v && v !== '' && v !== '—' && accLabels[k])
      .map(([k]) => accLabels[k]);
    return active.length ? ` [${active.join(', ')}]` : '';
  };

  // Packaged / RTU rows
  (rowsJson.packagedRows || []).forEach(r => {
    if (!r.name) return;
    const cost  = r.quotedEquipCost || (r.baseCostPerTon * r.coolTons) || 0;
    const owner = r.ownerProvided === 'xx' ? ' (Owner Provided)' : '';
    lines.push(`${r.name} — ${fmtTons(r.coolTons)} RTU${owner}${fmtCost(cost)}${accSummary(r.accessories)}`);
  });

  // Split system rows
  (rowsJson.splitRows || []).forEach(r => {
    if (!r.name) return;
    const cost  = r.quotedEquipCost || 0;
    const owner = r.ownerProvided === 'xx' ? ' (Owner Provided)' : '';
    lines.push(`${r.name} — ${fmtTons(r.coolTons)} Split System${owner}${fmtCost(cost)}`);
  });

  // Wall mount rows
  (rowsJson.wallMountRows || []).forEach(r => {
    if (!r.name) return;
    const cost  = r.quotedEquipCost || 0;
    const owner = r.ownerProvided === 'xx' ? ' (Owner Provided)' : '';
    lines.push(`${r.name} — ${fmtTons(r.coolTons)} Wall Mount${owner}${fmtCost(cost)}`);
  });

  // VRF rows
  (rowsJson.vrfRows || []).forEach(r => {
    if (!r.name) return;
    const cost = r.quotedEquipCost || 0;
    lines.push(`${r.name} — ${fmtTons(r.coolTons)} VRF${fmtCost(cost)}`);
  });

  // Service rows
  (rowsJson.serviceRows || []).forEach(r => {
    if (!r.name) return;
    lines.push(`${r.name} — Service / Repair`);
  });

  return lines;
}

// ─── Build duct schedule summary from calculate API response rows ─────────────
const DUCT_TYPE_LABELS = { supply: 'Supply', return: 'Return', exhaust: 'Exhaust', oa: 'Outside Air' };

function buildDuctSummary(calcRows) {
  const groups = {};
  for (const r of calcRows) {
    const key = r.ductType || 'supply';
    if (!groups[key]) groups[key] = { type: DUCT_TYPE_LABELS[key] || key, lf: 0, area: 0, weight: 0, cost: 0 };
    groups[key].lf     += r.linearFeet    || 0;
    groups[key].area   += r.surfaceArea   || 0;
    groups[key].weight += r.weight        || 0;
    groups[key].cost   += r.totalCost     || 0;
  }
  // Return in canonical order
  return ['supply', 'return', 'exhaust', 'oa']
    .filter(k => groups[k])
    .map(k => ({
      ...groups[k],
      lf:     Math.round(groups[k].lf),
      area:   Math.round(groups[k].area),
      weight: Math.round(groups[k].weight),
      cost:   groups[k].cost,
    }));
}

// ─── The actual proposal document ─────────────────────────────────────────────
function ProposalDoc({ data, onDataChange, summaryTotals }) {
  const ch  = (field) => (val) => onDataChange({ ...data, [field]: val });

  // ── Bid figures — prefer saved Summary module totals, fall back to local calc ──
  const bidBase    = summaryTotals?.bid   ?? (() => {
    const modules  = data.modules.filter(m => m.totalCost > 0 && m.key !== 'SUMMARY');
    const subTotal = modules.reduce((s, m) => s + m.totalCost, 0);
    const overhead = subTotal * (data.overheadPct / 100);
    const profit   = (subTotal + overhead) * (data.profitPct / 100);
    return subTotal + overhead + profit;
  })();
  const tax        = summaryTotals?.tax   ?? (bidBase * (data.taxPct / 100));
  const bidPlusTax = summaryTotals?.total ?? (bidBase + tax);

  return (
    <div
      id="proposal-print-root"
      className="bg-white shadow-lg mx-auto text-gray-900 leading-relaxed"
      style={{ fontFamily: 'Cambria, Georgia, serif', fontSize: '13pt', maxWidth: '8.5in', padding: '1in' }}
    >
      {/* 1. Project title + address */}
      <p style={{ background: '#F7F8FA' }} className="mb-1">
        <Editable value={data.projectName} onChange={ch('projectName')} placeholder="Project Name" />
      </p>
      <p className="mb-4">
        <span className="font-bold">Project Address: </span>
        <span className="font-bold">
          <Editable value={data.projectAddress} onChange={ch('projectAddress')} placeholder="Project Address" />
        </span>
      </p>

      {/* 2. Bid Summary */}
      <SectionHeading>Bid Summary</SectionHeading>
      <ul className="pl-6 list-disc mb-2">
        <li>
          <span className="font-bold">Bid Base: </span>
          <span className="font-bold">{fmt(bidBase)}</span>
          {'        '}
          <span className="font-bold">Tax: </span>
          <span className="font-bold">{fmt(tax)}</span>
          {'        '}
          <span className="font-bold">Bid+Tax: </span>
          <span className="font-bold">{fmt(bidPlusTax)}</span>
        </li>
      </ul>

      {/* 3. Equipment Schedule (auto-extracted from Unit Schedule) */}
      {data.equipmentSchedule?.length > 0 && (
        <>
          <SectionHeading>Equipment Schedule</SectionHeading>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt' }} className="mb-2">
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 'bold', width: '18%' }}>Tag</th>
                <th style={{ textAlign: 'left', padding: '3px 6px', fontWeight: 'bold' }}>Description</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'bold', width: '15%' }}>Price</th>
              </tr>
            </thead>
            <tbody>
              {data.equipmentSchedule.map((line, i) => {
                // Parse "TAG — description — $price [accessories]"
                const priceMatch = line.match(/— (\$[\d,]+)/);
                const accMatch   = line.match(/\[(.+)\]$/);
                const price      = priceMatch ? priceMatch[1] : '—';
                const acc        = accMatch   ? accMatch[1]   : '';
                // Tag is everything before the first ' — '
                const dashIdx    = line.indexOf(' — ');
                const tag        = dashIdx > -1 ? line.slice(0, dashIdx) : line;
                // Description: strip tag, price, accessories
                let desc = dashIdx > -1 ? line.slice(dashIdx + 3) : '';
                if (priceMatch) desc = desc.replace(` — ${priceMatch[1]}`, '');
                if (accMatch)   desc = desc.replace(` [${acc}]`, '');
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '3px 6px', fontWeight: 'bold' }}>{tag}</td>
                    <td style={{ padding: '3px 6px' }}>
                      {desc}
                      {acc && <span style={{ color: '#555', fontSize: '10pt' }}> · {acc}</span>}
                    </td>
                    <td style={{ padding: '3px 6px', textAlign: 'right' }}>{price}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {/* 4. Scope of Work */}
      <SectionHeading>Scope of Work</SectionHeading>
      <EditablePara value={data.scopeIntro} onChange={ch('scopeIntro')} />
      {data.controlsExcluded && (
        <p className="font-bold my-1">Excluding controls</p>
      )}
      <p className="my-1">All work shall be executed in strict accordance with:</p>
      <EditableList items={data.scopeCompliance} onChange={ch('scopeCompliance')} />
      <EditablePara value={data.scopeClosing} onChange={ch('scopeClosing')} className="mt-1" />

      {/* 4. Equipment and Systems Provided */}
      <SectionHeading>Equipment and Systems Provided</SectionHeading>
      <EditableList items={data.equipmentItems} onChange={ch('equipmentItems')} />

      {/* 5. Additional HVAC Equipment */}
      <SectionHeading>Additional HVAC Equipment</SectionHeading>
      <EditableList items={data.additionalEquipment} onChange={ch('additionalEquipment')} />

      {/* 6. Ductwork Installation */}
      <SectionHeading>Ductwork Installation</SectionHeading>
      {data.ductSchedule?.length > 0 && (() => {
        const totLf     = data.ductSchedule.reduce((s, r) => s + r.lf,     0);
        const totArea   = data.ductSchedule.reduce((s, r) => s + r.area,   0);
        const totWeight = data.ductSchedule.reduce((s, r) => s + r.weight, 0);
        const totCost   = data.ductSchedule.reduce((s, r) => s + r.cost,   0);
        return (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11pt', marginBottom: '6px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'left',  padding: '3px 6px', fontWeight: 'bold' }}>Type</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'bold' }}>Lin. Ft</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'bold' }}>Area (sq ft)</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'bold' }}>Weight (lbs)</th>
                <th style={{ textAlign: 'right', padding: '3px 6px', fontWeight: 'bold' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.ductSchedule.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '3px 6px' }}>{r.type}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{r.lf.toLocaleString()}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{r.area.toLocaleString()}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{r.weight.toLocaleString()}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(r.cost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #ccc', fontWeight: 'bold' }}>
                <td style={{ padding: '3px 6px' }}>Total</td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>{totLf.toLocaleString()}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>{totArea.toLocaleString()}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>{totWeight.toLocaleString()}</td>
                <td style={{ padding: '3px 6px', textAlign: 'right' }}>{fmt(totCost)}</td>
              </tr>
            </tfoot>
          </table>
        );
      })()}
      <EditableLabelList items={data.ductworkItems} onChange={ch('ductworkItems')} />

      {/* 7. Services Included */}
      <SectionHeading>Services Included</SectionHeading>
      <EditableList items={data.servicesItems} onChange={ch('servicesItems')} />

      {/* 8. Relevant Experience */}
      <SectionHeading>Relevant Experience</SectionHeading>
      <EditablePara value={data.experienceIntro} onChange={ch('experienceIntro')} />
      <EditableList items={data.experienceItems} onChange={ch('experienceItems')} />

      {/* 9. Conclusion */}
      <SectionHeading>Conclusion</SectionHeading>
      <EditablePara value={data.conclusionP1} onChange={ch('conclusionP1')} />
      <EditablePara value={data.conclusionP2} onChange={ch('conclusionP2')} />
      <EditablePara value={data.conclusionP3} onChange={ch('conclusionP3')} />

      {/* 10. Contact / Signature */}
      <div className="mt-4">
        <p><span className="font-bold">Contact: </span><Editable value={data.contactName}  onChange={ch('contactName')}  placeholder="Full Name" /></p>
        <p><span className="font-bold">Title: </span><Editable   value={data.contactTitle} onChange={ch('contactTitle')} placeholder="HVAC Estimator" /></p>
        <p><span className="font-bold">Email: </span><Editable   value={data.contactEmail} onChange={ch('contactEmail')} placeholder="email@company.com" /></p>
      </div>

      <div className="no-print mt-6 pt-4 border-t border-gray-100 text-center text-xs text-gray-400">
        Click any field to edit · Click any list item to edit · Use + / trash icons to add or remove items
      </div>
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────────────────────
export default function ProposalPdfModule({ projectInfo }) {
  const { companySettings } = useContext(SettingsContext);
  const [searchParams]      = useSearchParams();
  const projectId           = searchParams.get('projectId') || null;
  const [extracting,  setExtracting]  = useState(false);

  const [data, setData] = useState(() => {
    const modules = readAllModuleTotals();
    return {
      // Project
      projectName:    projectInfo?.name     || projectInfo?.projectName || '',
      projectAddress: projectInfo?.location || '',

      // Financials
      overheadPct: 15,
      profitPct:   10,
      taxPct:      8.25,

      // Module totals (for bid calculation)
      modules,

      // Scope of Work
      scopeIntro:      `${companySettings?.companyName || 'Mercury Control Inc.'} is pleased to submit this proposal for the furnishing, installation, and commissioning of a complete HVAC system for the above-referenced project.`,
      controlsExcluded: true,
      scopeCompliance: ['Project specifications', 'Applicable mechanical codes', 'SMACNA standards'],
      scopeClosing:    'Our scope includes providing labor, materials, equipment and supervision necessary to deliver a fully operational HVAC system.',

      // Auto-extracted from Unit Schedule (populated via "Extract Equipment" button)
      equipmentSchedule: [],

      // Auto-extracted from Metal Duct (populated via "Extract Duct" button)
      ductSchedule: [],

      // Equipment — pre-populated; edit to match actual project schedule
      equipmentItems: [
        'Rooftop Package Units (RTUs) — Carrier or equal',
        'Ductless Split Systems — Carrier or equal',
      ],

      // Additional HVAC Equipment
      additionalEquipment: [
        'Grilles, Registers and Diffusers by Titus or equal',
        'Fan Powered VAV Box Units by Carrier or equal',
        'Fans by Loren Cook or equal',
      ],

      // Ductwork Installation
      ductworkItems: [
        { label: 'Sheet Metal Ductwork:', body: 'Supply and install galvanized sheet metal ductwork in accordance with the mechanical drawings.' },
        { label: 'Installation Standards:', body: 'All ductwork shall comply with the latest SMACNA fabrication and installation standards.' },
        { label: 'Insulation:', body: 'Insulation will meet or exceed the latest local energy code requirements.' },
        { label: 'Balancing Dampers:', body: 'Install volume control dampers (VCDs) to ensure proper airflow balancing throughout the system.' },
      ],

      // Services Included
      servicesItems: [
        'Procurement of all listed HVAC equipment',
        'Delivery and handling to site',
        'Installation of all HVAC equipment and accessories',
        'Testing and commissioning of installed systems',
        'Coordination with other trades and site management',
        'Permits',
      ],

      // Relevant Experience
      experienceIntro: 'We bring extensive HVAC project expertise, including:',
      experienceItems: [
        'HVAC installations for educational facilities, such as Odyssey Academy in Webster, TX.',
        'Complex system upgrades for Imperial Multifamily Facilities in Texas.',
        'HVAC system rehabilitations for commercial facilities like Lowe\'s Outlet in Houston, TX.',
      ],

      // Conclusion
      conclusionP1: `${companySettings?.companyName || 'Mercury Control Inc.'} is committed to delivering high-quality HVAC in accordance with the project requirements. We look forward to the opportunity to create a comfortable, energy-efficient, and intelligently controlled environment.`,
      conclusionP2: 'Should you have any questions, require clarifications, or wish to discuss any portion of this proposal in further detail, please do not hesitate to reach out.',
      conclusionP3: 'We look forward to the opportunity to support the successful delivery of the HVAC Scope.',

      // Contact
      contactName:  companySettings?.contactName  || '',
      contactTitle: 'HVAC Estimator',
      contactEmail: companySettings?.companyEmail || '',
    };
  });

  // Extract equipment from saved Unit Schedule estimate
  const extractEquipment = useCallback(async () => {
    if (!projectId) { toast.error('Open a project first to extract equipment.'); return; }
    setExtracting(true);
    try {
      const est = await estimatesApi.getByModule(projectId, 'UNIT_SCHEDULE');
      if (!est?.rowsJson) { toast.error('No Unit Schedule saved for this project yet.'); return; }
      const lines = buildEquipmentLines(est.rowsJson);
      if (lines.length === 0) { toast.error('Unit Schedule has no equipment rows.'); return; }
      setData(prev => ({ ...prev, equipmentSchedule: lines }));
      toast.success(`${lines.length} unit${lines.length !== 1 ? 's' : ''} extracted from Unit Schedule`);
    } catch {
      toast.error('Could not load Unit Schedule.');
    } finally {
      setExtracting(false);
    }
  }, [projectId]);

  // Extract duct summary from saved Metal Duct estimate
  const [extractingDuct, setExtractingDuct] = useState(false);

  const extractDuct = useCallback(async () => {
    if (!projectId) { toast.error('Open a project first to extract duct data.'); return; }
    setExtractingDuct(true);
    try {
      const est = await estimatesApi.getByModule(projectId, 'METAL_DUCT');
      if (!est?.rowsJson) { toast.error('No Metal Duct estimate saved for this project yet.'); return; }
      const rows = Array.isArray(est.rowsJson) ? est.rowsJson : (est.rowsJson.rows || []);
      if (rows.length === 0) { toast.error('Metal Duct estimate has no rows.'); return; }
      const { data: calcResult } = await ductApi.calculate(rows, {});
      const summary = buildDuctSummary(calcResult.rows || []);
      if (summary.length === 0) { toast.error('No duct data found.'); return; }
      setData(prev => ({ ...prev, ductSchedule: summary }));
      toast.success(`Duct schedule extracted — ${summary.length} type${summary.length !== 1 ? 's' : ''}`);
    } catch (err) {
      toast.error('Could not extract duct data.');
    } finally {
      setExtractingDuct(false);
    }
  }, [projectId]);

  // Inject print styles once
  const printStyleRef = useRef(null);
  const triggerPrint  = useCallback(() => {
    if (!printStyleRef.current) {
      const style = document.createElement('style');
      style.id          = 'proposal-print-styles';
      style.textContent = PRINT_STYLES;
      document.head.appendChild(style);
      printStyleRef.current = style;
    }
    window.print();
  }, []);

  const refreshModules = () =>
    setData(prev => ({ ...prev, modules: readAllModuleTotals() }));

  return (
    <div className="max-w-5xl mx-auto">

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-blue-600" />
            Proposal Generator
          </h1>
          <p className="text-sm text-gray-500 mt-1">Click any field or list item to edit inline.</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Tax + markup controls */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs">
            {[
              { label: 'OH %',  key: 'overheadPct' },
              { label: 'Profit %', key: 'profitPct' },
              { label: 'Tax %', key: 'taxPct' },
            ].map(({ label, key }) => (
              <React.Fragment key={key}>
                <span className="text-gray-500">{label}</span>
                <input
                  type="number" min="0" max="50" step="0.1"
                  value={data[key]}
                  onChange={e => setData(p => ({ ...p, [key]: Number(e.target.value) || 0 }))}
                  className="w-14 border border-gray-200 rounded px-1.5 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </React.Fragment>
            ))}
            <label className="flex items-center gap-1 ml-2 text-gray-500 cursor-pointer select-none">
              <input type="checkbox" checked={data.controlsExcluded}
                onChange={e => setData(p => ({ ...p, controlsExcluded: e.target.checked }))} />
              Excl. controls
            </label>
          </div>

          <button onClick={extractEquipment} disabled={extracting} className="btn-secondary text-sm flex items-center gap-1.5">
            {extracting ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
            Extract Equipment
          </button>

          <button onClick={extractDuct} disabled={extractingDuct} className="btn-secondary text-sm flex items-center gap-1.5">
            {extractingDuct ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} />}
            Extract Duct
          </button>

          <button onClick={refreshModules} className="btn-secondary text-sm flex items-center gap-1.5">
            <Edit2 size={13} /> Refresh Totals
          </button>

          <button onClick={triggerPrint}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
            <Printer size={15} /> Export PDF
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-6 text-sm text-blue-700 no-print">
        <Check size={15} className="shrink-0 text-blue-500" />
        <span><strong>Export PDF:</strong> Click "Export PDF" → browser print dialog → Save as PDF.</span>
      </div>

      <ProposalDoc data={data} onDataChange={setData} />
    </div>
  );
}
