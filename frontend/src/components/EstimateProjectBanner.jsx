// components/EstimateProjectBanner.jsx
//
// Shown at the top of every estimator module.
// • With projectId  → blue banner showing project name, back link, and save status
// • Without projectId → amber standalone warning with a link to /projects

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, CheckCircle2, Loader2, AlertCircle, ArrowLeft, FolderX } from 'lucide-react';

// Returns a live-updating relative time string: "just now", "2 min ago", etc.
function useRelativeTime(date) {
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!date) { setLabel(''); return; }

    const update = () => {
      const secs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (secs < 10)  { setLabel('just now'); return; }
      if (secs < 60)  { setLabel(`${secs}s ago`); return; }
      const mins = Math.floor(secs / 60);
      if (mins < 60)  { setLabel(`${mins} min ago`); return; }
      // Older than 1 hour — fall back to clock time
      setLabel(date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    };

    update();
    const id = setInterval(update, 10_000); // refresh every 10s
    return () => clearInterval(id);
  }, [date]);

  return label;
}

export default function EstimateProjectBanner({ projectId, projectName, saving, lastSaved, saveError, loadError }) {
  const navigate     = useNavigate();
  const relativeTime = useRelativeTime(lastSaved);

  // ── Standalone mode warning ────────────────────────────────────────────────
  if (!projectId) {
    return (
      <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
        <FolderX size={15} className="text-amber-500 flex-shrink-0" />
        <span className="text-amber-700">
          <span className="font-medium">Standalone mode</span> — your work won't be saved.{' '}
          <button
            onClick={() => navigate('/projects')}
            className="underline text-amber-800 hover:text-amber-900 font-medium"
          >
            Open from a project
          </button>{' '}
          to save estimates to the database.
        </span>
      </div>
    );
  }

  // ── Project-linked mode ────────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-3 mb-4 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-sm">
      {/* Back to project */}
      <button
        onClick={() => navigate(`/projects/${projectId}`)}
        className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium transition-colors flex-shrink-0"
      >
        <ArrowLeft size={14} />
        <FolderOpen size={14} />
        <span className="truncate max-w-[200px]">{projectName || 'Project'}</span>
      </button>

      <span className="text-blue-200 flex-shrink-0">|</span>

      {/* Save / load status */}
      {loadError ? (
        <span className="flex items-center gap-1.5 text-red-600">
          <AlertCircle size={13} /> Load failed: {loadError}
        </span>
      ) : saveError ? (
        <span className="flex items-center gap-1.5 text-red-600">
          <AlertCircle size={13} /> {saveError}
        </span>
      ) : saving ? (
        <span className="flex items-center gap-1.5 text-blue-500">
          <Loader2 size={13} className="animate-spin" /> Saving…
        </span>
      ) : lastSaved ? (
        <span className="flex items-center gap-1.5 text-green-600">
          <CheckCircle2 size={13} /> Saved {relativeTime}
        </span>
      ) : (
        <span className="text-blue-400">Changes will be saved after you calculate</span>
      )}
    </div>
  );
}
