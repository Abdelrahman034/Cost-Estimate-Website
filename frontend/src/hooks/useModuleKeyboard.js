// hooks/useModuleKeyboard.js
//
// Two UX behaviours for every estimate module:
//
//   1. Ctrl+S / Cmd+S  → triggers a manual save immediately
//   2. beforeunload    → warns the browser "leave site?" when there are unsaved changes
//
// Usage:
//   useModuleKeyboard({
//     onSave:   () => saveEstimate({ rowsJson: rows, ... }),
//     isDirty:  lastSaved === null && projectId !== null,
//     enabled:  !!projectId,
//   });

import { useEffect } from 'react';

export function useModuleKeyboard({ onSave, isDirty = false, enabled = true }) {

  // ── Ctrl+S / Cmd+S ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); // block browser save-page dialog
        onSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onSave]);

  // ── Unsaved changes warning on tab close / navigation ─────────────────────
  useEffect(() => {
    if (!enabled || !isDirty) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      // Modern browsers require returnValue to be set to show the dialog
      e.returnValue = 'You have unsaved changes. Leave anyway?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [enabled, isDirty]);
}
