// pages/ProjectsPage.jsx
//
// Projects list — table view sorted by bid date (due date).
// Columns: Name · Type · Status · Submission · Due Date · Estimator ·
//          Area · Tonnage · Manhours · Bid Value · Margin %

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '@services/projectsApi';
import { useAuth } from '@contexts/AuthContext';
import {
  FolderOpen, Plus, Search, Loader2, AlertCircle,
  ChevronRight, X, Copy, Trash2,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCurrency = (v) =>
  v != null ? Number(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }) : '—';

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—';

const fmtNum = (v, dec = 0) =>
  v != null && !isNaN(v) ? Number(v).toLocaleString('en-US', { maximumFractionDigits: dec }) : '—';

// ── Badge components ──────────────────────────────────────────────────────────

const STATUS_META = {
  ACTIVE:   { label: 'Active',    cls: 'bg-green-50  text-green-700  border-green-200'  },
  WON:      { label: 'Won',       cls: 'bg-blue-50   text-blue-700   border-blue-200'   },
  LOST:     { label: 'Lost',      cls: 'bg-red-50    text-red-500    border-red-200'    },
  ON_HOLD:  { label: 'On Hold',   cls: 'bg-amber-50  text-amber-700  border-amber-200'  },
  ARCHIVED: { label: 'Archived',  cls: 'bg-gray-50   text-gray-500   border-gray-200'   },
};

