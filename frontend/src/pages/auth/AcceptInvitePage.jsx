// pages/auth/AcceptInvitePage.jsx
//
// Employees land here from their invite link:
//   http://localhost:5173/invite/<token>
//
// 1. On mount, validates the token with GET /api/auth/invite/:token
// 2. Shows a form to set first name, last name, and password
// 3. On submit, calls POST /api/auth/accept-invite
// 4. Logs the user in and redirects to /projects

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { authApi } from '@services/authApi';
import { Wind, Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';

export default function AcceptInvitePage() {
  const { token }  = useParams();
  const navigate   = useNavigate();
  const { login }  = useAuth();

  const [invite,   setInvite]   = useState(null);   // { email, role, companyName }
  const [checking, setChecking] = useState(true);   // validating token
  const [tokenErr, setTokenErr] = useState('');

  const [form,     setForm]     = useState({ firstName: '', lastName: '', password: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState('');
  const [done,     setDone]     = useState(false);

  // ── Validate token on mount ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { data } = await authApi.getInvite(token);
        setInvite(data);
      } catch (err) {
        setTokenErr(err.response?.data?.error || 'Invalid or expired invite link.');
      } finally {
        setChecking(false);
      }
    })();
  }, [token]);

  const handleChange = (e) =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormErr('');

    if (form.password.length < 8) {
      return setFormErr('Password must be at least 8 characters.');
    }
    if (form.password !== form.confirm) {
      return setFormErr('Passwords do not match.');
    }

    setSaving(true);
    try {
      const { data } = await authApi.acceptInvite({
        token,
        firstName: form.firstName.trim(),
        lastName:  form.lastName.trim(),
        password:  form.password,
      });
      // Store tokens and set user — same pattern as login
      sessionStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken',  data.refreshToken);
      setDone(true);
      setTimeout(() => navigate('/projects', { replace: true }), 1500);
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Could not create account. Try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // ── Invalid / expired token ────────────────────────────────────────────────
  if (tokenErr) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invite link invalid</h2>
          <p className="text-gray-500 text-sm mb-6">{tokenErr}</p>
          <p className="text-sm text-gray-400">
            Ask your admin to send a new invite, or{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">sign in</Link>{' '}
            if you already have an account.
          </p>
        </div>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <CheckCircle2 size={40} className="text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Account created!</h2>
          <p className="text-gray-500 text-sm">Redirecting you to the app…</p>
        </div>
      </div>
    );
  }

  // ── Registration form ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl shadow-lg mb-4">
            <Wind size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">HVAC Estimator</h1>
          <p className="text-gray-500 text-sm mt-1">You've been invited to join a team</p>
        </div>

        {/* Invite context banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
          <Building2 size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-blue-900">{invite.companyName}</div>
            <div className="text-xs text-blue-600 mt-0.5">
              Joining as <span className="font-medium">{invite.role}</span> · {invite.email}
            </div>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-5">Create your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formErr && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
                <AlertCircle size={15} /> {formErr}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
                <input
                  name="firstName" value={form.firstName} onChange={handleChange}
                  required autoFocus className="input w-full" placeholder="Jane"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name</label>
                <input
                  name="lastName" value={form.lastName} onChange={handleChange}
                  required className="input w-full" placeholder="Smith"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input value={invite.email} disabled className="input w-full bg-gray-50 text-gray-400 cursor-not-allowed" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  name="password" value={form.password} onChange={handleChange}
                  required minLength={8} placeholder="Min. 8 characters"
                  className="input w-full pr-10"
                />
                <button type="button" onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
              <input
                type={showPass ? 'text' : 'password'}
                name="confirm" value={form.confirm} onChange={handleChange}
                required placeholder="Repeat password" className="input w-full"
              />
            </div>

            <button
              type="submit" disabled={saving}
              className="w-full btn-primary py-2.5 flex items-center justify-center gap-2 mt-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'Creating account…' : 'Create account & sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-400 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
