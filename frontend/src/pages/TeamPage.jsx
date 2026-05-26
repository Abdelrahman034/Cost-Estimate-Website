// pages/TeamPage.jsx
//
// Admin-only page for managing team members and sending invites.
//
// Features:
//   • List all active users in the company
//   • Send invite by email + role
//   • Copy invite link to clipboard
//   • Revoke a pending invite
//   • See pending / accepted invite history

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Mail, Plus, Copy, Trash2, Check, Loader2,
  AlertCircle, Clock, Shield, UserCheck, RefreshCw, X,
} from 'lucide-react';
import api from '@services/api';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_BADGE = {
  ADMIN:     'bg-purple-50 text-purple-700 border-purple-200',
  ESTIMATOR: 'bg-blue-50 text-blue-700 border-blue-200',
  VIEWER:    'bg-gray-50 text-gray-600 border-gray-200',
};

const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const fmtExpiry = (iso) => {
  if (!iso) return '';
  const diff = new Date(iso) - Date.now();
  if (diff < 0) return 'Expired';
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `Expires in ${hours}h`;
  return `Expires in ${Math.floor(hours / 24)}d`;
};

function RoleBadge({ role }) {
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${ROLE_BADGE[role] || ROLE_BADGE.VIEWER}`}>
      {role}
    </span>
  );
}

// ── Invite form modal ─────────────────────────────────────────────────────────

function InviteModal({ open, onClose, onSent }) {
  const [form, setForm]   = useState({ email: '', role: 'ESTIMATOR' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await api.post('/company/invites', form);
      onSent(data);
      setForm({ email: '', role: 'ESTIMATOR' });
      onClose();
      toast.success(`Invite sent to ${form.email}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send invite.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Invite team member</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address <span className="text-red-500">*</span>
            </label>
            <input
              type="email" name="email" value={form.email} onChange={handle}
              required autoFocus className="input w-full" placeholder="jane@company.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <select name="role" value={form.role} onChange={handle} className="input w-full">
              <option value="ESTIMATOR">Estimator — can create and edit estimates</option>
              <option value="VIEWER">Viewer — read-only access</option>
              <option value="ADMIN">Admin — full access including team management</option>
            </select>
          </div>
          <p className="text-xs text-gray-400">
            The invite link is valid for 7 days. Share it with the employee — they'll set their own password.
          </p>
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary px-4 py-2">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary px-5 py-2 flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              {saving ? 'Sending…' : 'Generate invite link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const [users,    setUsers]    = useState([]);
  const [invites,  setInvites]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [copied,   setCopied]   = useState(null); // invite id that was just copied

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [u, i] = await Promise.all([
        api.get('/company/users'),
        api.get('/company/invites'),
      ]);
      setUsers(u.data);
      setInvites(i.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load team data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyInviteLink = (invite) => {
    const link = `${window.location.origin}/invite/${invite.token}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(invite.id);
      toast.success('Invite link copied to clipboard');
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const revokeInvite = async (id) => {
    if (!confirm('Revoke this invite? The link will stop working.')) return;
    try {
      await api.delete(`/company/invites/${id}`);
      setInvites(prev => prev.filter(i => i.id !== id));
      toast.success('Invite revoked');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not revoke invite.');
    }
  };

  const pendingInvites = invites.filter(i => i.status === 'PENDING');

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
    <div className="max-w-4xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-400 mt-0.5">{users.length} member{users.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="btn-secondary flex items-center gap-1.5 text-sm py-1.5">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={() => setInviteOpen(true)} className="btn-primary flex items-center gap-1.5 text-sm py-1.5">
            <Plus size={14} /> Invite employee
          </button>
        </div>
      </div>

      {/* Active members */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-700">Active members</h2>
        </div>
        {users.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">No users yet.</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {users.map(u => (
              <li key={u.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                  {u.firstName?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{u.email}</div>
                </div>
                <RoleBadge role={u.role} />
                <div className="text-xs text-gray-300 flex items-center gap-1 hidden sm:flex">
                  <Clock size={11} />
                  {u.lastLoginAt ? fmtDate(u.lastLoginAt) : 'Never logged in'}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pending invites */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-700">Pending invites</h2>
            {pendingInvites.length > 0 && (
              <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                {pendingInvites.length}
              </span>
            )}
          </div>
        </div>

        {pendingInvites.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <UserCheck size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No pending invites. Click "Invite employee" to get started.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {pendingInvites.map(inv => (
              <li key={inv.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-9 h-9 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                  <Clock size={16} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{inv.email}</div>
                  <div className="text-xs text-amber-600">{fmtExpiry(inv.expiresAt)}</div>
                </div>
                <RoleBadge role={inv.role} />
                {/* Copy link */}
                <button
                  onClick={() => copyInviteLink(inv)}
                  title="Copy invite link"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 transition-colors"
                >
                  {copied === inv.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied === inv.id ? 'Copied' : 'Copy link'}
                </button>
                {/* Revoke */}
                <button
                  onClick={() => revokeInvite(inv.id)}
                  title="Revoke invite"
                  className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invite modal */}
      <InviteModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSent={(newInvite) => setInvites(prev => [newInvite, ...prev])}
      />
    </div>
  );
}
