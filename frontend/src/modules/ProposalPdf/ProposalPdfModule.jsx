/**
 * ProposalPdfModule.jsx
 * Generates a professional bid proposal PDF from all estimate module data.
 *
 * Approach: renders a print-optimised React view, then triggers window.print().
 * The browser prints to PDF with zero extra dependencies. Output looks like a
 * real contractor proposal — company header, project details, cost breakdown table,
 * exclusions, terms & signature lines.
 *
 * To get a .pdf file: click "Export PDF" → browser print dialog → "Save as PDF".
 *
 * Future: swap window.print() for a /api/proposals/pdf backend call that returns
 * a reportlab-generated PDF (the Python skeleton is included at the bottom of this file).
 */
import React, { useState, useRef, useCallback } from 'react';
import { FileText, Printer, Edit2, Check } from 'lucide-react';
import { readAllModuleTotals } from '@utils/projectTotals';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  (n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const today = () => new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

// ─── Inline-editable text (double-click to edit) ──────────────────────────────
function Editable({ value, onChange, tag: Tag = 'span', className = '', placeholder = '...' }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal]     = useState(value);

  const commit = () => { onChange(local); setEditing(false); };

  if (editing) {
    return (
      <input
        autoFocus
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className={`border-b border-blue-400 bg-transparent focus:outline-none ${className}`}
        style={{ minWidth: '120px' }}
      />
    );
  }

  return (
    <Tag
      className={`cursor-pointer hover:bg-blue-50 rounded px-0.5 transition-colors ${className}`}
      onClick={() => { setLocal(value); setEditing(true); }}
      title="Click to edit"
    >
      {value || <span className="text-gray-400 italic">{placeholder}</span>}
    </Tag>
  );
}

// ─── Print styles (injected into <head> when printing) ───────────────────────
const PRINT_STYLES = `
@media print {
  body * { visibility: hidden !important; }
  #proposal-print-root,
  #proposal-print-root * { visibility: visible !important; }
  #proposal-print-root {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    font-family: 'Times New Roman', Times, serif !important;
    font-size: 11pt !important;
    color: #000 !important;
    background: white !important;
  }
  .no-print { display: none !important; }
  table { border-collapse: collapse !important; width: 100% !important; }
  th, td { border: 1px solid #ccc !important; padding: 5pt 8pt !important; }
  .page-break { page-break-before: always !important; }
}
`;