const TYPE_META = {
  COMMERCIAL:   { label: 'Commercial',   cls: 'bg-sky-50    text-sky-700    border-sky-200'    },
  PUBLIC:       { label: 'Public',       cls: 'bg-amber-50  text-amber-700  border-amber-200'  },
  MULTI_FAMILY: { label: 'Multi-Family', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
};

const SUBMISSION_META = {
  'Pending':    'bg-yellow-50  text-yellow-700 border-yellow-200',
  'Submitted':  'bg-blue-50   text-blue-700   border-blue-200',
  'Awarded':    'bg-green-50  text-green-700  border-green-200',
  'Not Submitted': 'bg-gray-50 text-gray-500  border-gray-200',
  'Late':       'bg-red-50    text-red-600    border-red-200',
};

function Badge({ label, cls }) {
  return (
    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${cls}`}>
      {label}
    </span>
  );
}

// ── New Project Modal ─────────────────────────────────────────────────────────

function NewProjectModal({ open, onClose, onCreate }) {
  const [form, setForm]     = useState({
    name: '', location: '', gc: '', bidDate: '', notes: '',
    projectType: '', submissionStatus: 'Pending',
  });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
      };
      const project = await projectsApi.create(payload);
      onCreate(project);
      setForm({ name: '', location: '', gc: '', bidDate: '', notes: '', projectType: '', area: '', submissionStatus: 'Pending' });
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create project.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">New project</h2>
            <p className="text-sm text-gray-400 mt-0.5">Fill in the basic details — you can always edit them later.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name <span className="text-red-500">*</span></label>
            <input name="name" value={form.name} onChange={handle} placeholder="Downtown Office Tower" required autoFocus className="input w-full" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Project type <span className="text-red-500">*</span></label>
              <select name="projectType" value={form.projectType} onChange={handle} required className="input w-full">
                <option value="">— select —</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="PUBLIC">Public</option>
                <option value="MULTI_FAMILY">Multi-Family</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Submission status</label>
              <select name="submissionStatus" value={form.submissionStatus} onChange={handle} className="input w-full">
                <option value="Pending">Pending</option>
                <option value="Submitted">Submitted</option>
                <option value="Awarded">Awarded</option>
                <option value="Not Submitted">Not Submitted</option>
                <option value="Late">Late</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bid / Due date</label>
              <input type="date" name="bidDate" value={form.bidDate} onChange={handle} className="input w-full" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
              <input name="location" value={form.location} onChange={handle} placeholder="City, State" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">General contractor</label>
              <input name="gc" value={form.gc} onChange={handle} placeholder="GC name" className="input w-full" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handle} rows={2} className="input w-full resize-none" />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2 flex items-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin    = user?.role === 'ADMIN';
  const canCreate  = user?.role === 'ADMIN' || user?.role === 'ESTIMATOR';

  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState(false);
  const [cloningId, setCloningId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await projectsApi.list();
      setProjects(result.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreated = (project) => setProjects(prev => [project, ...prev]);

  // Duplicate a bid — clones the project + all estimates into a new draft
  const handleClone = useCallback(async (projectId) => {
    setCloningId(projectId);
    try {
      const copy = await projectsApi.clone(projectId);
      setProjects(prev => [copy, ...prev]);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not duplicate project.');
    } finally {
      setCloningId(null);
    }
  }, []);

  // Delete a project — used to undo an accidental duplicate, or remove any bid
  const handleDelete = useCallback(async (project) => {
    const ok = window.confirm(`Delete "${project.name}"? This permanently removes the project and all its estimates. This cannot be undone.`);
    if (!ok) return;
    setDeletingId(project.id);
    try {
      await projectsApi.remove(project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete project.');
    } finally {
      setDeletingId(null);
    }
  }, []);

  // Quick inline field update helper
  const handleFieldChange = useCallback(async (projectId, field, value) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, [field]: value || null } : p));
    try {
      await projectsApi.update(projectId, { [field]: value || null });
    } catch {
      load();
    }
  }, [load]);

  const handleStatusChange     = useCallback((id, v) => handleFieldChange(id, 'status',           v), [handleFieldChange]);
  const handleTypeChange       = useCallback((id, v) => handleFieldChange(id, 'projectType',      v), [handleFieldChange]);
  const handleSubmissionChange = useCallback((id, v) => handleFieldChange(id, 'submissionStatus', v), [handleFieldChange]);

  // Filter + keep server-side sort (bidDate asc)
  const filtered = useMemo(() => {
    if (!search) return projects;
    const q = search.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.location?.toLowerCase().includes(q) ||
      p.gc?.toLowerCase().includes(q) ||
      p.createdBy?.firstName?.toLowerCase().includes(q) ||
      p.createdBy?.lastName?.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const estimatorName = (p) => {
    if (!p.createdBy) return '—';
    const { firstName, lastName, email } = p.createdBy;
    return firstName ? `${firstName} ${lastName ?? ''}`.trim() : email;
  };

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? 'All Projects' : 'My Projects'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? '…' : `${projects.length} project${projects.length !== 1 ? 's' : ''} · sorted by bid date`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects…"
              className="input pl-8 w-56"
            />
          </div>
          {canCreate && (
            <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2">
              <Plus size={16} /> New project
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={18} /> {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen size={40} className="mx-auto text-gray-200 mb-3" />
          {projects.length === 0 ? (
            <>
              <p className="text-gray-500 font-medium">No projects yet</p>
              {canCreate ? (
                <>
                  <p className="text-gray-400 text-sm mt-1">Create your first project to get started.</p>
                  <button onClick={() => setModal(true)} className="btn-primary mt-4 px-5 py-2 flex items-center gap-2 mx-auto">
                    <Plus size={15} /> New project
                  </button>
                </>
              ) : (
                <p className="text-gray-400 text-sm mt-1">You haven't been assigned to any projects yet.</p>
              )}
            </>
          ) : (
            <>
              <p className="text-gray-500 font-medium">No matches</p>
              <p className="text-gray-400 text-sm mt-1">Try a different search term.</p>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Project</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Type</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Status</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Submission</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Due Date ↑</th>
                  <th className="text-left px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Estimator</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Tonnage</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Man-hrs</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Bid Value</th>
                  <th className="text-right px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Margin %</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Actions</th>
                  <th className="px-3 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => {
                  const statusMeta     = STATUS_META[p.status] ?? STATUS_META.ACTIVE;
                  const typeMeta       = p.projectType ? TYPE_META[p.projectType] : null;
                  const subCls         = p.submissionStatus ? (SUBMISSION_META[p.submissionStatus] ?? 'bg-gray-50 text-gray-500 border-gray-200') : null;
                  const marginDisplay = p.marginPct != null
                    ? `${p.marginPct.toFixed(1)}%`
                    : '—';

                  return (
                    <tr
                      key={p.id}
                      onClick={() => navigate(`/projects/${p.id}`)}
                      className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                    >
                      {/* Project name + location */}
                      <td className="px-4 py-3 min-w-[180px]">
                        <div className="font-semibold text-gray-900 truncate max-w-[220px]">{p.name}</div>
                        {p.location && <div className="text-xs text-gray-400 truncate">{p.location}</div>}
                      </td>

                      {/* Type — inline dropdown */}
                      <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <select
                          value={p.projectType || ''}
                          onChange={e => handleTypeChange(p.id, e.target.value)}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border cursor-pointer appearance-none text-center focus:outline-none ${typeMeta ? typeMeta.cls : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                          title="Change project type"
                        >
                          <option value="">— type —</option>
                          {Object.entries(TYPE_META).map(([val, meta]) => (
                            <option key={val} value={val}>{meta.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Status — inline quick-change dropdown */}
                      <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <select
                          value={p.status}
                          onChange={e => handleStatusChange(p.id, e.target.value)}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border cursor-pointer appearance-none text-center ${statusMeta.cls} focus:outline-none`}
                          title="Change project status"
                        >
                          {Object.entries(STATUS_META).map(([val, meta]) => (
                            <option key={val} value={val}>{meta.label}</option>
                          ))}
                        </select>
                      </td>

                      {/* Submission — inline dropdown */}
                      <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <select
                          value={p.submissionStatus || ''}
                          onChange={e => handleSubmissionChange(p.id, e.target.value)}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border cursor-pointer appearance-none text-center focus:outline-none ${subCls || 'bg-gray-50 text-gray-400 border-gray-200'}`}
                          title="Change submission status"
                        >
                          <option value="">— status —</option>
                          {Object.keys(SUBMISSION_META).map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                      </td>

                      {/* Due date */}
                      <td className="px-3 py-3 whitespace-nowrap text-gray-700 tabular-nums">
                        {fmtDate(p.bidDate)}
                      </td>

                      {/* Estimator */}
                      <td className="px-3 py-3 whitespace-nowrap text-gray-600 max-w-[120px] truncate">
                        {estimatorName(p)}
                      </td>

                      {/* Tonnage */}
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                        {p.totalTonnage != null ? fmtNum(p.totalTonnage, 1) : '—'}
                      </td>

                      {/* Man-hours */}
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700">
                        {p.totalManhours != null ? fmtNum(p.totalManhours, 0) : '—'}
                      </td>

                      {/* Bid value (from SUMMARY estimate) */}
                      <td className="px-3 py-3 text-right tabular-nums">
                        {p.bidValue != null ? (
                          <div>
                            <div className="font-semibold text-emerald-700">{fmtCurrency(p.bidValue)}</div>
                            {p.directCost != null && (
                              <div className="text-[10px] text-gray-400">cost {fmtCurrency(p.directCost)}</div>
                            )}
                          </div>
                        ) : (
                          p.directCost != null
                            ? <span className="text-gray-500 text-xs">{fmtCurrency(p.directCost)}</span>
                            : <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Margin % */}
                      <td className="px-3 py-3 text-right tabular-nums">
                        {marginDisplay !== '—' ? (
                          <span className={`text-sm font-semibold ${parseFloat(marginDisplay) >= 15 ? 'text-emerald-600' : parseFloat(marginDisplay) >= 10 ? 'text-amber-600' : 'text-red-500'}`}>
                            {marginDisplay}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Actions: Duplicate + Delete */}
                      <td className="px-3 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleClone(p.id)}
                            disabled={cloningId === p.id || deletingId === p.id}
                            title="Duplicate this bid"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors disabled:opacity-50"
                          >
                            {cloningId === p.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Copy size={14} />}
                            <span>Duplicate</span>
                          </button>
                          <button
                            onClick={() => handleDelete(p)}
                            disabled={deletingId === p.id || cloningId === p.id}
                            title="Delete this project"
                            className="inline-flex items-center justify-center p-1.5 rounded-md text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                          >
                            {deletingId === p.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Trash2 size={14} />}
                          </button>
                        </div>
                      </td>

                      {/* Arrow */}
                      <td className="px-3 py-3">
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewProjectModal
        open={modal}
        onClose={() => setModal(false)}
        onCreate={handleCreated}
      />
    </div>
  );
}
