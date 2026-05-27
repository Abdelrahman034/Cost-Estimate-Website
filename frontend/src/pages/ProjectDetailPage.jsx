// pages/ProjectDetailPage.jsx
//
// Shows one project's details and the status of each estimation module.
// Clicking a module card navigates to that estimator WITH ?projectId= so the
// module knows which project to load/save from.

import React, { useEffect, useState, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsApi } from '@services/projectsApi';
import { estimatesApi } from '@services/estimatesApi';
import api from '@services/api';
import { useAuth } from '@contexts/AuthContext';
import { SettingsContext } from '@contexts/SettingsContext';
import ProjectSettingsOverride from '@components/ProjectSettingsOverride';
import {
  ArrowLeft, Building2, Wind, Gauge, Fan, Zap, BarChart3,
  MapPin, Calendar, User, Briefcase, ChevronRight,
  Edit3, Loader2, AlertCircle, CheckCircle2, Clock,
  Layers, Trash2, X, Save, Users, UserPlus,
} from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const currency = (val) => {
  if (val == null) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

const fmtRelative = (iso) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

// ── Module registry ────────────────────────────────────────────────────────────

const MODULES = [
  { key: 'UNIT_SCHEDULE',     label: 'Unit Schedule',     description: 'AHUs, RTUs, split systems, VRF',   route: '/unit-schedule', icon: Building2, color: 'blue'    },
  { key: 'METAL_DUCT',        label: 'Metal Duct',        description: 'Rectangular & round ductwork',     route: '/duct',          icon: Wind,      color: 'indigo'  },
  { key: 'DIFFUSER_SCHEDULE', label: 'Diffuser Schedule', description: 'Supply & return diffusers',        route: '/diffuser',      icon: Gauge,     color: 'violet'  },
  { key: 'FAN_SCHEDULE',      label: 'Fan Schedule',      description: 'Exhaust & supply fans',            route: '/fan-schedule',  icon: Fan,       color: 'sky'     },
  { key: 'ELECTRIC_HEAT',     label: 'Electric Heat',     description: 'Unit heaters & strip heaters',     route: '/electric-heat', icon: Zap,       color: 'amber'   },
  { key: 'SUMMARY',           label: 'Bid Summary',       description: 'Rolled-up project totals',         route: '/summary',       icon: BarChart3, color: 'emerald' },
];

const COLOR_CLASSES = {
  blue:    { bg: 'bg-blue-50',    border: 'border-blue-100',   icon: 'text-blue-600'    },
  indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-100', icon: 'text-indigo-600'  },
  violet:  { bg: 'bg-violet-50',  border: 'border-violet-100', icon: 'text-violet-600'  },
  sky:     { bg: 'bg-sky-50',     border: 'border-sky-100',    icon: 'text-sky-600'     },
  amber:   { bg: 'bg-amber-50',   border: 'border-amber-100',  icon: 'text-amber-600'   },
  emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100',icon: 'text-emerald-600' },
};

const STATUS_STYLES = {
  ACTIVE:   'bg-green-50  text-green-700  border-green-200',
  WON:      'bg-blue-50   text-blue-700   border-blue-200',
  LOST:     'bg-red-50    text-red-500    border-red-200',
  ON_HOLD:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  ARCHIVED: 'bg-gray-50   text-gray-500   border-gray-200',
};

// ── Edit Project Modal ─────────────────────────────────────────────────────────

function EditProjectModal({ project, open, onClose, onSaved }) {
  const [form, setForm]     = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    if (project && open) {
      setForm({
        name:     project.name     || '',
        location: project.location || '',
        owner:    project.owner    || '',
        gc:       project.gc       || '',
        bidDate:  project.bidDate ? project.bidDate.slice(0, 10) : '',
        notes:    project.notes    || '',
        status:   project.status   || 'ACTIVE',
      });
      setError('');
    }
  }, [project, open]);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updated = await projectsApi.update(project.id, form);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Edit project</h2>
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
            <input name="name" value={form.name || ''} onChange={handle} required className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
              <input name="location" value={form.location || ''} onChange={handle} placeholder="City, State" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bid date</label>
              <input type="date" name="bidDate" value={form.bidDate || ''} onChange={handle} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Property owner</label>
              <input name="owner" value={form.owner || ''} onChange={handle} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">General contractor</label>
              <input name="gc" value={form.gc || ''} onChange={handle} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <select name="status" value={form.status || 'ACTIVE'} onChange={handle} className="input w-full">
              <option value="ACTIVE">Active</option>
              <option value="WON">Won</option>
              <option value="LOST">Lost</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea name="notes" value={form.notes || ''} onChange={handle} rows={3} className="input w-full resize-none" />
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2 flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Module Tracker ────────────────────────────────────────────────────────────

