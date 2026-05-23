// components/auth/ProtectedRoute.jsx
//
// Wraps any route that requires authentication.
// If the user is not logged in → redirect to /login.
// If an allowedRoles array is provided → redirect to /unauthorized if role doesn't match.
//
// Usage:
//   <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
//   <Route path="/company"  element={<ProtectedRoute allowedRoles={['ADMIN']}><CompanyPage /></ProtectedRoute>} />

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Still restoring session from localStorage — show a spinner, don't flash login
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  // Not authenticated → go to login, remember where they were trying to go
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated but wrong role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'ADMIN' ? '/company' : '/projects'} replace />;
  }

  return children;
}
