import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import MetalDuctModule from './modules/MetalDuct/MetalDuctModule';
import SettingsPage from './pages/SettingsPage';
import { SettingsProvider } from './contexts/SettingsContext';
import DrawingAnalyzer from './components/ai/DrawingAnalyzer';
import PriceMonitor from './components/ai/PriceMonitor';
import ProposalGenerator from './components/ai/ProposalGenerator';
import SummaryModule from './components/modules/Summary/SummaryModule';
import Dashboard from './pages/Dashboard';

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
              <Route path="/" element={<Dashboard projectInfo={projectInfo} />} />
              <Route path="/duct" element={<MetalDuctModule projectInfo={projectInfo} />} />
              <Route path="/drawings" element={<DrawingAnalyzer projectInfo={projectInfo} />} />
              <Route path="/prices" element={<PriceMonitor />} />
              <Route path="/proposal" element={<ProposalGenerator projectInfo={projectInfo} />} />
              <Route path="/summary" element={<SummaryModule projectInfo={projectInfo} />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </SettingsProvider>
  );
}
