// contexts/AuthContext.jsx
//
// Provides auth state to the entire app.
// Any component can call useAuth() to get the current user or call login/logout.
//
// Token strategy:
//   accessToken  → stored in React state (memory only — lost on refresh, secure)
//   refreshToken → stored in localStorage (survives refresh, used to get new access token)

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from '@services/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]               = useState(null);        // { id, email, role, companyId, company, ... }
  const [accessToken, setAccessToken] = useState(null);        // short-lived JWT (15 min)
  const [loading, setLoading]         = useState(true);        // true while restoring session on page load
  const refreshTimerRef               = useRef(null);          // silent refresh timer

  // ── Silent token refresh ───────────────────────────────────────────────────
  // Schedules a refresh 1 minute before the access token expires (14 min).
  // This keeps the user logged in without them noticing.

  const scheduleRefresh = useCallback((token) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    // 14 minutes in ms (access token is 15 min, refresh 1 min early)
    refreshTimerRef.current = setTimeout(() => silentRefresh(), 14 * 60 * 1000);
  }, []);

  const silentRefresh = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    if (!storedRefreshToken) return;
    try {
      const { data } = await authApi.refresh(storedRefreshToken);
      setAccessToken(data.accessToken);
      sessionStorage.setItem('accessToken', data.accessToken);  // for api.js interceptor
      localStorage.setItem('refreshToken', data.refreshToken);
      scheduleRefresh(data.accessToken);
    } catch {
      // Refresh token expired or revoked — log the user out
      logout();
    }
  }, [scheduleRefresh]);

  // ── Restore session on page load ───────────────────────────────────────────
  // When the user refreshes the browser the access token is gone (memory only).
  // We check localStorage for a refresh token and silently get a new access token.

  useEffect(() => {
    const restore = async () => {
      const storedRefreshToken = localStorage.getItem('refreshToken');
      if (!storedRefreshToken) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await authApi.refresh(storedRefreshToken);
        const profile  = await authApi.me(data.accessToken);
        setAccessToken(data.accessToken);
        sessionStorage.setItem('accessToken', data.accessToken);
        setUser(profile.data);
        localStorage.setItem('refreshToken', data.refreshToken);
        scheduleRefresh(data.accessToken);
      } catch {
        // Token was invalid or expired — clear everything
        localStorage.removeItem('refreshToken');
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, [scheduleRefresh]);

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = useCallback(async ({ email, password }) => {
    const { data } = await authApi.login({ email, password });
    setAccessToken(data.accessToken);
    sessionStorage.setItem('accessToken', data.accessToken);
    setUser(data.user);
    localStorage.setItem('refreshToken', data.refreshToken);
    scheduleRefresh(data.accessToken);
    return data.user;
  }, [scheduleRefresh]);

  // ── Register ───────────────────────────────────────────────────────────────

  const register = useCallback(async ({ companyName, email, password, firstName, lastName }) => {
    const { data } = await authApi.register({ companyName, email, password, firstName, lastName });
    setAccessToken(data.accessToken);
    sessionStorage.setItem('accessToken', data.accessToken);
    setUser(data.user);
    localStorage.setItem('refreshToken', data.refreshToken);
    scheduleRefresh(data.accessToken);
    return data.user;
  }, [scheduleRefresh]);

  // ── Logout ─────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    try { await authApi.logout(storedRefreshToken); } catch { /* ignore */ }
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    setAccessToken(null);
    setUser(null);
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }, []);

  // ── Role helpers ───────────────────────────────────────────────────────────

  const isAdmin     = user?.role === 'ADMIN';
  const isEstimator = user?.role === 'ESTIMATOR';
  const isViewer    = user?.role === 'VIEWER';

  const value = {
    user,
    accessToken,
    loading,
    isAdmin,
    isEstimator,
    isViewer,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
