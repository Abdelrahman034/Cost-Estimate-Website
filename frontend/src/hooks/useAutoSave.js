// hooks/useAutoSave.js
//
// Debounced auto-save that skips the initial DB-load so the just-fetched data
// doesn't immediately re-trigger a write.
//
// Usage pattern:
//
//   const { markAsLoaded } = useAutoSave(rows, () => saveEstimate({ rowsJson: rows }), !!projectId);
//
//   useEffect(() => {
//     if (!projectId) return;
//     loadEstimate().then(est => {
//       if (est?.rowsJson?.length) {
//         setRows(est.rowsJson);
//         markAsLoaded(est.rowsJson);   // ← prevent immediate re-save of loaded data
//       } else {
//         markAsLoaded(null);           // ← no DB data; still mark load as complete
//       }
//     });
//   }, [projectId]);
//
// How it works:
//   • `snapshotRef` stores the last value that came from the DB (or was saved).
//   • When `data` changes and differs from the snapshot, a debounced save fires.
//   • After saving, the snapshot is updated so identical follow-up renders skip.
//   • `markAsLoaded(loadedData)` resets the snapshot to what was just fetched,
//     preventing the load itself from counting as a "dirty" change.

import { useEffect, useRef, useCallback } from 'react';

// Sentinel: "not yet loaded from DB — suppress all saves"
const PENDING = Symbol('pending');

/**
 * @param {any}      data     The data to watch for changes (rows, settings object, etc.)
 * @param {function} onSave   Called when a save should happen (no args — close over data)
 * @param {boolean}  enabled  Only schedules saves when true (e.g. when projectId exists)
 * @param {number}   delay    Debounce delay in ms (default 1500)
 * @returns {{ markAsLoaded: (loadedData: any) => void }}
 */
export function useAutoSave(data, onSave, enabled, delay = 1500) {
  const snapshotRef = useRef(PENDING);
  const timerRef    = useRef(null);

  /**
   * Call this after loading data from DB so the freshly-loaded state is NOT
   * treated as a dirty change. Pass the exact value you just put into state.
   */
  const markAsLoaded = useCallback((loadedData) => {
    snapshotRef.current = loadedData;
  }, []);

  useEffect(() => {
    // Still waiting for initial load → don't save
    if (snapshotRef.current === PENDING) return;

    // Disabled (no active project)
    if (!enabled) return;

    // Reference equality check: if data is the exact same object/array
    // that came from DB, nothing changed → skip
    if (data === snapshotRef.current) return;

    // Data changed — schedule a debounced save
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onSave();
      snapshotRef.current = data; // update baseline so unchanged re-renders skip
    }, delay);

    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, enabled]);

  return { markAsLoaded };
}
