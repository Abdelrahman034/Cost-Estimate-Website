// hooks/useEstimate.js
//
// Reusable hook that connects any estimator module to the PostgreSQL backend.
//
// Usage:
//   const { projectId, projectName, loadEstimate, saveEstimate, saving, lastSaved } = useEstimate('METAL_DUCT');
//
// When the URL contains ?projectId=xxx, load/save go to the DB.
// When there is no projectId, the module works stand-alone (no DB calls).

import { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { estimatesApi } from '@services/estimatesApi';
import { projectsApi }  from '@services/projectsApi';

export function useEstimate(moduleKey) {
  const [searchParams]    = useSearchParams();
  const projectId          = searchParams.get('projectId') || null;

  const [projectName, setProjectName] = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [lastSaved,   setLastSaved]   = useState(null);
  const [saveError,   setSaveError]   = useState(null);

  // Fetch the project name so we can show "Saving to: XYZ" in the UI
  useEffect(() => {
    if (!projectId) { setProjectName(null); return; }
    projectsApi.get(projectId)
      .then(p => setProjectName(p.name))
      .catch(() => setProjectName(null));
  }, [projectId]);

  // Load the saved estimate for this module from the DB.
  // Returns the full estimate object (with rowsJson, totalsJson, etc.) or null.
  const loadEstimate = useCallback(async () => {
    if (!projectId) return null;
    try {
      return await estimatesApi.getByModule(projectId, moduleKey);
    } catch {
      return null;
    }
  }, [projectId, moduleKey]);

  // Save rows + totals to the DB.
  // data = { rowsJson, totalsJson?, pricesJson?, totalMaterial?, totalLabor?, totalHours?, totalCost? }
  const saveEstimate = useCallback(async (data) => {
    if (!projectId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await estimatesApi.save(projectId, { module: moduleKey, ...data });
      setLastSaved(new Date());
    } catch (err) {
      setSaveError(err.response?.data?.error || 'Could not save estimate.');
    } finally {
      setSaving(false);
    }
  }, [projectId, moduleKey]);

  return {
    projectId,
    projectName,
    loadEstimate,
    saveEstimate,
    saving,
    lastSaved,
    saveError,
  };
}
