// hooks/useSettingsAutoSave.js
//
// Debounced auto-save for module settings objects (miscPct, laborRate, etc.)
// Uses JSON.stringify for deep equality since settings objects don't maintain
// reference stability across pricingConfig sync useEffects.
//
// Usage:
//
//   const snapshotRef = useSettingsAutoSave(settings, activeProjectId, async () => {
//     await savePricingConfig({ fanSettings: { laborRate, miscPct, ... } });
//   });
//
//   // After syncing settings from pricingConfig, update the snapshot:
//   useEffect(() => {
//     const newSettings = { ...DEFAULT, ...pricingConfig.fanSettings };
//     snapshotRef.current = JSON.stringify(newSettings);  // ← don't count DB-sync as dirty
//     setSettings(newSettings);
//   }, [pricingConfig.fanSettings]);

import { useEffect, useRef, useCallback } from 'react';

/**
 * @param {object}   settings      The settings object to watch
 * @param {string}   projectId     Active project ID (null/undefined = disabled)
 * @param {function} onSave        Async save function (no args)
 * @param {number}   delay         Debounce delay in ms (default 1000)
 * @returns {React.MutableRefObject<string>}  snapshotRef — set .current to the
 *          JSON-stringified settings whenever you update them from the DB so that
 *          DB-driven changes don't trigger an auto-save.
 */
export function useSettingsAutoSave(settings, projectId, onSave, delay = 1000) {
  const snapshotRef = useRef(JSON.stringify(settings));
  const timerRef    = useRef(null);

  useEffect(() => {
    if (!projectId) return;

    const serialized = JSON.stringify(settings);
    if (serialized === snapshotRef.current) return; // no user change

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await onSave();
        snapshotRef.current = serialized; // update baseline after successful save
      } catch { /* ignore — next change will retry */ }
    }, delay);

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, projectId]);

  return snapshotRef;
}
