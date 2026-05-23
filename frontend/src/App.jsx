import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from '@components/Layout/Sidebar';
import Header from '@components/Layout/Header';
import {
  MetalDuctModule,
  DiffuserModule,
  FanScheduleModule,
  DrawingAnalyzer,
  PriceMonitor,
  ProposalGenerator,
  SummaryModule,
  UnitScheduleModule,
  SupplierRFQModule,
  ScenarioModule,
  ChangeLogModule,
  ProposalPdfModule,
  ElectricHeatModule,
} from '@modules';
import SettingsPage from '@pages/SettingsPage';
import { SettingsProvider } from '@contexts/SettingsContext';
import Dashboard from '@pages/Dashboard';
import AdminDashboard from '@pages/AdminDashboard';
import DemoSetup from '@pages/DemoSetup';
import { ROUTE_PATHS } from '@config/navigation';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [projectInfo, setProjectInfo] = useState({
    projectName: '',
    location: '',
    owner: '',
    gc: '',
    bidDate: '',
    companyName: 'Your HVAC Company',
    companyAddress: '',
    companyPhone: '',
    companyEmail: '',
  });

  return (
    <SettingsProvider>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Toaster position="top-right" />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <Header
            onMenuClick={() => setSidebarOpen(!sidebarOpen)}
            projectInfo={projectInfo}
            onProjectInfoChange={setProjectInfo}
          />

          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path={ROUTE_PATHS.DASHBOARD} element={<Dashboard projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.DUCT} element={<MetalDuctModule projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.DIFFUSER} element={<DiffuserModule />} />
              <Route path={ROUTE_PATHS.UNIT_SCHEDULE} element={<UnitScheduleModule projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.FAN_SCHEDULE} element={<FanScheduleModule />} />
              <Route path={ROUTE_PATHS.ELEC_HEAT}    element={<ElectricHeatModule />} />
              <Route path={ROUTE_PATHS.SUPPLIER_RFQ} element={<SupplierRFQModule projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.SCENARIOS}    element={<ScenarioModule projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.CHANGELOG}    element={<ChangeLogModule projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.PROPOSAL_PDF} element={<ProposalPdfModule projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.DRAWINGS} element={<DrawingAnalyzer projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.PRICES} element={<PriceMonitor />} />
              <Route path={ROUTE_PATHS.PROPOSAL} element={<ProposalGenerator projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.SUMMARY} element={<SummaryModule projectInfo={projectInfo} />} />
              <Route path={ROUTE_PATHS.SETTINGS}         element={<SettingsPage />} />
              <Route path={ROUTE_PATHS.ADMIN_ANALYTICS}  element={<AdminDashboard />} />
              <Route path={ROUTE_PATHS.DEMO_SETUP}       element={<DemoSetup onProjectInfoChange={setProjectInfo} />} />
              <Route path="*" element={<Navigate to={ROUTE_PATHS.DASHBOARD} replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </SettingsProvider>
  );
}
