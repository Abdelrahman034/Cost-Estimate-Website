/**
 * SupplierRFQModule — Supplier management, RFQ creation, quote entry, and comparison
 *
 * 4-tab workflow:
 *   1. Suppliers  — CRUD directory of your trusted suppliers
 *   2. Build RFQ  — Create equipment/material line items, assign suppliers, send
 *   3. Quotes     — Enter supplier quote responses per line item
 *   4. Compare    — Side-by-side price comparison with best-price highlighting
 *
 * State: localStorage (keys: rfq_suppliers, rfq_rfqs, rfq_quotes)
 * API_TODO: Replace localStorage reads/writes with suppliersApi + rfqApi calls
 */
import React, { useState, useCallback, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
  Users, ClipboardList, MessageSquare, BarChart2,
  Plus, Trash2, Edit2, Check, X, Mail, ChevronDown, ChevronUp, Award, Save,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = (p = 'id') => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);

function useLocalList(key, initial = []) {
  const [list, _set] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? initial; }
    catch { return initial; }
  });
  const set = useCallback((updater) => {
    _set(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);
  return [list, set];
}

const UNIT_OPTIONS = ['EA', 'LS', 'LF', 'SQ FT', 'TON', 'KW', 'SET'];
const STATUS_OPTIONS = ['pending', 'received', 'accepted', 'rejected'];
const STATUS_COLORS = {
  pending:  'text-yellow-400 bg-yellow-900/30',
  received: 'text-blue-400 bg-blue-900/30',
  accepted: 'text-green-400 bg-green-900/30',
  rejected: 'text-red-400 bg-red-900/30',
};

// ─── Suppliers Tab ────────────────────────────────────────────────────────────
function SuppliersTab({ suppliers, setSuppliers }) {
  const blank = { name: '', company: '', email: '', phone: '', notes: '' };
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const openNew = () => { setForm(blank); setEditId(null); setShowForm(true); };
  const openEdit = (sup) => { setForm({ ...sup }); setEditId(sup.id); setShowForm(true); };
  const cancel = () => { setShowForm(false); setEditId(null); setForm(blank); };

  const save = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    if (editId) {
      setSuppliers(prev => prev.map(s => s.id === editId ? { ...s, ...form } : s));
      toast.success('Supplier updated');
    } else {
      setSuppliers(prev => [...prev, { id: uid('sup'), ...form }]);
      toast.success('Supplier added');
    }
    cancel();
  };

  const remove = (id) => {
    if (!confirm('Remove this supplier?')) return;
    setSuppliers(prev => prev.filter(s => s.id !== id));
    toast.success('Supplier removed');
  };

  const inp = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">{suppliers.length} supplier{suppliers.length !== 1 ? 's' : ''} in your directory</p>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus size={15} /> Add Supplier
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-gray-800/60 border border-blue-700/50 rounded-xl p-5 space-y-3">
          <h3 className="text-white font-medium">{editId ? 'Edit Supplier' : 'New Supplier'}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Contact Name *</label>
              <input className={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Company</label>
              <input className={inp} value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="ABC Supply Co" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Email</label>
              <input className={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@abcsupply.com" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Phone</label>
              <input className={inp} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="555-1234" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-400 block mb-1">Notes</label>
              <input className={inp} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. specializes in commercial HVAC equipment" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"><Check size={14} /> Save</button>
            <button onClick={cancel} className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"><X size={14} /> Cancel</button>
          </div>
        </div>
      )}

      {/* Supplier cards */}
      {suppliers.length === 0 && !showForm && (
        <div className="text-center py-12 text-gray-500">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>No suppliers yet. Add your first supplier to get started.</p>
        </div>
      )}
      <div className="space-y-2">
        {suppliers.map(sup => (
          <div key={sup.id} className="flex items-center gap-4 bg-gray-800/50 border border-gray-700/50 rounded-xl px-5 py-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{sup.name}</span>
                {sup.company && <span className="text-gray-400 text-sm">— {sup.company}</span>}
              </div>
              <div className="flex gap-4 mt-0.5 text-xs text-gray-500">
                {sup.email && <span>{sup.email}</span>}
                {sup.phone && <span>{sup.phone}</span>}
                {sup.notes && <span className="italic">{sup.notes}</span>}
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => openEdit(sup)} className="p-2 text-gray-400 hover:text-blue-400 transition-colors" title="Edit"><Edit2 size={14} /></button>
              <button onClick={() => remove(sup.id)} className="p-2 text-gray-400 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── RFQ Builder Tab ──────────────────────────────────────────────────────────
function RFQBuilderTab({ suppliers, rfqs, setRfqs, quotes, setQuotes }) {
  const blankRfq = () => ({
    id: uid('rfq'), title: '', projectName: '',
    items: [{ id: uid('itm'), description: '', qty: 1, unit: 'EA', targetPrice: '' }],
    supplierIds: [], status: 'draft', createdAt: new Date().toISOString(),
  });
  const [form, setForm] = useState(blankRfq);
  const [editingId, setEditingId] = useState(null);

  const loadForEdit = (rfq) => { setForm({ ...rfq }); setEditingId(rfq.id); };
  const newRfq = () => { setForm(blankRfq()); setEditingId(null); };

  const setItems = (updater) => setForm(f => ({ ...f, items: typeof updater === 'function' ? updater(f.items) : updater }));

  const addItem = () => setItems(it => [...it, { id: uid('itm'), description: '', qty: 1, unit: 'EA', targetPrice: '' }]);
  const removeItem = (id) => setItems(it => it.filter(i => i.id !== id));
  const updateItem = (id, field, val) => setItems(it => it.map(i => i.id === id ? { ...i, [field]: val } : i));

  const toggleSupplier = (supId) => setForm(f => ({
    ...f,
    supplierIds: f.supplierIds.includes(supId) ? f.supplierIds.filter(s => s !== supId) : [...f.supplierIds, supId],
  }));

  const saveRfq = () => {
    if (!form.title.trim()) { toast.error('RFQ title is required'); return; }
    if (form.items.every(i => !i.description.trim())) { toast.error('Add at least one line item'); return; }
    if (editingId) {
      setRfqs(prev => prev.map(r => r.id === editingId ? form : r));
      toast.success('RFQ updated');
    } else {
      setRfqs(prev => [...prev, form]);
      // Init blank quotes for assigned suppliers
      const newQuotes = form.supplierIds.map(sid => ({
        id: uid('qte'), rfqId: form.id, supplierId: sid,
        lines: form.items.map(i => ({ itemId: i.id, unitCost: '', totalCost: 0 })),
        subtotal: 0, notes: '', status: 'pending',
      }));
      setQuotes(prev => [...prev, ...newQuotes]);
      toast.success('RFQ saved');
    }
    setEditingId(null);
    setForm(blankRfq());
  };

  const deleteRfq = (id) => {
    if (!confirm('Delete this RFQ and all associated quotes?')) return;
    setRfqs(prev => prev.filter(r => r.id !== id));
    setQuotes(prev => prev.filter(q => q.rfqId !== id));
    toast.success('RFQ deleted');
  };

  const inp = 'bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500';

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-5 space-y-4">
        <h3 className="text-white font-medium">{editingId ? 'Edit RFQ' : 'Create New RFQ'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">RFQ Title *</label>
            <input className={`${inp} w-full`} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="RFQ #001 – Equipment" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Project Name</label>
            <input className={`${inp} w-full`} value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))} placeholder="Office Building HVAC" />
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm text-gray-300 font-medium">Line Items</label>
            <button onClick={addItem} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"><Plus size={12} /> Add Item</button>
          </div>
          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Description</label>}
                  <input className={`${inp} w-full`} value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="e.g. 5-ton Packaged RTU" />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Qty</label>}
                  <input className={`${inp} w-full`} type="number" min="0" value={item.qty} onChange={e => updateItem(item.id, 'qty', Number(e.target.value))} />
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Unit</label>}
                  <select className={`${inp} w-full`} value={item.unit} onChange={e => updateItem(item.id, 'unit', e.target.value)}>
                    {UNIT_OPTIONS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  {idx === 0 && <label className="text-xs text-gray-500 block mb-1">Budget $</label>}
                  <input className={`${inp} w-full`} type="number" min="0" value={item.targetPrice} onChange={e => updateItem(item.id, 'targetPrice', e.target.value)} placeholder="optional" />
                </div>
                <div className={`col-span-1 ${idx === 0 ? 'mt-4' : ''}`}>
                  <button onClick={() => removeItem(item.id)} disabled={form.items.length === 1} className="text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Supplier selection */}
        <div>
          <label className="text-sm text-gray-300 font-medium block mb-2">Send to Suppliers</label>
          {suppliers.length === 0 && <p className="text-gray-500 text-sm">No suppliers yet — add them in the Suppliers tab first.</p>}
          <div className="grid grid-cols-2 gap-2">
            {suppliers.map(sup => (
              <label key={sup.id} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${
                form.supplierIds.includes(sup.id) ? 'border-blue-500 bg-blue-900/20' : 'border-gray-700 bg-gray-800/30 hover:border-gray-500'
              }`}>
                <input type="checkbox" checked={form.supplierIds.includes(sup.id)} onChange={() => toggleSupplier(sup.id)} className="accent-blue-500" />
                <span>
                  <span className="text-white text-sm">{sup.name}</span>
                  {sup.company && <span className="text-gray-500 text-xs ml-1">({sup.company})</span>}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={saveRfq} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium">
            <Save size={14} /> {editingId ? 'Update RFQ' : 'Save RFQ'}
          </button>
          {editingId && (
            <button onClick={newRfq} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm">Cancel Edit</button>
          )}
        </div>
      </div>

      {/* Saved RFQs */}
      {rfqs.length > 0 && (
        <div>
          <h3 className="text-gray-300 font-medium mb-3">Saved RFQs</h3>
          <div className="space-y-2">
            {rfqs.map(rfq => {
              const assignedNames = rfq.supplierIds.map(sid => suppliers.find(s => s.id === sid)?.name).filter(Boolean);
              return (
                <div key={rfq.id} className="flex items-center gap-4 bg-gray-800/50 border border-gray-700/50 rounded-xl px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-medium">{rfq.title}</span>
                      {rfq.projectName && <span className="text-gray-500 text-sm">{rfq.projectName}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[rfq.status] || 'text-gray-400 bg-gray-700'}`}>{rfq.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {rfq.items?.length || 0} line items · {assignedNames.length > 0 ? assignedNames.join(', ') : 'no suppliers assigned'}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => loadForEdit(rfq)} className="p-2 text-gray-400 hover:text-blue-400 transition-colors" title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => deleteRfq(rfq.id)} className="p-2 text-gray-400 hover:text-red-400 transition-colors" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quotes Tab ────────────────────────────────────────────────────────────────
function QuotesTab({ rfqs, suppliers, quotes, setQuotes }) {
  const [selectedRfqId, setSelectedRfqId] = useState('');
  const rfq = rfqs.find(r => r.id === selectedRfqId);

  const getQuote = (rfqId, supId) =>
    quotes.find(q => q.rfqId === rfqId && q.supplierId === supId) || {
      id: null, rfqId, supplierId: supId,
      lines: (rfq?.items || []).map(i => ({ itemId: i.id, unitCost: '', totalCost: 0 })),
      subtotal: 0, notes: '', status: 'pending',
    };

  const updateQuoteLine = (supId, itemId, unitCost) => {
    const item = rfq?.items.find(i => i.id === itemId);
    const qty = item?.qty || 1;
    const total = (parseFloat(unitCost) || 0) * qty;
    setQuotes(prev => {
      const existing = prev.find(q => q.rfqId === selectedRfqId && q.supplierId === supId);
      if (existing) {
        return prev.map(q => {
          if (q.rfqId !== selectedRfqId || q.supplierId !== supId) return q;
          const lines = q.lines.map(l => l.itemId === itemId ? { ...l, unitCost, totalCost: total } : l);
          const subtotal = lines.reduce((s, l) => s + (l.totalCost || 0), 0);
          return { ...q, lines, subtotal };
        });
      } else {
        const q = getQuote(selectedRfqId, supId);
        const lines = q.lines.map(l => l.itemId === itemId ? { ...l, unitCost, totalCost: total } : l);
        const subtotal = lines.reduce((s, l) => s + (l.totalCost || 0), 0);
        return [...prev, { ...q, id: uid('qte'), lines, subtotal }];
      }
    });
  };

  const updateQuoteField = (supId, field, val) => {
    setQuotes(prev => {
      const existing = prev.find(q => q.rfqId === selectedRfqId && q.supplierId === supId);
      if (existing) {
        return prev.map(q => q.rfqId === selectedRfqId && q.supplierId === supId ? { ...q, [field]: val } : q);
      } else {
        const q = getQuote(selectedRfqId, supId);
        return [...prev, { ...q, id: uid('qte'), [field]: val }];
      }
    });
  };

  const inp = 'bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 w-full';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-400">Select RFQ:</label>
        <select
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          value={selectedRfqId}
          onChange={e => setSelectedRfqId(e.target.value)}
        >
          <option value="">— pick an RFQ —</option>
          {rfqs.map(r => <option key={r.id} value={r.id}>{r.title}{r.projectName ? ` (${r.projectName})` : ''}</option>)}
        </select>
      </div>

      {!rfq && (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p>Select an RFQ to enter supplier quotes.</p>
        </div>
      )}

      {rfq && rfq.supplierIds.length === 0 && (
        <p className="text-yellow-400 text-sm">This RFQ has no suppliers assigned. Edit it in the Build RFQ tab.</p>
      )}

      {rfq && rfq.supplierIds.map(supId => {
        const sup = suppliers.find(s => s.id === supId);
        if (!sup) return null;
        const quote = getQuote(selectedRfqId, supId);
        return (
          <div key={supId} className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gray-800/80 border-b border-gray-700/50">
              <div>
                <span className="text-white font-medium">{sup.name}</span>
                {sup.company && <span className="text-gray-400 text-sm ml-2">{sup.company}</span>}
                {sup.email && <span className="text-gray-500 text-xs ml-2">{sup.email}</span>}
              </div>
              <div className="flex items-center gap-3">
                <select
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                  value={quote.status}
                  onChange={e => updateQuoteField(supId, 'status', e.target.value)}
                >
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                </select>
                <span className="text-white font-semibold text-sm">{fmt(quote.subtotal)}</span>
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-1 mb-1">
                <span className="col-span-5">Item</span>
                <span className="col-span-2 text-right">Qty</span>
                <span className="col-span-2 text-right">Unit Price</span>
                <span className="col-span-3 text-right">Total</span>
              </div>
              {rfq.items.map(item => {
                const line = quote.lines.find(l => l.itemId === item.id) || { unitCost: '', totalCost: 0 };
                return (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5 text-sm text-gray-300">{item.description || <em className="text-gray-600">unnamed item</em>}</div>
                    <div className="col-span-2 text-right text-sm text-gray-400">{item.qty} {item.unit}</div>
                    <div className="col-span-2">
                      <input
                        className={inp}
                        type="number" min="0" step="0.01"
                        value={line.unitCost}
                        onChange={e => updateQuoteLine(supId, item.id, e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="col-span-3 text-right text-sm text-white font-medium">{fmt(line.totalCost)}</div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-gray-700">
                <input
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 w-full"
                  value={quote.notes}
                  onChange={e => updateQuoteField(supId, 'notes', e.target.value)}
                  placeholder="Notes (e.g. includes freight, lead time, warranty terms…)"
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Compare Tab ────────────────────────────────────────────────────────────────
function CompareTab({ rfqs, suppliers, quotes }) {
  const [selectedRfqId, setSelectedRfqId] = useState('');
  const rfq = rfqs.find(r => r.id === selectedRfqId);

  const rfqQuotes = useMemo(() =>
    quotes.filter(q => q.rfqId === selectedRfqId),
    [quotes, selectedRfqId]
  );

  const assignedSuppliers = useMemo(() =>
    (rfq?.supplierIds || []).map(sid => suppliers.find(s => s.id === sid)).filter(Boolean),
    [rfq, suppliers]
  );

  // Find lowest unit price per item across suppliers
  const lowestByItem = useMemo(() => {
    if (!rfq) return {};
    const result = {};
    rfq.items.forEach(item => {
      const prices = rfqQuotes.map(q => {
        const line = q.lines?.find(l => l.itemId === item.id);
        return line ? parseFloat(line.unitCost) || 0 : 0;
      }).filter(p => p > 0);
      result[item.id] = prices.length ? Math.min(...prices) : null;
    });
    return result;
  }, [rfq, rfqQuotes]);

  const totals = useMemo(() =>
    assignedSuppliers.map(sup => {
      const q = rfqQuotes.find(q => q.supplierId === sup.id);
      return q?.subtotal || 0;
    }),
    [assignedSuppliers, rfqQuotes]
  );

  const minTotal = totals.length ? Math.min(...totals.filter(t => t > 0)) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-400">Select RFQ:</label>
        <select
          className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
          value={selectedRfqId}
          onChange={e => setSelectedRfqId(e.target.value)}
        >
          <option value="">— pick an RFQ —</option>
          {rfqs.map(r => <option key={r.id} value={r.id}>{r.title}{r.projectName ? ` (${r.projectName})` : ''}</option>)}
        </select>
      </div>

      {!rfq && (
        <div className="text-center py-12 text-gray-500">
          <BarChart2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>Select an RFQ to compare supplier quotes.</p>
        </div>
      )}

      {rfq && assignedSuppliers.length === 0 && (
        <p className="text-yellow-400 text-sm">No suppliers assigned to this RFQ.</p>
      )}

      {rfq && assignedSuppliers.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700 bg-gray-800/80">
                  <th className="text-left px-5 py-3 text-gray-400 font-medium w-64">Item</th>
                  <th className="text-center px-3 py-3 text-gray-400 font-medium">Qty</th>
                  {assignedSuppliers.map(sup => {
                    const q = rfqQuotes.find(q => q.supplierId === sup.id);
                    const isWinner = q?.subtotal > 0 && q.subtotal === minTotal;
                    return (
                      <th key={sup.id} className={`text-right px-4 py-3 font-medium ${isWinner ? 'text-green-400' : 'text-gray-300'}`}>
                        <div className="flex items-center justify-end gap-1">
                          {isWinner && <Award size={13} className="text-yellow-400" />}
                          {sup.name}
                        </div>
                        {sup.company && <div className="text-xs text-gray-500 font-normal">{sup.company}</div>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rfq.items.map((item, idx) => (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-gray-800/20' : ''}>
                    <td className="px-5 py-2.5 text-gray-300">{item.description || <em className="text-gray-600">unnamed</em>}</td>
                    <td className="px-3 py-2.5 text-center text-gray-400">{item.qty} {item.unit}</td>
                    {assignedSuppliers.map(sup => {
                      const q = rfqQuotes.find(q => q.supplierId === sup.id);
                      const line = q?.lines?.find(l => l.itemId === item.id);
                      const unitCost = parseFloat(line?.unitCost) || 0;
                      const isLow = unitCost > 0 && unitCost === lowestByItem[item.id];
                      return (
                        <td key={sup.id} className={`px-4 py-2.5 text-right font-medium ${unitCost > 0 ? (isLow ? 'text-green-400' : 'text-white') : 'text-gray-600'}`}>
                          {unitCost > 0 ? (
                            <>
                              <div>{fmt(line.totalCost)}</div>
                              <div className="text-xs font-normal text-gray-400">{fmt(unitCost)}/ea</div>
                            </>
                          ) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Notes row */}
                <tr className="border-t border-gray-700 bg-gray-800/50">
                  <td className="px-5 py-2 text-gray-500 text-xs italic">Notes</td>
                  <td />
                  {assignedSuppliers.map(sup => {
                    const q = rfqQuotes.find(q => q.supplierId === sup.id);
                    return <td key={sup.id} className="px-4 py-2 text-right text-xs text-gray-500 italic">{q?.notes || '—'}</td>;
                  })}
                </tr>
                {/* Total row */}
                <tr className="border-t-2 border-gray-600 bg-gray-800/80">
                  <td className="px-5 py-3 text-white font-bold" colSpan={2}>TOTAL</td>
                  {assignedSuppliers.map((sup, i) => {
                    const total = totals[i];
                    const isWinner = total > 0 && total === minTotal;
                    return (
                      <td key={sup.id} className={`px-4 py-3 text-right font-bold text-base ${isWinner ? 'text-green-400' : 'text-white'}`}>
                        {total > 0 ? (
                          <span className="flex items-center justify-end gap-1">
                            {isWinner && <Award size={14} className="text-yellow-400" />}
                            {fmt(total)}
                          </span>
                        ) : <span className="text-gray-600 font-normal">no quote</span>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-700/50 text-xs text-gray-500">
            ✦ Green = lowest price per line item &nbsp;·&nbsp; 🏆 = lowest total
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────
const TABS = [
  { id: 'suppliers', label: 'Suppliers',  icon: Users },
  { id: 'rfq',       label: 'Build RFQ', icon: ClipboardList },
  { id: 'quotes',    label: 'Quotes',    icon: MessageSquare },
  { id: 'compare',   label: 'Compare',   icon: BarChart2 },
];

export default function SupplierRFQModule() {
  const [activeTab, setActiveTab] = useState('suppliers');
  const [suppliers, setSuppliers] = useLocalList('rfq_suppliers');
  const [rfqs, setRfqs]           = useLocalList('rfq_rfqs');
  const [quotes, setQuotes]       = useLocalList('rfq_quotes');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-900/40 to-blue-900/30 rounded-xl border border-indigo-800/30 p-6">
        <h1 className="text-2xl font-bold text-white">Supplier RFQ & Quote Management</h1>
        <p className="text-indigo-300 text-sm mt-1">
          Build your supplier directory · create RFQs · track quotes · compare pricing side-by-side
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1 border border-gray-700/50">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'suppliers' && (
          <SuppliersTab suppliers={suppliers} setSuppliers={setSuppliers} />
        )}
        {activeTab === 'rfq' && (
          <RFQBuilderTab
            suppliers={suppliers} rfqs={rfqs} setRfqs={setRfqs}
            quotes={quotes} setQuotes={setQuotes}
          />
        )}
        {activeTab === 'quotes' && (
          <QuotesTab rfqs={rfqs} suppliers={suppliers} quotes={quotes} setQuotes={setQuotes} />
        )}
        {activeTab === 'compare' && (
          <CompareTab rfqs={rfqs} suppliers={suppliers} quotes={quotes} />
        )}
      </div>
    </div>
  );
}
