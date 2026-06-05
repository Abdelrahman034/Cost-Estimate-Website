import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from '@components/ErrorBoundary';

// Auth
import { AuthProvider, useAuth } from '@contexts/AuthContext';
import ProtectedRoute from '@components/auth/ProtectedRoute';
import LoginPage          from '@pages/auth/LoginPage';
import RegisterPage       from '@pages/auth/RegisterPage';
import ForgotPasswordPage from '@pages/auth/ForgotPasswordPage';
import AcceptInvitePage   from '@pages/auth/AcceptInvitePage';

// Layout
import Sidebar from '@components/Layout/Sidebar';
import Header from '@components/Layout/Header';

// Modules
import {
  MetalDuctModule, DiffuserModule, FanScheduleModule,
  SummaryModule, UnitScheduleModule, SupplierRFQModule,
  ScenarioModule, ChangeLogModule, ProposalPdfModule, ElectricHeatModule,
  GeneralModule, VavScheduleModule,
} from '@modules';
import LouversModule from '@modules/LouversAndDampers/LouversModule';
import SettingsPage    from '@pages/SettingsPage';
import AdminDashboard  from '@pages/AdminDashboard';
import CompanyPage     from '@pages/CompanyPage';
import TeamPage        from '@pages/TeamPage';
import ProjectsPage      from '@pages/ProjectsPage';
import ProjectDetailPage from '@pages/ProjectDetailPage';
import { SettingsProvider } from '@contexts/SettingsContext';
import { ActiveProjectProvider } from '@contexts/ActiveProjectContext';
import { ROUTE_PATHS } from '@config/navigation';

// The main app shell (shown only when logged in)
function AppShell() {
  const { logout, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projectInfo, setProjectInfo] = useState({
    projectName: '', location: '', owner: '', gc: '', bidDate: '',
    companyName: user?.company?.name || user?.company || 'Your HVAC Company',
    companyAddress: '', companyPhone: '', companyEmail: '',
  });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Toaster position="top-right" />
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
          onLogout={logout}
          user={user}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>
          <Routes>
            {/* Home → always go to projects */}
            <Route path={ROUTE_PATHS.DASHBOARD} element={<Navigate to="/projects" replace />} />
            <Route path={ROUTE_PATHS.GENERAL}           element={<GeneralModule />} />
            <Route path={ROUTE_PATHS.DUCT}             element={<MetalDuctModule projectInfo={projectInfo} />} />
            <Route path={ROUTE_PATHS.DIFFUSER}         element={<DiffuserModule />} />
            <Route path={ROUTE_PATHS.UNIT_SCHEDULE}    element={<UnitScheduleModule projectInfo={projectInfo} />} />
            <Route path={ROUTE_PATHS.FAN_SCHEDULE}     element={<FanScheduleModule />} />
            <Route path={ROUTE_PATHS.VAV_SCHEDULE}     element={<VavScheduleModule />} />
            <Route path={ROUTE_PATHS.ELEC_HEAT}        element={<ElectricHeatModule />} />
            <Route path={ROUTE_PATHS.LOUVERS}          element={<LouversModule />} />
            <Route path={ROUTE_PATHS.SUPPLIER_RFQ}     element={<SupplierRFQModule projectInfo={projectInfo} />} />
            <Route path={ROUTE_PATHS.SCENARIOS}        element={<ScenarioModule projectInfo={projectInfo} />} />
            <Route path={ROUTE_PATHS.CHANGELOG}        element={<ChangeLogModule projectInfo={projectInfo} />} />
            <Route path={ROUTE_PATHS.PROPOSAL_PDF}     element={<ProposalPdfModule projectInfo={projectInfo} />} />
            <Route path={ROUTE_PATHS.SUMMARY}          element={<SummaryModule projectInfo={projectInfo} />} />
            <Route path={ROUTE_PATHS.SETTINGS}
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path={ROUTE_PATHS.ADMIN_ANALYTICS}  element={<AdminDashboard />} />
            <Route path="/projects"     element={<ProjectsPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />
            <Route path="/company"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <CompanyPage />
                </ProtectedRoute>
              }
            />
            <Route path="/team"         element={<TeamPage />} />
            <Route path="*" element={<Navigate to={user?.role === 'ADMIN' ? ROUTE_PATHS.DASHBOARD : '/projects'} replace />} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ActiveProjectProvider>
      <SettingsProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/register"        element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/invite/:token"   element={<AcceptInvitePage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          />
        </Routes>
      </SettingsProvider>
      </ActiveProjectProvider>
    </AuthProvider>
  );
}
