import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Wind,
  Gauge,
  FileImage,
  TrendingUp,
  FileText,
  BarChart3,
  X,
  Wrench,
} from 'lucide-react';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/duct', label: 'Metal Duct', icon: Wind },
  { to: '/diffuser', label: 'Diffuser Schedule', icon: Gauge },
  { to: '/settings', label: 'Settings', icon: Wrench },
  { to: '/drawings', label: 'Drawing Analyzer', icon: FileImage, ai: true },
  { to: '/prices', label: 'Live Prices', icon: TrendingUp, ai: true },
  { to: '/proposal', label: 'Proposal Generator', icon: FileText, ai: true },
  { to: '/summary', label: 'Bid Summary', icon: BarChart3 },
];

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Overlay (mobile) */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          flex flex-col w-64 bg-gray-900 text-white
          transition-transform duration-200
          ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Wrench size={16} className="text-white" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight">HVAC Estimator</div>
              <div className="text-xs text-gray-400">AI-Powered</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-white p-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3">
            Estimating
          </div>
          {nav.slice(0, 3).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3 mt-5">
            AI Features
          </div>
          {nav.slice(3, 6).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                AI
              </span>
            </NavLink>
          ))}

          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3 mt-5">
            Reports
          </div>
          {nav.slice(6).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700">
          <div className="text-xs text-gray-500">v1.0.0 — Local Mode</div>
        </div>
      </aside>
    </>
  );
}
