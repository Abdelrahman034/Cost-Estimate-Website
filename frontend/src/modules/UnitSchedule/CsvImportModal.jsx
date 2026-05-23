/**
 * CsvImportModal.jsx
 * Paste CSV text (or upload a .csv file) to bulk-populate rows in any Unit Schedule section.
 *
 * Supports flexible column mapping — the importer auto-detects column headers
 * case-insensitively and maps them to row fields.
 *
 * Each section passes its own FIELD_MAP so the modal knows what columns to expect.
 */
import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, AlertCircle, CheckCircle, FileText, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line) => {
    const result = [];
    let cell = '';
    let inQ   = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { result.push(cell.trim()); cell = ''; continue; }
      cell += ch;
    }
    result.push(cell.trim());
    return result;
  };

  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const rows    = lines.slice(1).map(line => {
    const cells = parseRow(line);
    const obj   = {};
    headers.forEach((h, i) => { obj[h] = cells[i] ?? ''; });
    return obj;
  });

  return { headers, rows };
}

// ─── Column aliases (map various header spellings → field key) ────────────────
const ALIASES = {
  // Common across sections
  tag:           ['tag', 'name', 'id', 'mark', 'unit'],
  qty:           ['qty', 'quantity', 'count', 'num'],
  unitprice:     ['unitprice', 'price', 'cost', 'rate', 'unitcost'],
  // Equipment
  tons:          ['tons', 'capacity', 'tonnage', 'ton'],
  cfm:           ['cfm', 'airflow', 'flow'],
  type:          ['type', 'kind', 'model', 'style'],
  seerEer:       ['seer', 'eer', 'efficiency'],
  // Fan
  mount:         ['mount', 'mounting'],
  drive:         ['drive', 'drivetype'],
  // Louver / Damper
  widthin:       ['widthin', 'width', 'w', 'widthininches'],
  heightin:      ['heightin', 'height', 'h', 'heightininches'],
};

