// components/EmptyState.jsx
// Shared empty state for all estimate modules.
import React from 'react';
import { Plus } from 'lucide-react';

export default function EmptyState({ icon: Icon, title, description, action, actionLabel = 'Add first row' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-4">
          <Icon size={22} className="text-gray-300" />
        </div>
      )}
      <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 mb-5 max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action}
          className="flex items-center gap-1.5 btn-primary px-4 py-2 text-sm"
        >
          <Plus size={14} /> {actionLabel}
        </button>
      )}
    </div>
  );
}
