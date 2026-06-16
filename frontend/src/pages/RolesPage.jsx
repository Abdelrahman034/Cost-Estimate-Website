// pages/RolesPage.jsx
// Owner-only page for managing custom roles and their tab permissions.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Plus, Trash2, Save, Loader2, AlertCircle,
  ChevronDown, ChevronUp, Check, X, RefreshCw, Users,
} from 'lucide-react';
import api from '@services/api';
import { ALL_PERMISSIONS } from '@config/navigation';
import toast from 'react-hot-toast';

// ── Role card ─────────────────────────────────────────────────────────────────

function RoleCard({ role, onSave, onDelete }) {
  const [expanded,    setExpanded]    = useState(false);
  const [name,        setName]        = useState(role.name);
  const [permissions, setPermissions] = useState(role.permissions || []);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const dirty = name !== role.name || JSON.stringify(permissions) !== JSON.stringify(role.permissions || []);

  const togglePerm = (key) => {
    setPermissions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleAll = () => {
    const allKeys = ALL_PERMISSIONS.map(p => p.key);
    setPermissions(permissions.length === allKeys.length ? [] : allKeys);
  };

  const save = async () => {
    if (!name.trim()) { toast.error('Role name is required.'); return; }
    setSaving(true);
    try {
      await onSave(role.id, { name: name.trim(), permissions });
      toast.success('Role saved');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not save role.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete role "${role.name}"? Users assigned to this role will lose all tab access.`)) return;
    setDeleting(true);
    try {
      await onDelete(role.id);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not delete role.');
      setDeleting(false);
    }
  };

  const allSelected = permissions.length === ALL_PERMISSIONS.length;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Shield size={16} className="text-blue-600" />
        </div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-0 border-b border-transparent focus:border-blue-400 focus:outline-none py-0.5 transition-colors"
          placeholder="Role name"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          {role._count?.users > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Users size={12} /> {role._count.users}
            </span>
          )}
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          )}
          <button
            onClick={remove}
            disabled={deleting}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete role"
          >
            {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Permission pills — collapsed summary */}
      {!expanded && (
        <div className="px-5 pb-4 flex flex-wrap gap-1.5">
          {permissions.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No tabs assigned</span>
          ) : permissions.length === ALL_PERMISSIONS.length ? (
            <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">All tabs</span>
          ) : (
            permissions.map(key => {
              const perm = ALL_PERMISSIONS.find(p => p.key === key);
              return perm ? (
                <span key={key} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                  {perm.label}
                </span>
              ) : null;
            })
          )}
          <button onClick={() => setExpanded(true)} className="text-xs text-blue-600 hover:underline ml-1">
            Edit
          </button>
        </div>
      )}

      {/* Permission toggles — expanded */}
      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Tab Access</p>
            <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline">
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ALL_PERMISSIONS.map(({ key, label }) => {
              const on = permissions.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => togglePerm(key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
                    on
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-white border border-gray-300'}`}>
                    {on && <Check size={11} className="text-white" />}
                  </div>
                  <span className="truncate text-xs font-medium">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create role form ──────────────────────────────────────────────────────────

function CreateRoleForm({ onCreate }) {
  const [name,    setName]    = useState('');
  const [saving,  setSaving]  = useState(false);
  const [open,    setOpen]    = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onCreate(name.trim());
      setName('');
      setOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create role.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors text-sm w-full"
      >
        <Plus size={16} /> New role
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 bg-white border border-blue-300 rounded-2xl px-4 py-3 shadow-sm">
      <Plus size={16} className="text-blue-500 flex-shrink-0" />
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Role name (e.g. Estimator, Engineer)"
        className="flex-1 text-sm bg-transparent border-0 focus:outline-none text-gray-900"
      />
      <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
        <X size={15} />
      </button>
      <button
        type="submit"
        disabled={saving || !name.trim()}
        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : 'Create'}
      </button>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const [roles,   setRoles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/company/roles');
      setRoles(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (name) => {
    const { data } = await api.post('/company/roles', { name, permissions: [] });
    setRoles(prev => [...prev, data]);
    toast.success(`Role "${name}" created`);
  };

  const handleSave = async (id, updates) => {
    const { data } = await api.patch(`/company/roles/${id}`, updates);
    setRoles(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
  };

  const handleDelete = async (id) => {
    await api.delete(`/company/roles/${id}`);
    setRoles(prev => prev.filter(r => r.id !== id));
    toast.success('Role deleted');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Roles</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Define roles and choose which tabs each role can access.
          </p>
        </div>
        <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Role list */}
      <div className="space-y-3">
        {roles.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-400">
            <Shield size={32} className="mx-auto mb-3 text-gray-200" />
            No roles yet. Create one to start inviting team members.
          </div>
        )}
        {roles.map(role => (
          <RoleCard
            key={role.id}
            role={role}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        ))}
        <CreateRoleForm onCreate={handleCreate} />
      </div>
    </div>
  );
}