function ModuleTracker({ modules, estimateByModule, projectId, onOpen }) {
  const savedCount = modules.filter(m => estimateByModule[m.key]).length;
  const pct        = Math.round((savedCount / modules.length) * 100);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">

      {/* Progress header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-700">Estimation modules</h2>
          <span className="text-sm font-semibold text-gray-900">{savedCount}/{modules.length} complete</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: pct === 100
                ? 'linear-gradient(90deg,#22c55e,#16a34a)'
                : 'linear-gradient(90deg,#3b82f6,#6366f1)',
            }}
          />
        </div>
      </div>

      {/* Module rows */}
      <ul className="divide-y divide-gray-50">
        {modules.map(mod => {
          const Icon     = mod.icon;
          const colors   = COLOR_CLASSES[mod.color];
          const estimate = estimateByModule[mod.key] || null;
          const saved    = !!estimate;
          const total    = estimate ? currency(estimate.totalCost)     : null;
          const mat      = estimate ? currency(estimate.totalMaterial) : null;
          const lab      = estimate ? currency(estimate.totalLabor)    : null;
          const when     = estimate ? fmtRelative(estimate.updatedAt)  : null;

          return (
            <li
              key={mod.key}
              className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/60 transition-colors group"
            >
              {/* Status dot */}
              <div className="flex-shrink-0">
                {saved
                  ? <CheckCircle2 size={16} className="text-green-500" />
                  : <div className="w-4 h-4 rounded-full border-2 border-gray-200" />}
              </div>

              {/* Icon */}
              <div className={`w-8 h-8 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} className={colors.icon} />
              </div>

              {/* Label + description */}
              <div className="w-40 flex-shrink-0">
                <div className="text-sm font-semibold text-gray-900">{mod.label}</div>
                <div className="text-xs text-gray-400 truncate">{mod.description}</div>
              </div>

              {/* Totals */}
              <div className="flex-1 flex items-center gap-6 min-w-0">
                {saved && total ? (
                  <>
                    <span className="text-sm font-bold text-gray-900 w-24 text-right tabular-nums">{total}</span>
                    <span className="text-xs text-gray-400 tabular-nums hidden sm:block">
                      Mat: {mat ?? '—'}
                    </span>
                    <span className="text-xs text-gray-400 tabular-nums hidden sm:block">
                      Lab: {lab ?? '—'}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-gray-300 italic">Not started</span>
                )}
              </div>

              {/* Last saved */}
              <div className="text-xs text-gray-400 w-20 text-right flex-shrink-0 hidden md:block">
                {when ? (
                  <span className="flex items-center justify-end gap-1">
                    <Clock size={10} /> {when}
                  </span>
                ) : null}
              </div>

              {/* Open button */}
              <button
                onClick={() => onOpen(mod)}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
              >
                {saved ? 'Open' : 'Start'}
                <ChevronRight size={12} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Project Members Panel (admin only) ────────────────────────────────────────

function ProjectMembersPanel({ projectId, initialMembers = [] }) {
  const [members,    setMembers]    = useState(initialMembers);
  const [allUsers,   setAllUsers]   = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [adding,     setAdding]     = useState(false);
  const [removing,   setRemoving]   = useState(null);
  const [error,      setError]      = useState('');

  useEffect(() => {
    api.get('/company/users').then(r => setAllUsers(r.data)).catch(() => {});
  }, []);

  useEffect(() => { setMembers(initialMembers); }, [initialMembers]);

  const memberIds = new Set(members.map(m => m.user.id));
  const available = allUsers.filter(u => !memberIds.has(u.id));

  const handleAdd = async () => {
    if (!selectedId) return;
    setAdding(true);
    setError('');
    try {
      const newMember = await projectsApi.addMember(projectId, selectedId);
      setMembers(prev => [...prev, newMember]);
      setSelectedId('');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not add member.');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId) => {
    setRemoving(userId);
    setError('');
    try {
      await projectsApi.removeMember(projectId, userId);
      setMembers(prev => prev.filter(m => m.user.id !== userId));
    } catch (err) {
      setError(err.response?.data?.error || 'Could not remove member.');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden mt-6">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
        <Users size={16} className="text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">Project members</h2>
        <span className="ml-1 text-xs text-gray-400">— who can access this project</span>
      </div>

      {error && (
        <div className="mx-5 mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {members.length === 0 ? (
        <div className="px-5 py-6 text-sm text-gray-400 text-center">
          No members assigned yet. Add team members below so they can see this project.
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {members.map(m => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                {m.user.firstName?.[0]?.toUpperCase() || m.user.email[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {m.user.firstName && m.user.lastName ? `${m.user.firstName} ${m.user.lastName}` : m.user.email}
                </div>
                <div className="text-xs text-gray-400 truncate">{m.user.email}</div>
              </div>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                m.user.role === 'ADMIN'     ? 'bg-purple-50 text-purple-700 border-purple-200' :
                m.user.role === 'ESTIMATOR' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                              'bg-gray-50 text-gray-600 border-gray-200'
              }`}>{m.user.role}</span>
              <button
                onClick={() => handleRemove(m.user.id)}
                disabled={removing === m.user.id}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                title="Remove from project"
              >
                {removing === m.user.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
            </li>
          ))}
        </ul>
      )}

      {available.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-2">
          <select value={selectedId} onChange={e => setSelectedId(e.target.value)} className="input flex-1 text-sm">
            <option value="">Select a team member to add…</option>
            {available.map(u => (
              <option key={u.id} value={u.id}>
                {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email} ({u.role})
              </option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedId || adding}
            className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4 disabled:opacity-50"
          >
            {adding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Add
          </button>
        </div>
      )}

      {available.length === 0 && allUsers.length > 0 && (
        <div className="px-5 py-4 border-t border-gray-100 text-sm text-gray-400 text-center">
          All team members are already on this project.
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadProjectSettings } = useContext(SettingsContext);

  const [project,   setProject]   = useState(null);
  const [estimates, setEstimates] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [editOpen,  setEditOpen]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [proj, ests] = await Promise.all([
        projectsApi.get(id),
        estimatesApi.list(id),
      ]);
      setProject(proj);
      setEstimates(ests);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load project.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Load this project's settings overrides into context when entering the page.
  // Clearing is handled automatically by SettingsContext's URL watcher.
  useEffect(() => {
    if (id) loadProjectSettings(id);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map estimates by module key for quick lookup
  const estimateByModule = {};
  estimates.forEach(e => { estimateByModule[e.module] = e; });

  const grandTotal = estimates.reduce((sum, e) => sum + (parseFloat(e.totalCost) || 0), 0);
  const savedCount = estimates.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader2 size={32} className="animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-10">
        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={18} /> {error}
        </div>
      </div>
    );
  }

  const bidDateFormatted = project.bidDate ? fmtDate(project.bidDate) : null;

  return (
    <div className="max-w-5xl mx-auto">

      {/* Back nav */}
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mb-5 transition-colors"
      >
        <ArrowLeft size={14} /> All projects
      </button>

      {/* Project header card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0">
              <Layers size={22} className="text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[project.status] || STATUS_STYLES.ACTIVE}`}>
                  {project.status}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-sm text-gray-500">
                {project.location && (
                  <span className="flex items-center gap-1.5"><MapPin size={13} className="text-gray-400" /> {project.location}</span>
                )}
                {bidDateFormatted && (
                  <span className="flex items-center gap-1.5"><Calendar size={13} className="text-gray-400" /> Bid {bidDateFormatted}</span>
                )}
                {project.owner && (
                  <span className="flex items-center gap-1.5"><User size={13} className="text-gray-400" /> {project.owner}</span>
                )}
                {project.gc && (
                  <span className="flex items-center gap-1.5"><Briefcase size={13} className="text-gray-400" /> {project.gc}</span>
                )}
              </div>
              {project.notes && (
                <p className="mt-2 text-sm text-gray-400 max-w-lg">{project.notes}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <Edit3 size={13} /> Edit
          </button>
        </div>

        {savedCount > 0 && (
          <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {savedCount} module{savedCount !== 1 ? 's' : ''} estimated
            </span>
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase tracking-wide font-medium">Total bid</div>
              <div className="text-2xl font-bold text-gray-900">
                {grandTotal > 0 ? currency(grandTotal) : '—'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Project-level settings overrides */}
      <div className="mb-6">
        <ProjectSettingsOverride projectId={project.id} />
      </div>

      {/* Module tracker */}
      <ModuleTracker
        modules={MODULES}
        estimateByModule={estimateByModule}
        projectId={project.id}
        onOpen={(mod) => navigate(`${mod.route}?projectId=${project.id}`)}
      />

      {/* Member management — admin only */}
      {user?.role === 'ADMIN' && (
        <ProjectMembersPanel
          projectId={project.id}
          initialMembers={project.members || []}
        />
      )}

      {/* Edit modal */}
      <EditProjectModal
        project={project}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setProject(updated)}
      />
    </div>
  );
}