function normalizeKey(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mapHeaders(headers) {
  // Returns { csvColKey → fieldKey }
  const mapping = {};
  headers.forEach(h => {
    const norm = normalizeKey(h);
    for (const [field, aliasList] of Object.entries(ALIASES)) {
      if (aliasList.includes(norm)) {
        mapping[norm] = field;
        break;
      }
    }
  });
  return mapping;
}

// ─── Section-specific field extractors ───────────────────────────────────────
/**
 * SECTION_PARSERS[sectionKey](csvRow, headerMapping) → partial row object
 * Only returns the fields that are present in the CSV.
 */
const SECTION_PARSERS = {
  packaged: (r, m) => ({
    ...(m.tag        && { name:      r[m.tag]        }),
    ...(m.type       && { type:      r[m.type]       }),
    ...(m.tons       && { tons:      Number(r[m.tons])  || 0 }),
    ...(m.qty        && { qty:       Number(r[m.qty])   || 1 }),
    ...(m.unitprice  && { unitPrice: Number(r[m.unitprice]) || 0 }),
  }),
  split: (r, m) => ({
    ...(m.tag        && { name:      r[m.tag]        }),
    ...(m.type       && { type:      r[m.type]       }),
    ...(m.tons       && { tons:      Number(r[m.tons])  || 0 }),
    ...(m.qty        && { qty:       Number(r[m.qty])   || 1 }),
    ...(m.unitprice  && { unitPrice: Number(r[m.unitprice]) || 0 }),
  }),
  wallMount: (r, m) => ({
    ...(m.tag        && { name:      r[m.tag]        }),
    ...(m.tons       && { tons:      Number(r[m.tons])  || 0 }),
    ...(m.qty        && { qty:       Number(r[m.qty])   || 1 }),
    ...(m.unitprice  && { unitPrice: Number(r[m.unitprice]) || 0 }),
  }),
  vrf: (r, m) => ({
    ...(m.tag        && { name:      r[m.tag]        }),
    ...(m.tons       && { tons:      Number(r[m.tons])  || 0 }),
    ...(m.qty        && { qty:       Number(r[m.qty])   || 1 }),
    ...(m.unitprice  && { unitPrice: Number(r[m.unitprice]) || 0 }),
  }),
  service: (r, m) => ({
    ...(m.tag        && { name:      r[m.tag]        }),
    ...(m.type       && { type:      r[m.type]       }),
    ...(m.qty        && { qty:       Number(r[m.qty])   || 1 }),
    ...(m.unitprice  && { unitPrice: Number(r[m.unitprice]) || 0 }),
  }),
  fans: (r, m) => ({
    ...(m.tag        && { name:      r[m.tag]        }),
    ...(m.type       && { type:      r[m.type]       }),
    ...(m.cfm        && { cfm:       Number(r[m.cfm])   || 0 }),
    ...(m.mount      && { mount:     r[m.mount]       }),
    ...(m.drive      && { drive:     r[m.drive]       }),
    ...(m.unitprice  && { unitPrice: Number(r[m.unitprice]) || 0 }),
  }),
  louverDamper: (r, m) => ({
    ...(m.tag        && { name:      r[m.tag]        }),
    ...(m.type       && { type:      r[m.type]       }),
    ...(m.widthin    && { widthIn:   Number(r[m.widthin])  || 0 }),
    ...(m.heightin   && { heightIn:  Number(r[m.heightin]) || 0 }),
    ...(m.qty        && { qty:       Number(r[m.qty])   || 1 }),
    ...(m.unitprice  && { unitPrice: Number(r[m.unitprice]) || 0 }),
  }),
};

// ─── Template hints shown in the modal ───────────────────────────────────────
const TEMPLATE_ROWS = {
  packaged:     'Tag,Type,Tons,Qty,UnitPrice\nRTU-1,Rooftop Unit,7.5,1,\nAHU-1,Air Handler,10,1,',
  split:        'Tag,Type,Tons,Qty\nHP-1,Heat Pump,3,1\nSS-1,Standard Split,2,1',
  wallMount:    'Tag,Tons,Qty\nWM-1,1.5,2\nWM-2,2,1',
  vrf:          'Tag,Tons,Qty\nVRF-1,6,1\nVRF-2,3,2',
  service:      'Tag,Type,Qty\nEX-1,Fan Coil,3\nEX-2,Split System,1',
  fans:         'Tag,Type,CFM,Mount,Drive\nEF-1,Exhaust Fan,500,Roof,Direct Drive\nSF-1,Supply Fan,2000,Wall,Belt Drive',
  louverDamper: 'Tag,Type,Width,Height,Qty\nOAL-1,OA Louver,36,24,1\nFD-1,Fire Damper,24,12,2',
};

// ─── Modal ────────────────────────────────────────────────────────────────────
/**
 * Props:
 *   sectionKey  — e.g. 'fans'
 *   sectionLabel — display name e.g. 'Fans'
 *   onImport(rows: partialRowData[]) — callback with array of partial row objects
 *   onClose
 */
export default function CsvImportModal({ sectionKey, sectionLabel, onImport, onClose }) {
  const [csvText,   setCsvText]   = useState('');
  const [preview,   setPreview]   = useState(null); // { headers, mapped, rows }
  const [error,     setError]     = useState('');
  const fileRef = useRef();

  const templateHint = TEMPLATE_ROWS[sectionKey] || '';
  const parser       = SECTION_PARSERS[sectionKey] || (() => ({}));

  // ── Parse & preview ────────────────────────────────────────────────────────
  const parse = useCallback((text) => {
    setError('');
    setPreview(null);
    if (!text.trim()) return;

    const { headers, rows } = parseCsv(text);
    if (headers.length === 0) { setError('Could not parse CSV — check that your text has a header row.'); return; }
    if (rows.length === 0)    { setError('No data rows found after the header.'); return; }

    const hMapping = mapHeaders(headers); // { normalizedHeader → fieldKey }
    const mapped   = rows.map(r => {
      // Re-key the raw row using normalized headers
      const norm = {};
      Object.entries(r).forEach(([k, v]) => { norm[normalizeKey(k)] = v; });
      return parser(norm, hMapping);
    });

    const detectedCols = Object.keys(hMapping).length;
    setPreview({ headers, rows, mapped, detectedCols });
  }, [parser]);

  const handleText = (e) => {
    const t = e.target.value;
    setCsvText(t);
    parse(t);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const t = ev.target.result;
      setCsvText(t);
      parse(t);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!preview?.mapped?.length) return;
    onImport(preview.mapped);
    toast.success(`${preview.mapped.length} row${preview.mapped.length !== 1 ? 's' : ''} imported`);
    onClose();
  };

  const loadTemplate = () => {
    setCsvText(templateHint);
    parse(templateHint);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Upload size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-800">Import CSV — {sectionLabel}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText size={14} />
              Upload .csv file
            </button>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
            <button
              type="button"
              onClick={loadTemplate}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors"
            >
              Load example
            </button>
            <span className="text-xs text-gray-400">or paste CSV below</span>
          </div>

          {/* Textarea */}
          <textarea
            value={csvText}
            onChange={handleText}
            placeholder={`Paste CSV here…\n\nExample:\n${templateHint}`}
            rows={7}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
          />

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div>
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3">
                <CheckCircle size={15} />
                {preview.rows.length} row{preview.rows.length !== 1 ? 's' : ''} detected,&nbsp;
                {preview.detectedCols} column{preview.detectedCols !== 1 ? 's' : ''} mapped
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(preview.mapped[0] || {}).map(k => (
                        <th key={k} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase tracking-wide">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.mapped.slice(0, 5).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-1.5 text-gray-700">{String(v)}</td>
                        ))}
                      </tr>
                    ))}
                    {preview.mapped.length > 5 && (
                      <tr>
                        <td
                          colSpan={Object.keys(preview.mapped[0] || {}).length}
                          className="px-3 py-1.5 text-gray-400 text-center italic"
                        >
                          … and {preview.mapped.length - 5} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-400">
            Unrecognised columns are ignored. Fields not in CSV keep their defaults.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={!preview?.mapped?.length}
              className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Import {preview?.mapped?.length ? `${preview.mapped.length} rows` : ''}
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
