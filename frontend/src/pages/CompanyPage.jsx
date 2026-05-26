// pages/CompanyPage.jsx
// Admin landing page — shown after login when role = ADMIN.
// Displays company info from the auth context (no API calls needed yet).

import React from 'react';
import { useAuth } from '@contexts/AuthContext';
import { Building2, Users, Settings, BarChart3, FolderOpen, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const cards = [
  {
    icon: FolderOpen,
    label: 'Projects',
    description: 'View and manage all company projects',
    href: '/projects',
    color: 'blue',
  },
  {
    icon: Users,
    label: 'Team',
    description: 'Invite employees, manage roles and access',
    href: '/team',
    color: 'green',
  },
  {
    icon: BarChart3,
    label: 'Analytics',
    description: 'Revenue, bids won/lost, performance',
    href: '/admin/analytics',
    color: 'purple',
  },
  {
    icon: Settings,
    label: 'Settings',
    description: 'Company details, labor rates, pricing',
    href: '/settings',
    color: 'gray',
  },
];

const COLOR = {
  blue:   'bg-blue-50 text-blue-600 border-blue-100',
  green:  'bg-green-50 text-green-600 border-green-100',
  purple: 'bg-purple-50 text-purple-600 border-purple-100',
  gray:   'bg-gray-50 text-gray-600 border-gray-100',
};

export default function CompanyPage() {
  const { user } = useAuth();
  const navigate  = useNavigate();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user?.company}</h1>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
              <Shield size={11} />
              <span>Administrator — {user?.email}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(({ icon: Icon, label, description, href, color, soon }) => (
          <button
            key={label}
            onClick={() => !soon && navigate(href)}
            className={`relative text-left p-5 rounded-xl border bg-white hover:shadow-md transition-all duration-150
              ${soon ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5'}`}
          >
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg border mb-3 ${COLOR[color]}`}>
              <Icon size={18} />
            </div>
            <div className="font-semibold text-gray-800">{label}</div>
            <div className="text-sm text-gray-400 mt-0.5">{description}</div>
            {soon && (
              <span className="absolute top-4 right-4 text-[10px] font-semibold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                Coming soon
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Welcome note */}
      <div className="mt-8 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700">
        <strong>Welcome, {user?.firstName || user?.email}.</strong> You're logged in as the company administrator.
        More management features will appear here as they're built.
      </div>
    </div>
  );
}
