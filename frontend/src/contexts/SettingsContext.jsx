// contexts/SettingsContext.jsx
//
// Two-layer settings system:
//
//   COMPANY LAYER  ──  PricingConfig in PostgreSQL (one row per company)
//     • Edited only through SettingsPage (admin/manager).
//     • Exposed as `companySettings` and `saveCompanySettings`.
//
//   PROJECT LAYER  ──  Project.settingsOverrides JSON (one row per project)
//     • Set by the estimator inside ProjectDetailPage.
//     • Only the keys that differ from company defaults are stored.
//     • Never touches PricingConfig.
//     • Loaded/cleared via `loadProjectSettings` / `clearProjectContext`.
//
//   EFFECTIVE SETTINGS (what every module uses)
//     • `pricingConfig` = merge(companySettings, projectOverrides)
//     • When no project is active, pricingConfig === companySettings.
//     • All existing modules already consume `pricingConfig` — zero changes needed there.

import React, { createContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { pricingApi, projectSettingsApi } from '@services/api';
import { mergeUnitPricingTables } from '@utils/unitScheduleCalculations';

// ── Defaults ──────────────────────────────────────────────────────────────────

// Duct / material prices (MetalDuct module)
// Company-level values live in PricingConfig.ductPrices in DB.
// Project-level overrides live in project.settingsOverrides.ductPrices.
// localStorage is used ONLY as a cache for the company-level values.
export const DEFAULT_DUCT_PRICES = {
  sheetMetalKgPerFt2:       0.567,
  sheetMetalLbsPerFt2:      1.24967,
  sheetMetalCostPerLb:      4.00,
  insulationPerSqFt:        1.25,
  ductWrapLaborPerFt:       4.0,
  sheetMetalLaborPerFt:     23.0,
  flexDuctLaborShort:       40.0,
  flexDuctLaborLong:        80.0,
  maxFlexDuctLen:           5.0,
  offtakeCost:              20.0,
  vdCost:                   25.0,
  internalInsulationUplift: 0.4,
  incidentalsPct:           0.20,
  roundDuctIncidentalsPct:  0.25,
  measureUnit:              'ft',
};

// Company-wide config defaults (mirrors DB schema defaults)
export const DEFAULT_PRICING_CONFIG = {
  ratePackaged:  25,
  rateSplit:     65,
  rateWallMount: 65,
  rateVrf:       75,
  rateFan:       25,
  rateDuct:      25,
  ratePipe:      65,
  rateElec:      65,
  overheadPct:   0.15,
  profitPct:     0.10,
  taxPct:        0.00,
  ductWastePct:  0.10,
  pipeWastePct:  0.10,
};

export const DEFAULT_ACCESSORY_OVERRIDES = {
  packaged:  {},
  split:     {},
  wallMount: {},
  vrf:       {},
};

export const DEFAULT_COPPER_SETTINGS = {
  lmeCopperPrice: 4.25,
  refrigCylinderPrice: 280,
  safetyFactors: {
    split:       1.10,
    wallMounted: 1.10,
    vrv:         1.15,
    ahuWithCU:   1.15,
  },
  copperFractions: {
    split:       { 0: 0.31, 5: 0.44, 10: 0.56, 20: 0.45, 50: 0.50, 75: 0.55 },
    wallMounted: { 0: 0.31, 5: 0.44, 10: 0.56, 20: 0.45, 50: 0.50, 75: 0.55 },
    ahuWithCU:   { 0: 0.35, 5: 0.40, 10: 0.45, 20: 0.50, 50: 0.55, 75: 0.60 },
    vrv:         { 0: 0.45, 5: 0.45, 10: 0.45, 20: 0.45, 50: 0.45, 75: 0.45 },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function coerceCompanyConfig(data) {
  const coerced = {};
  for (const key of Object.keys(DEFAULT_PRICING_CONFIG)) {
    coerced[key] = data[key] != null ? Number(data[key]) : DEFAULT_PRICING_CONFIG[key];
  }
  coerced.copperSettings = data.copperSettings
    ? { ...DEFAULT_COPPER_SETTINGS, ...data.copperSettings }
    : DEFAULT_COPPER_SETTINGS;
  coerced.accessoryPriceOverrides = data.accessoryPriceOverrides
    ? { ...DEFAULT_ACCESSORY_OVERRIDES, ...data.accessoryPriceOverrides }
    : DEFAULT_ACCESSORY_OVERRIDES;
  coerced.unitPricingTables = mergeUnitPricingTables(data.unitPricingTables);
  // Merge duct prices: DB values win over defaults, with full fallback to defaults
  coerced.ductPrices = data.ductPrices
    ? { ...DEFAULT_DUCT_PRICES, ...data.ductPrices }
    : DEFAULT_DUCT_PRICES;
  return coerced;
}

/** Deep-merge project overrides on top of the company config. */
function mergeSettings(company, overrides) {
  if (!overrides || Object.keys(overrides).length === 0) return company;
  return {
    ...company,
    ...overrides,
    // Nested objects need a deep merge so partial overrides work
    copperSettings: overrides.copperSettings
      ? { ...company.copperSettings, ...overrides.copperSettings }
      : company.copperSettings,
    accessoryPriceOverrides: overrides.accessoryPriceOverrides
      ? { ...company.accessoryPriceOverrides, ...overrides.accessoryPriceOverrides }
      : company.accessoryPriceOverrides,
    unitPricingTables: overrides.unitPricingTables
      ? mergeUnitPricingTables(overrides.unitPricingTables, company.unitPricingTables)
      : company.unitPricingTables,
    ductPrices: overrides.ductPrices
      ? { ...company.ductPrices, ...overrides.ductPrices }
      : company.ductPrices,
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

export const SettingsContext = createContext({});

// Matches /projects/<uuid-or-id> but NOT /projects (the list page)
const PROJECT_DETAIL_RE = /^\/projects\/[^/]+/;

export function SettingsProvider({ children }) {

  // ── Company config (DB-backed via /api/pricing) ───────────────────────────
  // NOTE: ductPrices are now embedded in companyConfig.ductPrices (DB-backed).
  //       The old localStorage 'globalPrices' key is migrated on first load below.
  const [companyConfig, setCompanyConfig] = useState(() => {
    try {
      const raw = localStorage.getItem('pricingConfig');
      if (!raw) return { ...DEFAULT_PRICING_CONFIG, copperSettings: DEFAULT_COPPER_SETTINGS, accessoryPriceOverrides: DEFAULT_ACCESSORY_OVERRIDES };
      return coerceCompanyConfig(JSON.parse(raw));
    } catch {
      return { ...DEFAULT_PRICING_CONFIG, copperSettings: DEFAULT_COPPER_SETTINGS, accessoryPriceOverrides: DEFAULT_ACCESSORY_OVERRIDES };
    }
  });
  const [configLoading, setConfigLoading] = useState(true);
  const [configError,   setConfigError]   = useState(null);

  // Load company config from DB on mount.
  // Also migrates any ductPrices that were previously stored in localStorage
  // ('globalPrices') into the DB on the first load where the DB has no ductPrices yet.
  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    pricingApi.getConfig()
      .then(res => {
        if (cancelled) return;
        const coerced = coerceCompanyConfig(res.data);

        // ── One-time localStorage → DB migration for ductPrices ──────────────
        // If the DB has no ductPrices yet but localStorage has user-customised
        // prices from the old system, migrate them up to DB automatically.
        if (!res.data.ductPrices) {
          try {
            const legacy = localStorage.getItem('globalPrices');
            if (legacy) {
              const legacyPrices = JSON.parse(legacy);
              coerced.ductPrices = { ...DEFAULT_DUCT_PRICES, ...legacyPrices };
              // Push to DB in the background (fire-and-forget)
              pricingApi.saveConfig({ ductPrices: coerced.ductPrices }).catch(() => {});
              localStorage.removeItem('globalPrices'); // clean up old key
            }
          } catch { /* ignore */ }
        }

        setCompanyConfig(coerced);
        try { localStorage.setItem('pricingConfig', JSON.stringify(coerced)); } catch {}
        setConfigError(null);
      })
      .catch(err => {
        if (cancelled) return;
        setConfigError(err?.response?.data?.error || err?.message || 'Could not load settings');
      })
      .finally(() => { if (!cancelled) setConfigLoading(false); });
    return () => { cancelled = true; };
  }, []);

  /** Save company-wide settings (Settings page only). Does NOT affect any project. */
  const saveCompanySettings = useCallback(async (updates) => {
    const next = { ...companyConfig, ...updates };
    setCompanyConfig(next);
    try { localStorage.setItem('pricingConfig', JSON.stringify(next)); } catch {}
    const res = await pricingApi.saveConfig(next);
    return res.data;
  }, [companyConfig]);

  // ── Project-level overrides ───────────────────────────────────────────────
  const [activeProjectId,  setActiveProjectId]  = useState(null);
  const [projectOverrides, setProjectOverrides] = useState({});    // keys that differ from company
  const [overridesLoading, setOverridesLoading] = useState(false);

  /**
   * Call when entering a project detail page.
   * Loads the project's stored overrides from the server.
   */
  const loadProjectSettings = useCallback(async (projectId) => {
    if (!projectId) return;
    setActiveProjectId(projectId);
    setOverridesLoading(true);
    try {
      const res = await projectSettingsApi.get(projectId);
      setProjectOverrides(res.data.overrides || {});
    } catch {
      setProjectOverrides({});
    } finally {
      setOverridesLoading(false);
    }
  }, []);

  /**
   * Save project-level overrides.
   * Only the changed keys are persisted — company config is never touched.
   */
  const saveProjectSettings = useCallback(async (overrides) => {
    if (!activeProjectId) throw new Error('No active project');
    const res = await projectSettingsApi.save(activeProjectId, overrides);
    setProjectOverrides(res.data.overrides || {});
    return res.data.overrides;
  }, [activeProjectId]);

  /**
   * Reset all project overrides → project falls back to company defaults.
   */
  const resetProjectSettings = useCallback(async () => {
    if (!activeProjectId) return;
    await projectSettingsApi.reset(activeProjectId);
    setProjectOverrides({});
  }, [activeProjectId]);

  /**
   * Manually clear the active project context.
   * Called when navigating to a non-project page (handled automatically below).
   */
  const clearProjectContext = useCallback(() => {
    setActiveProjectId(null);
    setProjectOverrides({});
  }, []);

  // ── URL-driven project context ────────────────────────────────────────────
  // Watch the URL so the active project always matches what is in the address
  // bar — regardless of which page mounts or unmounts.
  //
  // • Module pages  (/duct, /unit-schedule, …) carry ?projectId=<id>
  // • Project detail page (/projects/:id) has no query param — ProjectDetailPage
  //   calls loadProjectSettings explicitly; we leave it alone.
  // • Any other URL with no projectId → clear the context.

  const [searchParams] = useSearchParams();
  const location       = useLocation();
  const urlProjectId   = searchParams.get('projectId') || null;

  // Use a ref so the effect only re-runs when the URL actually changes,
  // not when activeProjectId changes as a side-effect of loading.
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;

  useEffect(() => {
    if (urlProjectId) {
      // A module was opened with ?projectId= — load if not already the active project
      if (urlProjectId !== activeProjectIdRef.current) {
        loadProjectSettings(urlProjectId);
      }
    } else if (!PROJECT_DETAIL_RE.test(location.pathname)) {
      // No projectId in URL and not on a project detail page → clear
      if (activeProjectIdRef.current) {
        setActiveProjectId(null);
        setProjectOverrides({});
      }
    }
    // Intentionally only re-runs when the URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlProjectId, location.pathname]);

  // ── Effective settings = company + project overrides ──────────────────────
  // This is what ALL modules consume via `pricingConfig`.
  // When no project is active (or no overrides), this equals companyConfig.
  const effectiveSettings = useMemo(
    () => mergeSettings(companyConfig, projectOverrides),
    [companyConfig, projectOverrides],
  );

  // ── Convenience accessors (unchanged API for existing modules) ────────────
  const copperSettings          = effectiveSettings.copperSettings          ?? DEFAULT_COPPER_SETTINGS;
  const accessoryPriceOverrides = effectiveSettings.accessoryPriceOverrides ?? DEFAULT_ACCESSORY_OVERRIDES;

  // ── Legacy alias: savePricingConfig ──────────────────────────────────────
  // Modules that call savePricingConfig directly should route to the right layer.
  // NOTE: Direct saves from modules (not Settings page) go to project overrides
  //       when a project is active, so company defaults stay clean.
  const savePricingConfig = useCallback(async (updates) => {
    if (activeProjectId) {
      return saveProjectSettings(updates);
    }
    return saveCompanySettings(updates);
  }, [activeProjectId, saveProjectSettings, saveCompanySettings]);

  // ── DB-backed duct prices ─────────────────────────────────────────────────
  // `prices` = effective duct prices (company defaults ← project overrides)
  // `setPrices` saves to project layer when inside a project, else company layer.
  const prices = effectiveSettings.ductPrices ?? DEFAULT_DUCT_PRICES;

  const setPrices = useCallback((value) => {
    const next = typeof value === 'function' ? value(prices) : value;
    savePricingConfig({ ductPrices: next }).catch(() => {});
  }, [prices, savePricingConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Legacy shim: overhead / setOverhead (used by MetalDuct module)
  const overhead = {
    overheadPct: effectiveSettings.overheadPct,
    profitPct:   effectiveSettings.profitPct,
  };

  const setOverhead = useCallback((value) => {
    const updates = typeof value === 'function' ? value(overhead) : value;
    // If inside a project, overhead change goes to project overrides
    if (activeProjectId) {
      const next = { ...projectOverrides, ...updates };
      setProjectOverrides(next);
      projectSettingsApi.save(activeProjectId, next).catch(() => {});
    } else {
      saveCompanySettings(updates).catch(() => {});
    }
  }, [overhead, activeProjectId, projectOverrides, saveCompanySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SettingsContext.Provider value={{
      // ── What modules use (always effective = company + project overrides) ──
      pricingConfig:          effectiveSettings,
      savePricingConfig,
      configLoading,
      configError,
      overhead,
      setOverhead,
      copperSettings,
      accessoryPriceOverrides,
      prices,
      setPrices,

      // ── Company-only layer (Settings page reads/writes this) ───────────────
      companySettings:        companyConfig,
      saveCompanySettings,

      // ── Project-level layer ────────────────────────────────────────────────
      activeProjectId,
      projectOverrides,
      overridesLoading,
      loadProjectSettings,
      saveProjectSettings,
      resetProjectSettings,
      clearProjectContext,

      // ── Helpers ───────────────────────────────────────────────────────────
      /** True if at least one key has been overridden for the active project. */
      hasProjectOverrides: Object.keys(projectOverrides).length > 0,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export default SettingsProvider;
