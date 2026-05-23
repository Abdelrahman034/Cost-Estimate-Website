/**
 * TemplatesModal.jsx
 * Save any configured unit row as a named template.
 * Load templates back with one click — the row is pre-filled with all stored values.
 *
 * Storage: localStorage key "unit_schedule_templates"
 * Templates are grouped by section type so the Fan section only shows fan templates, etc.
 */
import React, { useState, useCallback } from 'react';
import { BookOpen, Plus, Trash2, Download, X } from 'lucide-react';
import toast from 'react-hot-toast';

const LS_KEY = 'unit_schedule_templates';

// ─── Storage helpers ──────────────────────────────────────────────────────────
function loadTemplates() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { return []; }
}

function saveTemplates(list) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

// ─── Hook: useRowTemplates ─────────────────────────────────────────────────────
/**
 * @param {string} sectionKey  e.g. 'fans', 'packaged', 'louverDamper'
 * @returns {{ templates, saveAsTemplate, deleteTemplate }}
 */
export function useRowTemplates(sectionKey) {
  const [, forceRender] = useState(0);
  const bump = () => forceRender(n => n + 1);

  const templates = loadTemplates().filter(t => t.sectionKey === sectionKey);

  const saveAsTemplate = useCallback((row, name) => {
    const all = loadTemplates();
    const { id: _id, ...data } = row; // strip the runtime id
    all.push({ id: `tpl-${Date.now()}`, sectionKey, name: name || 'Unnamed', data, savedAt: Date.now() });
    saveTemplates(all);
    bump();
    toast.success(`Template "${name}" saved`);
  }, [sectionKey]);

  const deleteTemplate = useCallback((tplId) => {
    saveTemplates(loadTemplates().filter(t => t.id !== tplId));
    bump();
    toast('Template deleted', { icon: '🗑️' });
  }, []);

  return { templates, saveAsTemplate, deleteTemplate };
}

// ─── Save-As-Template Inline dialog ──────────────────────────────────────────
/**
 * Tiny popover triggered by "Save as Template" inside a row.
 * Props:
 *   row        — the current row data
 *   sectionKey — which section this belongs to
 *   onClose    — close the popover
 */
export function SaveTemplatePopover({ row, sectionKey, onClose }) {
  const [name, setName] = useState(row.name || '');
  const { saveAsTemplate } = useRowTemplates(sectionKey);

  const handle = () => {
    if (!name.trim()) { toast.error('Please enter a template name'); return; }
    saveAsTemplate(row, name.trim());
    onClose();
  };

  return (
    <div className="absolute z-50 bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-64 right-0 top-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Save as Template</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
      </div>
      <input
        autoFocus
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handle()}
        placeholder="Template name…"
        className="w-full border border-gray-200 rounded px-3 py-1.5 text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <button
        onClick={handle}
        className="w-full bg-blue-600 text-white text-sm font-medium py-1.5 rounded hover:bg-blue-700 transition-colors"
      >
        Save Template
      </button>
    </div>
  );
}

// ─── Templates Panel (shown in SectionWrapper header) ─────────────────────────
/**
 * Compact panel listing saved templates for a section.
 * "Insert" calls onInsert(templateData) — the section adds a pre-filled row.
 */
export function TemplatesPanel({ sectionKey, onInsert }) {
  const { templates, deleteTemplate } = useRowTemplates(sectionKey);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
        title="View saved templates"
      >
        <BookOpen size={12} />
        Templates {templates.length > 0 && <span className="bg-purple-100 text-purple-700 rounded-full px-1.5">{templates.length}</span>}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium transition-colors"
      >
        <BookOpen size={12} />
        Templates
        <X size={10} className="ml-1" />
      </button>

      {/* Dropdown */}
      <div className="absolute z-40 right-0 top-6 bg-white rounded-xl shadow-xl border border-gray-200 w-72">
        <div className="px-4 py-2 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Saved Templates</span>
        </div>

        {templates.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400 italic">
            No templates saved yet. Use the ⊕ menu inside any row.
          </p>
        ) : (
          <ul className="max-h-60 overflow-y-auto divide-y divide-gray-50">
            {templates.map(t => (
              <li key={t.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50">
                <span className="flex-1 text-sm text-gray-700 font-medium truncate">{t.name}</span>
                <button
                  type="button"
                  onClick={() => { onInsert(t.data); setOpen(false); toast.success(`Inserted "${t.name}"`); }}
                  className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-0.5 rounded font-medium transition-colors"
                  title="Insert this template as a new row"
                >
                  <Plus size={11} />
                  Insert
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(t.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors"
                  title="Delete template"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="px-4 py-2 border-t border-gray-100 text-xs text-gray-400">
          Templates are saved in your browser.
        </div>
      </div>
    </div>
  );
}

// ─── SaveTemplate button — placed inside RowWrapper action column ─────────────
/**
 * Small star button that opens an inline popover to name and save the row.
 */
export function SaveTemplateBtn({ row, sectionKey }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-gray-300 hover:text-purple-500 transition-colors"
        title="Save row as template"
      >
        <Download size={14} />
      </button>
      {open && (
        <SaveTemplatePopover
          row={row}
          sectionKey={sectionKey}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
