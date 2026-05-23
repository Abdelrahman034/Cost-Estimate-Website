// pages/ProjectsPage.jsx
//
// Landing page for all authenticated users.
// Shows the company's project list and lets any user create a new project.

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '@services/projectsApi';
import {
  FolderOpen, Plus, Search, Loader2, AlertCircle,
  MapPin, Calendar, User, ChevronRight, Building2,
} from 'lucide-react';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  ACTIVE:   'bg-green-50  text-green-700  border-green-200',
  ARCHIVED: 'bg-gray-50   text-gray-500   border-gray-200',
  WON:      'bg-blue-50   text-blue-700   border-blue-200',
  LOST:     'bg-red-50    text-red-500    border-red-200',
};

function StatusBadge({ status }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES.ACTIVE}`}>
      {status}
    </span>
  );
}

// ── New Project Modal ─────────────────────────────────────────────────────────

function NewProjectModal({ open, onClose, onCreate }) {
  const [form, setForm]     = useState({ name: '', location: '', owner: '', gc: '', bidDate: '', notes: '' });
  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const project = await projectsApi.create(form);
      onCreate(project);
      setForm({ name: '', location: '', owner: '', gc: '', bidDate: '', notes: '' });
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">New project</h2>
          <p className="text-sm text-gray-400 mt-0.5">Fill in the basic details — you can always edit them later.</p>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          {/* Project name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Project name <span className="text-red-500">*</span></label>
            <input
              name="name" value={form.name} onChange={handle}
              placeholder="Downtown Office Tower — HVAC"
              required autoFocus
              className="input w-full"
            />
          </div>

          {/* Location + Bid date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
              <input name="location" value={form.location} onChange={handle} placeholder="City, State" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bid date</label>
              <input type="date" name="bidDate" value={form.bidDate} onChange={handle} className="input w-full" />
            </div>
          </div>

          {/* Owner + GC */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Property owner</label>
              <input name="owner" value={form.owner} onChange={handle} placeholder="Owner name" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">General contractor</label>
              <input name="gc" value={form.gc} onChange={handle} placeholder="GC name" className="input w-full" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
            <textarea
              name="notes" value={form.notes} onChange={handle}
              placeholder="Any notes about this project…"
              rows={3}
              className="input w-full resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2">
              Cancel
            </button>
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

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, onClick }) {
  const bidDate = project.bidDate ? new Date(project.bidDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
  const estimateCount = project._count?.estimates ?? 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-5 rounded-xl border border-gray-200 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 flex items-start gap-4"
    >
      <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <FolderOpen size={18} className="text-blue-600" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-gray-900 truncate">{project.name}</span>
          <StatusBadge status={project.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
          {project.location && (
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {project.location}
            </span>
          )}
          {bidDate && (
            <span className="flex items-center gap-1">
              <Calendar size={11} /> Bid {bidDate}
            </span>
          )}
          {project.gc && (
            <span className="flex items-center gap-1">
              <Building2 size={11} /> {project.gc}
            </span>
          )}
          {project.createdBy && (
            <span className="flex items-center gap-1">
              <User size={11} /> {project.createdBy.firstName} {project.createdBy.lastName}
            </span>
          )}
        </div>

        <div className="mt-2 text-xs text-gray-400">
          {estimateCount} estimate{estimateCount !== 1 ? 's' : ''}
        </div>
      </div>

      <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState(false);

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

  // Client-side filter by search
  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.location?.toLowerCase().includes(search.toLowerCase()) ||
    p.gc?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreated = (project) => {
    setProjects(prev => [project, ...prev]);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {loading ? '…' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setModal(true)} className="btn-primary flex items-center gap-2 px-4 py-2">
          <Plus size={16} /> New project
        </button>
      </div>

      {/* Search */}
      {projects.length > 0 && (
        <div className="relative mb-5">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, location or GC…"
            className="input w-full pl-9"
          />
        </div>
      )}

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
              <p className="text-gray-400 text-sm mt-1">Create your first project to get started.</p>
              <button onClick={() => setModal(true)} className="btn-primary mt-4 px-5 py-2 flex items-center gap-2 mx-auto">
                <Plus size={15} /> New project
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 font-medium">No matches</p>
              <p className="text-gray-400 text-sm mt-1">Try a different search term.</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => navigate(`/projects/${project.id}`)}
            />
          ))}
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
