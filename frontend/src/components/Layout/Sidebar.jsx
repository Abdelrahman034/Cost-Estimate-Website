import React from 'react';
import { NavLink } from 'react-router-dom';
import { X, Wrench } from 'lucide-react';
import { NAV_SECTIONS, ROUTE_PATHS } from '@config/navigation';

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
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-3 mt-5 first:mt-0">
                {section.title}
              </div>
              {section.items.map(({ to, label, icon: Icon, ai }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === ROUTE_PATHS.DASHBOARD}
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
                  {ai && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-medium">
                      AI
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
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
