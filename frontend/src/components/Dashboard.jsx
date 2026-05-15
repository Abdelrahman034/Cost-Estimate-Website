import React from 'react';
import { Link } from 'react-router-dom';
import { Wind, FileImage, TrendingUp, FileText, BarChart3, ArrowRight, Sparkles } from 'lucide-react';

const modules = [
  {
    to: '/duct',
    icon: Wind,
    title: 'Metal Duct Estimator',
    desc: 'Calculate sheet metal quantities, gauge selection, surface area, labor & material costs from duct schedules.',
    color: 'blue',
    tag: 'Core Module',
  },
  {
    to: '/drawings',
    icon: FileImage,
    title: 'AI Drawing Analyzer',
    desc: 'Upload mechanical drawings and let AI extract duct sizes, unit schedules, and quantities automatically.',
    color: 'purple',
    tag: 'AI',
  },
  {
    to: '/prices',
    icon: TrendingUp,
    title: 'Live Price Monitor',
    desc: 'AI-powered sheet metal and material price tracking. Keep your estimates aligned with current market rates.',
    color: 'green',
    tag: 'AI',
  },
  {
    to: '/proposal',
    icon: FileText,
    title: 'Proposal Generator',
    desc: 'Generate a professional bid proposal PDF and email it to the client or GC in one click.',
    color: 'amber',
    tag: 'AI',
  },
  {
    to: '/summary',
    icon: BarChart3,
    title: 'Bid Summary',
    desc: 'Full cost roll-up: materials, labor, overhead, and profit margin — your final bid number.',
    color: 'red',
    tag: 'Report',
  },
];

const colorMap = {
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',   badge: 'bg-blue-100 text-blue-700' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', badge: 'bg-purple-100 text-purple-700' },
  green:  { bg: 'bg-green-50',  icon: 'bg-green-100 text-green-600',  badge: 'bg-green-100 text-green-700' },
  amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600',  badge: 'bg-amber-100 text-amber-700' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-600',      badge: 'bg-red-100 text-red-700' },
};

export default function Dashboard({ projectInfo }) {
  return (
    <div className="max-w-5xl mx-auto">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-8 mb-8 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={20} className="text-amber-300" />
          <span className="text-sm font-medium text-blue-200">AI-Powered HVAC Estimation</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">
          {projectInfo.projectName || 'Welcome to HVAC Estimator'}
        </h1>
        <p className="text-blue-200 max-w-xl">
          {projectInfo.projectName
            ? `Estimating project in ${projectInfo.location || 'N/A'} — Bid due ${projectInfo.bidDate || 'TBD'}`
            : 'Click the project name in the header to set up your project, then choose a module below to start estimating.'}
        </p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map(({ to, icon: Icon, title, desc, color, tag }) => {
          const c = colorMap[color];
          return (
            <Link
              key={to}
              to={to}
              className={`group card hover:shadow-md transition-all duration-150 hover:-translate-y-0.5 ${c.bg} border-transparent`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.icon}`}>
                  <Icon size={20} />
                </div>
                <span className={`badge ${c.badge} font-medium`}>{tag}</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                {title}
              </h3>
              <p className="text-sm text-gray-500 leading-relaxed mb-4">{desc}</p>
              <div className="flex items-center gap-1 text-sm font-medium text-blue-600">
                Open module <ArrowRight size={14} />
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick tips */}
      <div className="mt-8 card bg-gray-800 border-gray-700 text-white">
        <h3 className="font-semibold text-sm text-gray-300 mb-3 uppercase tracking-wider">
          Recommended Workflow
        </h3>
        <ol className="space-y-2">
          {[
            'Set project info in the header (name, location, bid date)',
            'Upload drawings to the AI Drawing Analyzer to extract duct & unit schedules',
            'Review and adjust in the Metal Duct Estimator',
            'Check Live Prices to make sure your material costs are current',
            'Generate a Proposal PDF and send it directly from the app',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
              <span className="flex-shrink-0 w-5 h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