// ─── The actual proposal document ─────────────────────────────────────────────
function ProposalDoc({ data, onDataChange }) {
  const ch = (field) => (val) => onDataChange({ ...data, [field]: val });
  const modules = data.modules.filter(m => m.totalCost > 0);
  const totalMat  = modules.reduce((s, m) => s + m.totalMaterial, 0);
  const totalLab  = modules.reduce((s, m) => s + m.totalLabor,    0);
  const subTotal  = totalMat + totalLab;
  const overhead  = subTotal * (data.overheadPct / 100);
  const profit    = (subTotal + overhead) * (data.profitPct / 100);
  const grandTotal = subTotal + overhead + profit;

  return (
    <div id="proposal-print-root" className="bg-white p-8 max-w-4xl mx-auto shadow-lg text-gray-900 font-serif text-sm leading-relaxed">

      {/* Company header */}
      <div className="flex items-start justify-between border-b-2 border-gray-800 pb-4 mb-6">
        <div>
          <div className="text-2xl font-bold tracking-tight">
            <Editable value={data.companyName} onChange={ch('companyName')} tag="span" placeholder="Your Company Name" />
          </div>
          <div className="text-sm text-gray-600 mt-1">
            <Editable value={data.companyAddress} onChange={ch('companyAddress')} placeholder="123 Main St, City, State 12345" />
          </div>
          <div className="text-sm text-gray-600">
            <Editable value={data.companyPhone} onChange={ch('companyPhone')} placeholder="(555) 000-0000" />
            {' | '}
            <Editable value={data.companyEmail} onChange={ch('companyEmail')} placeholder="office@yourcompany.com" />
          </div>
          {data.companyLicense && (
            <div className="text-xs text-gray-500 mt-0.5">License #: {data.companyLicense}</div>
          )}
        </div>
        <div className="text-right text-sm text-gray-600">
          <div className="text-xl font-bold text-gray-800 uppercase tracking-widest mb-1">Bid Proposal</div>
          <div>Date: <Editable value={data.proposalDate} onChange={ch('proposalDate')} /></div>
          <div>Proposal #: <Editable value={data.proposalNum} onChange={ch('proposalNum')} placeholder="2024-001" /></div>
          <div className={`mt-1 px-2 py-0.5 rounded text-xs font-semibold inline-block ${
            data.status === 'Final' ? 'bg-green-100 text-green-800' :
            data.status === 'Revised' ? 'bg-amber-100 text-amber-800' :
            'bg-blue-100 text-blue-800'
          }`}>
            <Editable value={data.status} onChange={ch('status')} placeholder="Preliminary" />
          </div>
        </div>
      </div>

      {/* Project info table */}
      <table className="w-full mb-6 text-sm border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th colSpan={4} className="text-left px-3 py-1.5 font-semibold text-gray-700 uppercase tracking-wide text-xs">
              Project Information
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-3 py-1 font-medium text-gray-600 w-28">Project:</td>
            <td className="px-3 py-1"><Editable value={data.projectName} onChange={ch('projectName')} placeholder="Project Name" /></td>
            <td className="px-3 py-1 font-medium text-gray-600 w-24">Owner:</td>
            <td className="px-3 py-1"><Editable value={data.owner} onChange={ch('owner')} placeholder="Owner Name" /></td>
          </tr>
          <tr className="bg-gray-50">
            <td className="px-3 py-1 font-medium text-gray-600">Location:</td>
            <td className="px-3 py-1"><Editable value={data.location} onChange={ch('location')} placeholder="City, State" /></td>
            <td className="px-3 py-1 font-medium text-gray-600">GC:</td>
            <td className="px-3 py-1"><Editable value={data.gc} onChange={ch('gc')} placeholder="General Contractor" /></td>
          </tr>
          <tr>
            <td className="px-3 py-1 font-medium text-gray-600">Bid Date:</td>
            <td className="px-3 py-1"><Editable value={data.bidDate} onChange={ch('bidDate')} placeholder="MM/DD/YYYY" /></td>
            <td className="px-3 py-1 font-medium text-gray-600">Submitted To:</td>
            <td className="px-3 py-1"><Editable value={data.submittedTo} onChange={ch('submittedTo')} placeholder="Contact / Company" /></td>
          </tr>
        </tbody>
      </table>

      {/* Scope */}
      <div className="mb-6">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
          Scope of Work
        </div>
        <Editable
          tag="p"
          value={data.scope}
          onChange={ch('scope')}
          className="text-sm text-gray-800 leading-relaxed"
          placeholder="Describe the scope of work here. Double-click to edit."
        />
      </div>

      {/* Cost breakdown */}
      <div className="mb-6">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
          Cost Summary
        </div>
        {modules.length === 0 ? (
          <p className="text-gray-400 italic text-sm">No estimate data found. Open an estimating module and enter data, then return here.</p>
        ) : (
          <table className="w-full text-sm border border-gray-300">
            <thead>
              <tr className="bg-gray-100 text-xs uppercase tracking-wide text-gray-600">
                <th className="text-left px-3 py-1.5">Description</th>
                <th className="text-right px-3 py-1.5">Material</th>
                <th className="text-right px-3 py-1.5">Labor</th>
                <th className="text-right px-3 py-1.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m, i) => (
                <tr key={m.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-1.5 font-medium">{m.label}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(m.totalMaterial)}</td>
                  <td className="px-3 py-1.5 text-right">{fmt(m.totalLabor)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{fmt(m.totalCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-300 bg-gray-50 text-xs text-gray-500">
                <td className="px-3 py-1">Subtotal</td>
                <td className="px-3 py-1 text-right">{fmt(totalMat)}</td>
                <td className="px-3 py-1 text-right">{fmt(totalLab)}</td>
                <td className="px-3 py-1 text-right font-medium">{fmt(subTotal)}</td>
              </tr>
              {data.overheadPct > 0 && (
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <td colSpan={3} className="px-3 py-1">Overhead & General Conditions ({data.overheadPct}%)</td>
                  <td className="px-3 py-1 text-right font-medium">{fmt(overhead)}</td>
                </tr>
              )}
              {data.profitPct > 0 && (
                <tr className="bg-gray-50 text-xs text-gray-500">
                  <td colSpan={3} className="px-3 py-1">Profit & Contingency ({data.profitPct}%)</td>
                  <td className="px-3 py-1 text-right font-medium">{fmt(profit)}</td>
                </tr>
              )}
              <tr className="bg-gray-800 text-white">
                <td colSpan={3} className="px-3 py-2 font-bold text-sm uppercase tracking-wide">
                  Total Base Bid
                </td>
                <td className="px-3 py-2 text-right text-lg font-bold">{fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Alternates */}
      {data.alternates && (
        <div className="mb-6">
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
            Alternates
          </div>
          <Editable tag="p" value={data.alternates} onChange={ch('alternates')}
            className="text-sm text-gray-800" placeholder="List any alternates here (add/deduct)." />
        </div>
      )}

      {/* Exclusions */}
      <div className="mb-6">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
          Clarifications & Exclusions
        </div>
        <Editable tag="div" value={data.exclusions} onChange={ch('exclusions')}
          className="text-sm text-gray-800 whitespace-pre-line"
          placeholder={'• Electrical wiring and connections by others\n• Permits and inspections by owner\n• All prices valid for 30 days'} />
      </div>

      {/* Terms */}
      <div className="mb-8">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide border-b border-gray-300 pb-1 mb-2">
          Terms & Conditions
        </div>
        <Editable tag="p" value={data.terms} onChange={ch('terms')}
          className="text-xs text-gray-600"
          placeholder="Payment: Net 30 days from invoice date. Retainage: 10% until final completion. This proposal is valid for 30 days from date issued." />
      </div>

      {/* Signature block */}
      <div className="grid grid-cols-2 gap-12 mt-8">
        <div>
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4">Submitted By:</div>
          <div className="border-b border-gray-400 mb-1" style={{ height: '32px' }} />
          <div className="text-xs text-gray-500">
            <Editable value={data.companyName} onChange={ch('companyName')} placeholder="Company Name" />
          </div>
          <div className="border-b border-gray-300 mt-3 mb-1" style={{ height: '24px' }} />
          <div className="text-xs text-gray-500">Authorized Signature / Date</div>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-4">Accepted By:</div>
          <div className="border-b border-gray-400 mb-1" style={{ height: '32px' }} />
          <div className="text-xs text-gray-500">
            <Editable value={data.owner} onChange={ch('owner')} placeholder="Owner / GC" />
          </div>
          <div className="border-b border-gray-300 mt-3 mb-1" style={{ height: '24px' }} />
          <div className="text-xs text-gray-500">Authorized Signature / Date</div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200 text-center text-xs text-gray-400 no-print">
        Double-click any field above to edit it. Click "Export PDF" when ready.
      </div>
    </div>
  );
}

// ─── Main module ──────────────────────────────────────────────────────────────
export default function ProposalPdfModule({ projectInfo }) {
  const [data, setData] = useState(() => {
    const modules = readAllModuleTotals();
    return {
      // Company (from projectInfo or defaults)
      companyName:    projectInfo?.companyName    || 'Your HVAC Company',
      companyAddress: projectInfo?.companyAddress || '123 Main Street, City, State 12345',
      companyPhone:   projectInfo?.companyPhone   || '(555) 000-0000',
      companyEmail:   projectInfo?.companyEmail   || 'office@yourcompany.com',
      companyLicense: '',
      // Project
      projectName:  projectInfo?.projectName || '',
      location:     projectInfo?.location    || '',
      owner:        projectInfo?.owner       || '',
      gc:           projectInfo?.gc          || '',
      bidDate:      projectInfo?.bidDate     || '',
      submittedTo:  '',
      // Proposal meta
      proposalDate: today(),
      proposalNum:  `${new Date().getFullYear()}-001`,
      status:       'Preliminary',
      // Financials
      overheadPct: 12,
      profitPct:   10,
      // Module data
      modules,
      // Text fields
      scope: 'Furnish and install all HVAC mechanical equipment, ductwork, diffusers, fans, louvers, and associated accessories as indicated on the contract drawings and specifications.',
      alternates: '',
      exclusions: '• Electrical wiring, conduit, and connections are by others\n• Permits and inspections by owner unless otherwise stated\n• Gas piping and connections by others\n• All prices are valid for 30 days from date of proposal',
      terms: 'Payment terms: Net 30 days from invoice date. Retainage: 10% until project completion and final punch list approval. Any additional work beyond this proposal scope will be billed at time-and-material rates or per a mutually agreed change order.',
    };
  });

  const [editingMarkup, setEditingMarkup] = useState(false);

  // Inject print styles
  const printStyleRef = useRef(null);
  const triggerPrint = useCallback(() => {
    if (!printStyleRef.current) {
      const style = document.createElement('style');
      style.id = 'proposal-print-styles';
      style.textContent = PRINT_STYLES;
      document.head.appendChild(style);
      printStyleRef.current = style;
    }
    window.print();
  }, []);

  const refreshModules = () => {
    setData(prev => ({ ...prev, modules: readAllModuleTotals() }));
  };

  return (
    <div className="max-w-5xl mx-auto">

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-blue-600" />
            Proposal Generator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Click any field to edit it inline. When ready, export as PDF.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Markup controls */}
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500">Overhead</span>
            <input
              type="number" min="0" max="50"
              value={data.overheadPct}
              onChange={e => setData(p => ({ ...p, overheadPct: Number(e.target.value) || 0 }))}
              className="w-12 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-xs text-gray-400">%</span>
            <span className="text-xs text-gray-500 ml-2">Profit</span>
            <input
              type="number" min="0" max="50"
              value={data.profitPct}
              onChange={e => setData(p => ({ ...p, profitPct: Number(e.target.value) || 0 }))}
              className="w-12 border border-gray-200 rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-xs text-gray-400">%</span>
          </div>

          <button
            onClick={refreshModules}
            className="btn-secondary text-sm flex items-center gap-1.5"
          >
            <Edit2 size={13} /> Refresh Totals
          </button>

          <button
            onClick={triggerPrint}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Printer size={15} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Hint banner */}
      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 mb-6 text-sm text-blue-700 no-print">
        <Check size={15} className="shrink-0 text-blue-500" />
        <span>
          <strong>How to get a PDF:</strong> Click "Export PDF" → browser print dialog opens → change destination to "Save as PDF" → click Save.
          All fields are editable by clicking on them.
        </span>
      </div>

      {/* The proposal */}
      <ProposalDoc data={data} onDataChange={setData} />
    </div>
  );
}

/*
 * ─── FUTURE: Backend PDF generation skeleton ───────────────────────────────
 * When the Spring Boot backend is ready, replace window.print() with:
 *
 * POST /api/proposals/pdf
 * Body: { proposalData: data }
 * Response: application/pdf (binary)
 *
 * Python script (backend/scripts/generate_proposal.py):
 * -------------------------------------------------------
 * from reportlab.lib.pagesizes import letter
 * from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
 * from reportlab.lib.units import inch
 * from reportlab.platypus import (
 *     SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
 * )
 * from reportlab.lib import colors
 * import json, sys
 *
 * data = json.load(sys.stdin)
 * doc = SimpleDocTemplate("proposal.pdf", pagesize=letter, ...)
 * # ... build story with data ...
 * doc.build(story)
 * -------------------------------------------------------
 */
