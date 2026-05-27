// components/ProjectSettingsOverride.jsx
//
// Compact settings override panel shown inside ProjectDetailPage.
//
// Displays company-wide defaults alongside any project-specific overrides.
// Estimators can change individual fields; changes are saved ONLY to the
// project — the company PricingConfig is never touched.
//
// Each overridden field shows a blue "override" badge.
// A "Reset to company default" button appears per field when overridden.
// A "Reset all" button clears every project override.

import React, { useState, useContext, useCallback, useEffect } from 'react';
import { SettingsContext } from '@contexts/SettingsContext';
import AccessoryPriceSettings from '@modules/UnitSchedule/AccessoryPriceSettings';
import {
  Settings2, RotateCcw, Save, ChevronDown, ChevronUp,
  Loader2, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(decimal) { return Math.round((decimal ?? 0) * 100); }
function fromPct(str) { return parseFloat(str) / 100; }

function isOverridden(overrides, key) {
  return overrides != null && Object.prototype.hasOwnProperty.call(overrides, key);
}

/** Count total non-empty accessory overrides across all sections. */
function countAccOverrides(accOverrides) {
  if (!accOverrides) return 0;
  return Object.values(accOverrides).reduce(
    (sum, section) =>
      sum + Object.values(section || {}).filter(v => v != null && v !== '').length,
    0
  );
}

// ── Field Components ──────────────────────────────────────────────────────────

function OverrideBadge() {
  return (
    <span className="ml-1.5 text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
      overridden
    </span>
  );
}

function RateField({ label, fieldKey, draft, overrides, companyVal, onChange, onReset }) {
  const overridden = isOverridden(overrides, fieldKey);
  const effective  = draft[fieldKey] ?? companyVal;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
          {label}
          {overridden && <OverrideBadge />}
        </label>
        {overridden && (
          <button type="button" onClick={() => onReset(fieldKey)}
            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5 transition-colors">
            <RotateCcw size={10} />
            Reset ({companyVal})
          </button>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
        <input
          type="number" min="0" step="0.50"
          value={effective}
          onChange={e => onChange(fieldKey, parseFloat(e.target.value) || 0)}
          className={`w-full text-sm pl-6 pr-8 py-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
            overridden
              ? 'border-blue-300 bg-blue-50 text-blue-900'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">/hr</span>
      </div>
      {!overridden && (
        <p className="text-[10px] text-gray-400">Company default</p>
      )}
    </div>
  );
}

function PctField({ label, fieldKey, draft, overrides, companyVal, onChange, onReset }) {
  const overridden = isOverridden(overrides, fieldKey);
  const effective  = draft[fieldKey] ?? companyVal;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
          {label}
          {overridden && <OverrideBadge />}
        </label>
        {overridden && (
          <button type="button" onClick={() => onReset(fieldKey)}
            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5 transition-colors">
            <RotateCcw size={10} />
            Reset ({pct(companyVal)}%)
          </button>
        )}
      </div>
      <div className="relative">
        <input
          type="number" min="0" max="100" step="1"
          value={pct(effective)}
          onChange={e => onChange(fieldKey, fromPct(e.target.value))}
          className={`w-full text-sm pr-7 pl-3 py-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
            overridden
              ? 'border-blue-300 bg-blue-50 text-blue-900'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">%</span>
      </div>
      {!overridden && (
        <p className="text-[10px] text-gray-400">Company default</p>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProjectSettingsOverride({ projectId }) {
  const {
    companySettings,
    pricingConfig,
    projectOverrides,
    overridesLoading,
    saveProjectSettings,
    resetProjectSettings,
    hasProjectOverrides,
  } = useContext(SettingsContext);

  const [open,      setOpen]      = useState(false);
  const [draft,     setDraft]     = useState(null);   // null = no unsaved flat-field changes
  const [accDraft,  setAccDraft]  = useState({});     // accessory price overrides
  const [saving,    setSaving]    = useState(false);
  const [resetting, setResetting] = useState(false);

  // Sync accDraft when project overrides are (re)loaded from the server
  useEffect(() => {
    setAccDraft(projectOverrides?.accessoryPriceOverrides ?? {});
  }, [projectOverrides]);

  // Effective draft = project overrides merged into company settings (for display)
  const effective     = { ...companySettings, ...projectOverrides };
  const displayDraft  = draft ?? effective;

  const set = useCallback((key, value) => {
    setDraft(prev => ({ ...(prev ?? effective), [key]: value }));
  }, [effective]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Reset a single flat field back to company default
  const resetField = useCallback((key) => {
    setDraft(prev => {
      const base = { ...(prev ?? effective) };
      base[key] = companySettings[key];
      return base;
    });
  }, [effective, companySettings]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Accessory handlers ──────────────────────────────────────────────────────

  const handleAccSet = useCallback((section, key, value) => {
    setAccDraft(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] ?? {}),
        [key]: value === '' ? '' : (parseFloat(value) || 0),
      },
    }));
  }, []);

  const handleAccReset = useCallback((section, key) => {
    setAccDraft(prev => {
      const updated = { ...prev };
      if (updated[section]) {
        updated[section] = { ...updated[section] };
        delete updated[section][key];
        if (Object.keys(updated[section]).length === 0) delete updated[section];
      }
      return updated;
    });
  }, []);

  const handleAccResetAll = useCallback(() => {
    setAccDraft({});
  }, []);

  // ── Override counting ────────────────────────────────────────────────────────

  // Flat field overrides (rates, pcts) — excludes copper and accessories
  const flatOverrideCount = draft
    ? Object.entries(draft).filter(([k, v]) => {
        if (k === 'copperSettings' || k === 'accessoryPriceOverrides') return false;
        return JSON.stringify(v) !== JSON.stringify(companySettings[k]);
      }).length
    : Object.keys(projectOverrides || {}).filter(
        k => k !== 'copperSettings' && k !== 'accessoryPriceOverrides'
      ).length;

  // Copper override: 1 if anything inside copperSettings differs from company
  const copperOverrideCount = (() => {
    const overriddenCopper = draft ? draft.copperSettings : projectOverrides?.copperSettings;
    const companyCopper    = companySettings?.copperSettings ?? {};
    return (overriddenCopper && JSON.stringify(overriddenCopper) !== JSON.stringify(companyCopper)) ? 1 : 0;
  })();

  const accOverrideCount = countAccOverrides(accDraft);
  const overrideCount    = flatOverrideCount + copperOverrideCount + accOverrideCount;

  // For per-field isOverridden checks on flat fields
  const flatDraftOverrides = draft
    ? Object.fromEntries(
        Object.entries(draft).filter(([k, v]) => {
          if (k === 'copperSettings' || k === 'accessoryPriceOverrides') return false;
          return JSON.stringify(v) !== JSON.stringify(companySettings[k]);
        })
      )
    : Object.fromEntries(
        Object.entries(projectOverrides || {}).filter(
          ([k]) => k !== 'copperSettings' && k !== 'accessoryPriceOverrides'
        )
      );

  // isDirty: flat fields changed OR accessory overrides changed vs saved state
  const accIsDirty = JSON.stringify(accDraft) !== JSON.stringify(projectOverrides?.accessoryPriceOverrides ?? {});
  const isDirty    = draft !== null || accIsDirty;

  // ── Save ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!isDirty) { toast('No changes to save.'); return; }
    setSaving(true);
    try {
      const payload = {};

      // 1. Flat fields (rates, pcts)
      const source = draft ?? effective;
      for (const [k, v] of Object.entries(source)) {
        if (k === 'copperSettings' || k === 'accessoryPriceOverrides') continue;
        if (JSON.stringify(v) !== JSON.stringify(companySettings[k])) {
          payload[k] = v;
        }
      }

      // 2. Copper settings (if overridden)
      const overriddenCopper = draft?.copperSettings ?? projectOverrides?.copperSettings;
      const companyCopper    = companySettings?.copperSettings ?? {};
      if (overriddenCopper && JSON.stringify(overriddenCopper) !== JSON.stringify(companyCopper)) {
        payload.copperSettings = overriddenCopper;
      }

      // 3. Accessory price overrides
      if (accOverrideCount > 0) {
        payload.accessoryPriceOverrides = accDraft;
      }

      await saveProjectSettings(payload);
      setDraft(null);
      toast.success('Project settings saved');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not save project settings');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    if (!window.confirm('Reset all project settings to company defaults?')) return;
    setResetting(true);
    try {
      await resetProjectSettings();
      setDraft(null);
      setAccDraft({});
      toast.success('Project settings reset to company defaults');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Could not reset settings');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Settings2 size={16} className="text-gray-400" />
          <span className="font-semibold text-gray-800 text-sm">Project Settings</span>
          {overrideCount > 0 && (
            <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
              {overrideCount} override{overrideCount !== 1 ? 's' : ''}
            </span>
          )}
          {overrideCount === 0 && !isDirty && (
            <span className="text-xs text-gray-400">Using company defaults</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {overridesLoading && <Loader2 size={13} className="animate-spin text-gray-400" />}
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">

          {/* Info banner */}
          <div className="flex items-start gap-2.5 px-5 py-3 bg-blue-50 border-b border-blue-100">
            <AlertCircle size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              Changes here apply <strong>only to this project</strong> and do not affect company settings.
              Fields showing <span className="font-semibold">blue</span> are overriding the company default.
            </p>
          </div>

          <div className="px-5 py-5 space-y-6">

            {/* Labor Rates */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Labor Rates ($/hr)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <RateField label="Packaged (RTU/AHU)" fieldKey="ratePackaged"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.ratePackaged}
                  onChange={set} onReset={resetField} />
                <RateField label="Split Systems" fieldKey="rateSplit"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.rateSplit}
                  onChange={set} onReset={resetField} />
                <RateField label="Wall-Mount / Mini-Split" fieldKey="rateWallMount"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.rateWallMount}
                  onChange={set} onReset={resetField} />
                <RateField label="VRF Systems" fieldKey="rateVrf"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.rateVrf}
                  onChange={set} onReset={resetField} />
                <RateField label="Sheet Metal / Duct" fieldKey="rateDuct"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.rateDuct}
                  onChange={set} onReset={resetField} />
                <RateField label="Fans" fieldKey="rateFan"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.rateFan}
                  onChange={set} onReset={resetField} />
                <RateField label="Piping (CW)" fieldKey="ratePipe"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.ratePipe}
                  onChange={set} onReset={resetField} />
                <RateField label="Electrical / Controls" fieldKey="rateElec"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.rateElec}
                  onChange={set} onReset={resetField} />
              </div>
            </div>

            {/* Markup & Waste */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Markup &amp; Waste</h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <PctField label="Overhead %" fieldKey="overheadPct"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.overheadPct}
                  onChange={set} onReset={resetField} />
                <PctField label="Profit %" fieldKey="profitPct"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.profitPct}
                  onChange={set} onReset={resetField} />
                <PctField label="Tax %" fieldKey="taxPct"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.taxPct}
                  onChange={set} onReset={resetField} />
                <PctField label="Duct Waste" fieldKey="ductWastePct"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.ductWastePct}
                  onChange={set} onReset={resetField} />
                <PctField label="Pipe Waste" fieldKey="pipeWastePct"
                  draft={displayDraft} overrides={flatDraftOverrides}
                  companyVal={companySettings.pipeWastePct}
                  onChange={set} onReset={resetField} />
              </div>
            </div>

            {/* Copper LME override */}
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Copper</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <LmePriceField
                  draft={displayDraft}
                  companyVal={companySettings.copperSettings?.lmeCopperPrice ?? 4.25}
                  overrides={projectOverrides}
                  onChange={(lme) => {
                    setDraft(prev => {
                      const base = prev ?? effective;
                      return {
                        ...base,
                        copperSettings: { ...(base.copperSettings ?? {}), lmeCopperPrice: lme },
                      };
                    });
                  }}
                  onReset={() => {
                    setDraft(prev => {
                      const base = { ...(prev ?? effective) };
                      const companyCopperSettings = companySettings.copperSettings ?? {};
                      base.copperSettings = {
                        ...(base.copperSettings ?? {}),
                        lmeCopperPrice: companyCopperSettings.lmeCopperPrice ?? 4.25,
                      };
                      return base;
                    });
                  }}
                />
              </div>
            </div>

            {/* Accessory Prices */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Accessory Material Prices
                </h3>
                {accOverrideCount > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">
                    {accOverrideCount} overridden
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Override accessory prices for this project only.
                Blank fields use the company default tonnage-based tables.
              </p>
              <AccessoryPriceSettings
                overrides={accDraft}
                pricingTables={pricingConfig?.unitPricingTables ?? companySettings?.unitPricingTables}
                onSet={handleAccSet}
                onReset={handleAccReset}
                onResetAll={handleAccResetAll}
                standalone
              />
            </div>

          </div>

          {/* Save / Reset bar */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50 border-t border-gray-100">
            <button
              type="button"
              onClick={handleResetAll}
              disabled={(!hasProjectOverrides && !isDirty) || resetting}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 disabled:opacity-40 transition-colors"
            >
              {resetting
                ? <Loader2 size={12} className="animate-spin" />
                : <RotateCcw size={12} />}
              Reset all to company defaults
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving
                ? <Loader2 size={12} className="animate-spin" />
                : <Save size={12} />}
              {saving ? 'Saving…' : 'Save project settings'}
            </button>
          </div>

        </div>
      )}
    </div>
  );
}

// ── LME Price field (nested inside copperSettings) ────────────────────────────

function LmePriceField({ draft, companyVal, overrides, onChange, onReset }) {
  const projectCopperOverride = overrides?.copperSettings?.lmeCopperPrice;
  const overridden = projectCopperOverride !== undefined;
  const effective  = draft?.copperSettings?.lmeCopperPrice ?? companyVal;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
          LME Copper ($/lb)
          {overridden && <OverrideBadge />}
        </label>
        {overridden && (
          <button type="button" onClick={onReset}
            className="text-[10px] text-gray-400 hover:text-red-500 flex items-center gap-0.5 transition-colors">
            <RotateCcw size={10} />
            Reset (${companyVal})
          </button>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
        <input
          type="number" min="0" step="0.01"
          value={effective}
          onChange={e => onChange(parseFloat(e.target.value) || 4.25)}
          className={`w-full text-sm pl-6 pr-3 py-1.5 rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 ${
            overridden
              ? 'border-blue-300 bg-blue-50 text-blue-900'
              : 'border-gray-200 bg-white text-gray-700'
          }`}
        />
      </div>
      {!overridden && <p className="text-[10px] text-gray-400">Company default</p>}
    </div>
  );
}
