import React, { useState, useEffect } from 'react';
import { Menu, Settings, FolderOpen, ChevronDown, Save, FolderInput, Trash2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { projectsApi } from '@services/api';

export default function Header({ onMenuClick, projectInfo, onProjectInfoChange, onProjectLoad }) {
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showLoadModal, setShowLoadModal]       = useState(false);
  const [draft, setDraft]         = useState(projectInfo);
  const [saving, setSaving]       = useState(false);
  const [savedProjects, setSavedProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const isNewProject = !projectInfo._dbId;

  // ── Save / Update project ───────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      let saved;
      if (draft._dbId) {
        // Update existing
        const res = await projectsApi.update(draft._dbId, draft);
        saved = res.data;
      } else {
        // Create new
        const res = await projectsApi.create(draft);
        saved = res.data;
      }
      const updated = {
        ...draft,
        _dbId: saved.id,
        projectName: saved.name,
        location:    saved.location,
        owner:       saved.owner,
        gc:          saved.gc,
        bidDate:     saved.bid_date,
        companyName: saved.company_name,
        companyAddress: saved.company_address,
        companyPhone:   saved.company_phone,
        companyEmail:   saved.company_email,
      };
      onProjectInfoChange(updated);
      setShowProjectModal(false);
      toast.success(draft._dbId ? 'Project updated' : 'Project saved to database');
    } catch (err) {
      toast.error('Save failed: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }

  // ── Load projects list ──────────────────────────────────────────────────────
  async function openLoadModal() {
    setLoadingProjects(true);
    setShowLoadModal(true);
    try {
      const res = await projectsApi.getAll();
      setSavedProjects(res.data);
    } catch {
      toast.error('Could not load projects. Is the backend running?');
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadProject(proj) {
    try {
      const res = await projectsApi.getById(proj.id);
      const p   = res.data;
      const loaded = {
        _dbId:          p.id,
        projectName:    p.name,
        location:       p.location    || '',
        owner:          p.owner       || '',
        gc:             p.gc          || '',
        bidDate:        p.bid_date    || '',
        companyName:    p.company_name    || '',
        companyAddress: p.company_address || '',
        companyPhone:   p.company_phone   || '',
        companyEmail:   p.company_email   || '',
      };
      onProjectInfoChange(loaded);
      if (onProjectLoad) onProjectLoad(p);
      setShowLoadModal(false);
      toast.success(`Loaded: ${p.name}`);
    } catch {
      toast.error('Failed to load project');
    }
  }

  async function deleteProject(id, name, e) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await projectsApi.delete(id);
      setSavedProjects((prev) => prev.filter((p) => p.id !== id));
      toast.success('Project deleted');
    } catch {
      toast.error('Delete failed');
    }
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 z-10">
        <button onClick={onMenuClick} className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100">
          <Menu size={20} />
        </button>

        {/* Project name */}
        <button
          onClick={() => { setDraft(projectInfo); setShowProjectModal(true); }}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
        >
          <FolderOpen size={16} className="text-blue-500" />
          <span className="font-medium">
            {projectInfo.projectName || 'New Project — click to set up'}
          </span>
          <ChevronDown size={14} className="text-gray-400" />
        </button>

        {/* DB saved indicator */}
        {projectInfo._dbId && (
          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full border border-green-200">
            <Check size={11} /> Saved
          </span>
        )}

        <div className="flex-1" />

        {/* Bid date badge */}
        {projectInfo.bidDate && (
          <span className="bg-amber-50 text-amber-700 px-2 py-1 rounded text-xs font-medium border border-amber-200">
            Bid: {projectInfo.bidDate}
          </span>
        )}

        {/* Action buttons */}
        <button
          onClick={openLoadModal}
          className="btn-secondary flex items-center gap-1.5 text-sm py-1.5"
          title="Load a saved project"
        >
          <FolderInput size={15} /> Load
        </button>
        <button
          onClick={() => { setDraft(projectInfo); setShowProjectModal(true); }}
          className="btn-primary flex items-center gap-1.5 text-sm py-1.5"
          title="Save project to database"
        >
          <Save size={15} /> {projectInfo._dbId ? 'Update' : 'Save'}
        </button>
      </header>

      {/* ── Project Info / Save Modal ─────────────────────────────────────── */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Project Information</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {draft._dbId ? 'Update project in database' : 'Fill in project details and save to database'}
                </p>
              </div>
              {draft._dbId && (
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">ID #{draft._dbId}</span>
              )}
            </div>

            <div className="p-6 grid grid-cols-2 gap-4">
              {[
                { key: 'projectName', label: 'Project Name *', placeholder: 'Downtown Office HVAC' },
                { key: 'location',    label: 'Location',        placeholder: '123 Main St, City, State' },
                { key: 'owner',       label: 'Owner',           placeholder: 'Property Owner Name' },
                { key: 'gc',          label: 'General Contractor', placeholder: 'GC Company Name' },
                { key: 'bidDate',     label: 'Bid Date',        placeholder: '', type: 'date' },
                { key: 'companyName', label: 'Your Company',    placeholder: 'HVAC Corp' },
                { key: 'companyPhone', label: 'Company Phone',  placeholder: '(555) 000-0000' },
                { key: 'companyEmail', label: 'Company Email',  placeholder: 'estimating@yourco.com' },
              ].map(({ key, label, placeholder, type = 'text' }) => (
                <div key={key}>
                  <label className="label">{label}</label>
                  <input
                    type={type}
                    className="input"
                    placeholder={placeholder}
                    value={draft[key] || ''}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="label">Company Address</label>
                <input
                  className="input"
                  placeholder="123 Industrial Blvd, City, State 00000"
                  value={draft.companyAddress || ''}
                  onChange={(e) => setDraft({ ...draft, companyAddress: e.target.value })}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
              <button className="btn-secondary" onClick={() => setShowProjectModal(false)}>Cancel</button>
              <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
                <Save size={15} />
                {saving ? 'Saving...' : draft._dbId ? 'Update Project' : 'Save to Database'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Load Projects Modal ───────────────────────────────────────────── */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Load Project</h2>
              <p className="text-sm text-gray-500 mt-0.5">Select a saved project from your database</p>
            </div>

            <div className="p-4 max-h-96 overflow-y-auto">
              {loadingProjects && (
                <div className="text-center py-8 text-gray-400">
                  <div className="w-6 h-6 spinner mx-auto mb-2" />
                  Loading...
                </div>
              )}
              {!loadingProjects && savedProjects.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <FolderOpen size={32} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm">No saved projects yet.</p>
                  <p className="text-xs mt-1">Save a project first using the Save button.</p>
                </div>
              )}
              {savedProjects.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => loadProject(proj)}
                  className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all mb-2 group"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">
                    #{proj.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{proj.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                      {proj.location && <span>{proj.location}</span>}
                      {proj.bid_date && <span>Bid: {proj.bid_date}</span>}
                      <span>{proj.estimate_count} estimate(s)</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 group-hover:text-blue-400 flex-shrink-0">
                    {new Date(proj.updated_at).toLocaleDateString()}
                  </div>
                  <button
                    onClick={(e) => deleteProject(proj.id, proj.name, e)}
                    className="text-gray-200 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button className="btn-secondary" onClick={() => setShowLoadModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
