// pages/CompanyPage.jsx
// Admin-only page — view and edit company profile, see team roster and pending invites.

import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2, Shield, Users, Mail, Phone, MapPin, FileText,
  Save, Loader2, AlertCircle, CheckCircle2, RefreshCw,
  UserCheck, Clock, ChevronRight, Settings, BarChart3, FolderOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { companyApi } from '@services/api';
import { useAuth } from '@contexts/AuthContext';

// ── Role badge ────────────────────────────────────────────────────────────────
const ROLE_BADGE = {
  ADMIN:     'bg-purple-50 text-purple-700 border border-purple-200',
  ESTIMATOR: 'bg-blue-50 text-blue-700 border border-blue-200',
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Sub-section wrapper ───────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────────
function Field({ label, icon: Icon, value, onChange, placeholder, type = 'text', readOnly = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && (
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">
            <Icon size={15} />
          </span>
        )}
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange && onChange(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            ${Icon ? 'pl-9' : ''}
            ${readOnly ? 'bg-gray-50 text-gray-500 cursor-default' : 'bg-white text-gray-800'}
            border-gray-300`}
        />
      </div>
    </div>
  );
}

// ── Quick-link card ───────────────────────────────────────────────────────────
function QuickCard({ icon: Icon, label, description, href, color }) {
  const navigate = useNavigate();
  const COLORS = {
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    gray:   'bg-gray-100 text-gray-600',
  };
  return (
    <button
      onClick={() => navigate(href)}
      className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all text-left w-full"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${COLORS[color]}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800">{label}</div>
        <div className="text-xs text-gray-400 truncate">{description}</div>
      </div>
      <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function CompanyPage() {
  const { user } = useAuth();

  // ── Company profile state ─────────────────────────────────────────────────
  const [profile, setProfile]       = useState(null);
  const [draft, setDraft]           = useState({});
  const [profileLoading, setPL]     = useState(true);
  const [profileSaving, setPS]      = useState(false);
  const [profileError, setPE]       = useState(null);

  // ── Users state ───────────────────────────────────────────────────────────
  const [users, setUsers]           = useState([]);
  const [usersLoading, setUL]       = useState(true);

  // ── Invites state ─────────────────────────────────────────────────────────
  const [invites, setInvites]       = useState([]);
  const [invitesLoading, setIL]     = useState(true);

  // ── Load all data on mount ────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setPL(true); setUL(true); setIL(true); setPE(null);
    try {
      const [cRes, uRes, iRes] = await Promise.all([
        companyApi.get(),
        companyApi.listUsers(),
        companyApi.listInvites(),
      ]);
      setProfile(cRes.data);
      setDraft(cRes.data);
      setUsers(uRes.data);
      setInvites(iRes.data);
    } catch (e) {
      setPE(e.response?.data?.error || e.message);
      toast.error('Failed to load company data');
    } finally {
      setPL(false); setUL(false); setIL(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Save profile ──────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setPS(true);
    try {
      const { data } = await companyApi.update({
        name:       draft.name,
        address:    draft.address,
        phone:      draft.phone,
        email:      draft.email,
        licenseNum: draft.licenseNum,
      });
      setProfile(data);
      setDraft(data);
      toast.success('Company profile saved');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Could not save');
    } finally {
      setPS(false);
    }
  };

  const isDirty = profile && (
    draft.name       !== profile.name       ||
    draft.address    !== profile.address    ||
    draft.phone      !== profile.phone      ||
    draft.email      !== profile.email      ||
    draft.licenseNum !== profile.licenseNum
  );

  // ── Counts ────────────────────────────────────────────────────────────────
  const activeUsers    = users.filter(u => u.isActive).length;
  const adminCount     = users.filter(u => u.role === 'ADMIN' && u.isActive).length;
  const pendingInvites = invites.length;

  if (profileError) {
    return (
      <div className="max-w-3xl mx-auto mt-16 flex flex-col items-center gap-4 text-center">
        <AlertCircle size={40} className="text-red-400" />
        <p className="text-gray-600">{profileError}</p>
        <button onClick={loadAll} className="btn-secondary flex items-center gap-2">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {profileLoading ? '…' : (profile?.name || 'Company')}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
              <Shield size={11} />
              <span>Administrator — {user?.email}</span>
            </div>
          </div>
        </div>
        <button onClick={loadAll} className="btn-secondary flex items-center gap-2 text-sm" title="Refresh">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* ── Stats row ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Members', value: usersLoading ? '…' : activeUsers,    icon: Users,     color: 'text-blue-600',   bg: 'bg-blue-50'   },
          { label: 'Administrators', value: usersLoading ? '…' : adminCount,     icon: Shield,    color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Pending Invites',value: invitesLoading ? '…' : pendingInvites,icon: Mail,     color: 'text-amber-600',  bg: 'bg-amber-50'  },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-400">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Company profile form ─────────────────────────────────────────── */}
      <Section title="Company Profile">
        {profileLoading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <Field
                label="Company Name"
                icon={Building2}
                value={draft.name}
                onChange={v => setDraft(d => ({ ...d, name: v }))}
                placeholder="Acme HVAC Inc."
              />
              <Field
                label="License Number"
                icon={FileText}
                value={draft.licenseNum}
                onChange={v => setDraft(d => ({ ...d, licenseNum: v }))}
                placeholder="LIC-12345"
              />
              <Field
                label="Email"
                icon={Mail}
                type="email"
                value={draft.email}
                onChange={v => setDraft(d => ({ ...d, email: v }))}
                placeholder="info@company.com"
              />
              <Field
                label="Phone"
                icon={Phone}
                type="tel"
                value={draft.phone}
                onChange={v => setDraft(d => ({ ...d, phone: v }))}
                placeholder="+1 (555) 000-0000"
              />
              <div className="sm:col-span-2">
                <Field
                  label="Address"
                  icon={MapPin}
                  value={draft.address}
                  onChange={v => setDraft(d => ({ ...d, address: v }))}
                  placeholder="123 Main St, City, State 00000"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={saveProfile}
                disabled={!isDirty || profileSaving}
                className={`btn-primary flex items-center gap-2 text-sm
                  ${(!isDirty || profileSaving) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {profileSaving
                  ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                  : <><Save size={14} /> Save Profile</>}
              </button>
              {!isDirty && profile && (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle2 size={13} /> Up to date
                </span>
              )}
              {isDirty && (
                <button
                  onClick={() => setDraft(profile)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Discard changes
                </button>
              )}
            </div>
          </>
        )}
      </Section>

      {/* ── Team roster ─────────────────────────────────────────────────── */}
      <Section title={`Team Members${!usersLoading ? ` (${users.filter(u => u.isActive).length})` : ''}`}>
        {usersLoading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-gray-400">No users found.</p>
        ) : (
          <div className="space-y-2">
            {users.filter(u => u.isActive).map(u => (
              <div key={u.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-gray-500 uppercase">
                    {(u.firstName?.[0] || u.email[0]).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {u.firstName || u.lastName
                      ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim()
                      : u.email}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[u.role] || ROLE_BADGE.ESTIMATOR}`}>
                    {u.role}
                  </span>
                  {u.lastLoginAt && (
                    <span className="text-xs text-gray-400 hidden sm:block">
                      Last seen {fmtDate(u.lastLoginAt)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Pending invites ──────────────────────────────────────────────── */}
      {invites.length > 0 && (
        <Section title={`Pending Invites (${invites.length})`}>
          <div className="space-y-2">
            {invites.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-amber-50 border border-amber-100">
                <Clock size={15} className="text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{inv.email}</div>
                  <div className="text-xs text-gray-400">
                    Expires {fmtDate(inv.expiresAt)} · Role: {inv.role}
                  </div>
                </div>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── Quick links ──────────────────────────────────────────────────── */}
      <Section title="Admin Areas">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickCard icon={Users}    label="Team Management" description="Invite members, manage roles"  href="/team"             color="green"  />
          <QuickCard icon={FolderOpen} label="All Projects"  description="View every project company-wide" href="/projects"       color="blue"   />
          <QuickCard icon={BarChart3} label="Analytics"      description="Revenue, bids won/lost"         href="/admin/analytics" color="purple" />
          <QuickCard icon={Settings} label="Settings"        description="Labor rates, pricing tables"    href="/settings"        color="gray"   />
        </div>
      </Section>

    </div>
  );
}
