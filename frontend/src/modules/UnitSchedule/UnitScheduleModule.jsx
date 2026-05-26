/**
 * Unit Schedule Module
 * Implements the "Unit Sched", "Fan Schedule", and "Louvers & FD" Excel tabs.
 *
 * Productivity features:
 *   • Auto-naming        — next sequential tag pre-filled on Add
 *   • Bulk Add           — x N control adds N sequentially-named rows at once
 *   • Duplicate          — deep-clone a row, inserted directly below original
 *   • Expand/Collapse All — per-section buttons open/close all accessory panels
 *   • Row Templates      — save any row as a named template, re-insert in one click
 *   • CSV Import         — paste or upload CSV to bulk-populate any section
 *   • Live Dashboard     — totals written to localStorage for the project dashboard
 *   • Copy From Project  — clone a section from a previously saved project snapshot
 */
import React, { useState, useCallback, useMemo, useEffect, useContext } from 'react';
import { Plus, Download, ChevronDown, ChevronUp, Info, Upload, Copy as CopyIcon, Play, Settings2, Zap, LayoutList } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEMO_UNIT_SCHEDULE } from '@utils/demoData';
import {
  calcServiceBatch,
  calcPackagedBatch,
  calcSplitBatch,
  calcWallMountBatch,
  calcVRFBatch,
  calcFanBatch,
  calcLouverDamperBatch,
  rollUpUnitSummary,
  SYSTEM_TYPES,
  FAN_TYPES,
  LOUVER_DAMPER_TYPES,
  TECH_RATE,
  SPLIT_TECH_RATE,
  WALL_MOUNT_TECH_RATE,
  VRF_TECH_RATE,
} from '@utils/unitScheduleCalculations';
import { saveModuleTotals } from '@utils/projectTotals';
import { useEstimate } from '@hooks/useEstimate';
import EstimateProjectBanner from '@components/EstimateProjectBanner';
import { SectionExpandContext } from './shared';
import { TemplatesPanel } from './TemplatesModal';
import CsvImportModal from './CsvImportModal';
import { SettingsContext, DEFAULT_COPPER_SETTINGS, DEFAULT_ACCESSORY_OVERRIDES } from '@contexts/SettingsContext';
import AccessoryPriceSettings from './AccessoryPriceSettings';
import ServiceRow       from './ServiceRow';
import PackagedRow      from './PackagedRow';
import SplitRow         from './SplitRow';
import WallMountRow     from './WallMountRow';
import VRFRow           from './VRFRow';
import FanRow           from './FanRow';
import LouverDamperRow  from './LouverDamperRow';
import UnitSummaryPanel from './UnitSummaryPanel';

// Auto-naming: scans last row, increments trailing number
// EF-2 -> EF-3  |  RTU-09 -> RTU-10  |  L5 -> L6
function autoNextName(rows) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const name = rows[i]?.name?.trim();
    if (!name) continue;
    const m = name.match(/^(.*?)(\d+)(\s*)$/);
    if (m) {
      const prefix   = m[1];
      const num      = parseInt(m[2], 10);
      const padWidth = m[2].length;
      const next     = String(num + 1).padStart(padWidth, '0');
      return `${prefix}${next}`;
    }
    return '';
  }
  return '';
}

// Row factories
const newServiceRow = (id) => ({
  id, name: '', coolTons: 0, systemType: SYSTEM_TYPES.PACKAGED,
  pmMaterials: 0, pmLabor: 0,
});
const newPackagedRow = (id) => ({
  id, name: '', coolTons: 0, ownerProvided: '',
  baseCostPerTon: 0, quotedEquipCost: null,
  miscPct: 3,
  accessories: {
    standardCurb: '', metalRoofCurb: '', curbAdapter: '', economizer: '',
    pvcCond: '', cuCond: '', thermostat: '', smokeDetectors: '',
    sensorQty: 0, newDrops: '', drumLouvers: '',
  },
});
// Copper sub-object for Split, Wall Mount, and VRF rows.
// mode: null = user hasn't chosen yet — panel prompts them to pick.
// copperType: K/L/M per row — directly affects cost (K is heavier = more expensive).
// LME price and safety factors are global company settings (Settings → Copper tab).
export const DEFAULT_COPPER = {
  mode:              'manual', // always run-length mode
  copperType:        'L',      // 'K' | 'L' | 'M' — per row, weight ratio scales material & labor
  avgLengthFt:       0,        // avg run length per unit (ft)
  includeInsulation: true,     // include closed-cell foam insulation cost
};

const newSplitRow = (id) => ({
  id, name: '', coolTons: 0, ownerProvided: '',
  baseCostPerTon: 0, quotedEquipCost: null,
  miscPct: 3,
  copper: { ...DEFAULT_COPPER },
  accessories: {
    condenserRails: '', drainPan: '', oaDamper: '', floatSwitch: '',
    pvcCond: '', cuCond: '', thermostat: '', smokeDetectors: '',
    sensorQty: 0, ductTransitions: '',
  },
});
const newWallMountRow = (id) => ({
  id, name: '', coolTons: 0, ownerProvided: '',
  baseCostPerTon: 0, quotedEquipCost: null,
  miscPct: 3,
  copper: { ...DEFAULT_COPPER },
  accessories: {
    condenserRails: '', condPump: '',
    pvcCond: '', cuCond: '', thermostat: '',
  },
});
const newVRFRow = (id) => ({
  id, name: '', coolTons: 0, condensingUnits: 1, indoorUnits: 1,
  indoorCoolAvgTons: 0, ownerProvided: '', baseCostPerTon: 0,
  quotedEquipCost: null, cuLineAvgLength: 0,
  miscPct: 3,
  copper: { ...DEFAULT_COPPER },
  accessories: {
    condenserRails: '', drainPan: '',
    pvcCond: '', cuCond: '', thermostat: '', smokeDetectors: '', sensorQty: 0,
  },
});
const newFanRow = (id) => ({
  id, name: '', type: FAN_TYPES[0], cfm: 0,
  mount: 'Roof', drive: 'Direct Drive',
  ownerProvided: '', unitPrice: 0, quotedEquipCost: null,
  miscPct: 3,
  accessories: {
    disconnectSwitch: '', gfiOutlet: '', backdraftDamper: '',
    curb: '', flexConnection: '', vfd: '', birdScreen: '', wiring: '',
  },
});
const newLouverDamperRow = (id) => ({
  id, name: '', type: LOUVER_DAMPER_TYPES[0],
  widthIn: 0, heightIn: 0, qty: 1,
  ownerProvided: '', unitPrice: 0,
  miscPct: 3,
  accessories: { screen: '', actuator: '', sleeve: '' },
});

// Tab config
const TABS = [
  { id: 'service',      label: 'Service Existing',  color: 'blue'   },
  { id: 'packaged',     label: 'Packaged Units',    color: 'purple' },
  { id: 'split',        label: 'Split Systems',     color: 'green'  },
  { id: 'wallMount',    label: 'Wall Mount',        color: 'orange' },
  { id: 'vrf',          label: 'VRF Systems',       color: 'red'    },
  { id: 'fans',         label: 'Fans',              color: 'cyan'   },
  { id: 'louverDamper', label: 'Louvers & Dampers', color: 'teal'   },
];

const TAB_COLOR_CLASSES = {
  blue:   { active: 'border-blue-600 text-blue-700 bg-blue-50',         dot: 'bg-blue-500'   },
  purple: { active: 'border-purple-600 text-purple-700 bg-purple-50',   dot: 'bg-purple-500' },
  green:  { active: 'border-green-600 text-green-700 bg-green-50',      dot: 'bg-green-500'  },
  orange: { active: 'border-orange-500 text-orange-700 bg-orange-50',   dot: 'bg-orange-500' },
  red:    { active: 'border-red-600 text-red-700 bg-red-50',            dot: 'bg-red-500'    },
  cyan:   { active: 'border-cyan-600 text-cyan-700 bg-cyan-50',         dot: 'bg-cyan-500'   },
  teal:   { active: 'border-teal-600 text-teal-700 bg-teal-50',         dot: 'bg-teal-500'   },
};

// Copy-from-project
function loadProjectSnapshots() {
  try { return JSON.parse(localStorage.getItem('unit_schedule_project_snapshots') || '[]'); }
  catch { return []; }
}

function CopyFromProjectBtn({ sectionKey, onImport }) {
  const [open, setOpen] = useState(false);
  const snapshots = loadProjectSnapshots();
  const available = snapshots.filter(s => s.sections?.[sectionKey]?.length > 0);
  if (available.length === 0) return null;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        title="Copy rows from a saved project">
        <CopyIcon size={12} /> Copy from project
      </button>
      {open && (
        <div className="absolute z-40 left-0 top-6 bg-white rounded-xl shadow-xl border border-gray-200 w-64">
          <div className="px-4 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Saved Projects
          </div>
          <ul className="max-h-48 overflow-y-auto divide-y divide-gray-50">
            {available.map(s => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-gray-50">
                <div>
                  <div className="text-sm text-gray-700 font-medium">{s.projectName || 'Unnamed'}</div>
                  <div className="text-xs text-gray-400">
                    {s.sections[sectionKey].length} rows &middot; {new Date(s.savedAt).toLocaleDateString()}
                  </div>
                </div>
                <button type="button"
                  onClick={() => {
                    onImport(s.sections[sectionKey]);
                    setOpen(false);
                    toast.success(`Copied ${s.sections[sectionKey].length} rows from "${s.projectName || 'project'}"`);
                  }}
                  className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-2 py-0.5 rounded font-medium">
                  Copy
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Main component
export default function UnitScheduleModule({ projectInfo }) {
  const { accessoryPriceOverrides, pricingConfig, savePricingConfig, activeProjectId } = useContext(SettingsContext);

  const [activeTab, setActiveTab]           = useState('service');
  const [showTechRates, setShowTechRates]   = useState(false);
  const [showCopperSettings, setShowCopperSettings] = useState(false);
  const [showAccSettings,    setShowAccSettings]    = useState(false);

  // Local drafts for inline settings panels (null = unchanged from global)
  const [copperDraft, setCopperDraft] = useState(null);
  const [accDraft,    setAccDraft]    = useState(null);

  // Per-type tech rates — initialized from pricingConfig (company defaults or
  // project-level overrides); sync automatically when context changes so that
  // any project override set in ProjectSettingsOverride flows through here.
  const [techRates, setTechRates] = useState(() => ({
    packaged:  pricingConfig.ratePackaged  ?? TECH_RATE,
    split:     pricingConfig.rateSplit     ?? SPLIT_TECH_RATE,
    wallMount: pricingConfig.rateWallMount ?? WALL_MOUNT_TECH_RATE,
    vrf:       pricingConfig.rateVrf       ?? VRF_TECH_RATE,
  }));

  // When project settings are loaded/changed, keep tech rates in sync.
  // (This does NOT clobber in-session manual edits unless the context actually changes.)
  useEffect(() => {
    setTechRates({
      packaged:  pricingConfig.ratePackaged  ?? TECH_RATE,
      split:     pricingConfig.rateSplit     ?? SPLIT_TECH_RATE,
      wallMount: pricingConfig.rateWallMount ?? WALL_MOUNT_TECH_RATE,
      vrf:       pricingConfig.rateVrf       ?? VRF_TECH_RATE,
    });
  }, [ // eslint-disable-line react-hooks/exhaustive-deps
    pricingConfig.ratePackaged,
    pricingConfig.rateSplit,
    pricingConfig.rateWallMount,
    pricingConfig.rateVrf,
  ]);


  const [serviceRows,      setServiceRows]      = useState([newServiceRow('s-1'), newServiceRow('s-2')]);
  const [packagedRows,     setPackagedRows]     = useState([newPackagedRow('p-1')]);
  const [splitRows,        setSplitRows]        = useState([newSplitRow('sp-1')]);
  const [wallMountRows,    setWallMountRows]    = useState([newWallMountRow('wm-1')]);
  const [vrfRows,          setVRFRows]          = useState([newVRFRow('v-1')]);
  const [fanRows,          setFanRows]          = useState([newFanRow('f-1')]);
  const [louverDamperRows, setLouverDamperRows] = useState([newLouverDamperRow('ld-1')]);
  const { projectId, projectName, loadEstimate, saveEstimate, saving, lastSaved, saveError } = useEstimate('UNIT_SCHEDULE');

  // Effective accessory overrides: local draft (unsaved) takes precedence over global context
  const effAccOverrides = accDraft ?? accessoryPriceOverrides;

  // Inject per-type tech rate + price overrides into each row before batch calc
  const serviceResults  = useMemo(() => calcServiceBatch(serviceRows), [serviceRows]);
  const packagedResults = useMemo(
    () => calcPackagedBatch(packagedRows.map(r => ({ ...r, priceOverrides: effAccOverrides.packaged }))),
    [packagedRows, effAccOverrides.packaged] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const splitResults = useMemo(
    () => calcSplitBatch(splitRows.map(r => ({
      ...r,
      techRate:       techRates.split,
      priceOverrides: effAccOverrides.split,
    }))),
    [splitRows, techRates.split, effAccOverrides.split] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const wallMountResults = useMemo(
    () => calcWallMountBatch(wallMountRows.map(r => ({
      ...r,
      techRate:       techRates.wallMount,
      priceOverrides: effAccOverrides.wallMount,
    }))),
    [wallMountRows, techRates.wallMount, effAccOverrides.wallMount] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const vrfResults = useMemo(
    () => calcVRFBatch(vrfRows.map(r => ({
      ...r,
      techRate:       techRates.vrf,
      priceOverrides: effAccOverrides.vrf,
    }))),
    [vrfRows, techRates.vrf, effAccOverrides.vrf] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const fanResults          = useMemo(() => calcFanBatch(fanRows),                   [fanRows]);
  const louverDamperResults = useMemo(() => calcLouverDamperBatch(louverDamperRows), [louverDamperRows]);

  const summary = useMemo(() => rollUpUnitSummary({
    serviceTotals:      serviceResults.totals,
    packagedTotals:     packagedResults.totals,
    splitTotals:        splitResults.totals,
    wallMountTotals:    wallMountResults.totals,
    vrfTotals:          vrfResults.totals,
    fanTotals:          fanResults.totals,
    louverDamperTotals: louverDamperResults.totals,
  }), [serviceResults, packagedResults, splitResults, wallMountResults, vrfResults, fanResults, louverDamperResults]);

  // Push totals to dashboard
  useEffect(() => {
    saveModuleTotals('unit_schedule', summary.grand);
  }, [summary]);

  // Auto-save to DB (debounced 2s) whenever rows or summary change
  useEffect(() => {
    if (!projectId) return;
    const timer = setTimeout(() => {
      saveEstimate({
        rowsJson: {
          serviceRows, packagedRows, splitRows,
          wallMountRows, vrfRows, fanRows, louverDamperRows,
        },
        totalMaterial: summary.grand.totalMaterial,
        totalLabor:    summary.grand.totalLabor,
        totalCost:     summary.grand.totalCost,
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [projectId, saveEstimate, summary, serviceRows, packagedRows, splitRows, wallMountRows, vrfRows, fanRows, louverDamperRows]);

  // Load from DB if in project context; otherwise fall back to demo mode
  useEffect(() => {
    if (projectId) {
      loadEstimate().then(est => {
        if (!est?.rowsJson || typeof est.rowsJson !== 'object') return;
        const d = est.rowsJson;
        if (d.serviceRows?.length)      setServiceRows(d.serviceRows);
        if (d.packagedRows?.length)     setPackagedRows(d.packagedRows);
        if (d.splitRows?.length)        setSplitRows(d.splitRows);
        if (d.wallMountRows?.length)    setWallMountRows(d.wallMountRows);
        if (d.vrfRows?.length)          setVRFRows(d.vrfRows);
        if (d.fanRows?.length)          setFanRows(d.fanRows);
        if (d.louverDamperRows?.length) setLouverDamperRows(d.louverDamperRows);
      });
      return;
    }
    if (localStorage.getItem('demo_mode') !== 'true') return;
    try {
      const saved = localStorage.getItem('demo_unit_schedule');
      if (!saved) return;
      const d = JSON.parse(saved);
      if (d.serviceRows?.length)      setServiceRows(d.serviceRows);
      if (d.packagedRows?.length)     setPackagedRows(d.packagedRows);
      if (d.splitRows?.length)        setSplitRows(d.splitRows);
      if (d.wallMountRows?.length)    setWallMountRows(d.wallMountRows);
      if (d.vrfRows?.length)          setVRFRows(d.vrfRows);
      if (d.fanRows?.length)          setFanRows(d.fanRows);
      if (d.louverDamperRows?.length) setLouverDamperRows(d.louverDamperRows);
    } catch (_) {}
  }, [loadEstimate, projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save snapshot for "Copy From Project"
  const saveSnapshot = useCallback(() => {
    const existing = loadProjectSnapshots();
    const snapshot = {
      id:          `snap-${Date.now()}`,
      projectName: projectInfo?.projectName || 'Unnamed project',
      savedAt:     Date.now(),
      sections: {
        service:      serviceRows,
        packaged:     packagedRows,
        split:        splitRows,
        wallMount:    wallMountRows,
        vrf:          vrfRows,
        fans:         fanRows,
        louverDamper: louverDamperRows,
      },
    };
    const updated = [snapshot, ...existing].slice(0, 10);
    localStorage.setItem('unit_schedule_project_snapshots', JSON.stringify(updated));
    toast.success(`Snapshot "${snapshot.projectName}" saved`);
  }, [projectInfo, serviceRows, packagedRows, splitRows, wallMountRows, vrfRows, fanRows, louverDamperRows]);

  // Generic updater — handles nested sub-objects via dot notation:
  //   'accessories.key'      → merges into row.accessories
  //   'copper.key'           → merges into row.copper (LME pricing params)
  //   'copperPricingResult'  → top-level field (API response cache)
  //   anything else          → top-level field
  const makeUpdater = (setter) =>
    useCallback((id, field, value) => { // eslint-disable-line react-hooks/rules-of-hooks
      setter(prev => prev.map(r => {
        if (r.id !== id) return r;
        if (field.startsWith('accessories.')) {
          const k = field.split('.').slice(1).join('.');
          return { ...r, accessories: { ...r.accessories, [k]: value } };
        }
        if (field.startsWith('copper.')) {
          const k = field.split('.').slice(1).join('.');
          return { ...r, copper: { ...(r.copper || {}), [k]: value } };
        }
        return { ...r, [field]: value };
      }));
    }, [setter]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateService      = makeUpdater(setServiceRows);
  const updatePackaged     = makeUpdater(setPackagedRows);
  const updateSplit        = makeUpdater(setSplitRows);
  const updateWallMount    = makeUpdater(setWallMountRows);
  const updateVRF          = makeUpdater(setVRFRows);
  const updateFan          = makeUpdater(setFanRows);
  const updateLouverDamper = makeUpdater(setLouverDamperRows);

  const removeRow = (setter, id) => setter(prev => prev.filter(r => r.id !== id));

  const duplicateRow = (setter, id, prefix) => {
    setter(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const clone = {
        ...JSON.parse(JSON.stringify(original)),
        id:   `${prefix}-${Date.now()}`,
        name: original.name ? `${original.name} (copy)` : '(copy)',
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    toast.success('Row duplicated');
  };

  const makeAdder = (setter, factory, prefix) =>
    (count = 1) => {
      setter(prev => {
        let current = [...prev];
        for (let i = 0; i < count; i++) {
          const nextName = autoNextName(current);
          const row = { ...factory(`${prefix}-${Date.now()}-${i}`), name: nextName };
          current = [...current, row];
        }
        return current;
      });
      if (count > 1) toast.success(`${count} rows added`);
    };

  const addServiceRow      = makeAdder(setServiceRows,      newServiceRow,      's');
  const addPackagedRow     = makeAdder(setPackagedRows,     newPackagedRow,     'p');
  const addSplitRow        = makeAdder(setSplitRows,        newSplitRow,        'sp');
  const addWallMountRow    = makeAdder(setWallMountRows,    newWallMountRow,    'wm');
  const addVRFRow          = makeAdder(setVRFRows,          newVRFRow,          'v');
  const addFanRow          = makeAdder(setFanRows,          newFanRow,          'f');
  const addLouverDamperRow = makeAdder(setLouverDamperRows, newLouverDamperRow, 'ld');

  const makeImporter = (setter, factory, prefix) =>
    (partialRows) => {
      setter(prev => {
        const newRows = partialRows.map((partial, i) => ({
          ...factory(`${prefix}-imp-${Date.now()}-${i}`),
          ...partial,
        }));
        return [...prev, ...newRows];
      });
    };

  const importServiceRows      = makeImporter(setServiceRows,      newServiceRow,      's');
  const importPackagedRows     = makeImporter(setPackagedRows,     newPackagedRow,     'p');
  const importSplitRows        = makeImporter(setSplitRows,        newSplitRow,        'sp');
  const importWallMountRows    = makeImporter(setWallMountRows,    newWallMountRow,    'wm');
  const importVRFRows          = makeImporter(setVRFRows,          newVRFRow,          'v');
  const importFanRows          = makeImporter(setFanRows,          newFanRow,          'f');
  const importLouverDamperRows = makeImporter(setLouverDamperRows, newLouverDamperRow, 'ld');

  const makeTemplateInserter = (setter, factory, prefix) =>
    (templateData) => {
      setter(prev => [...prev, { ...factory(`${prefix}-tpl-${Date.now()}`), ...templateData }]);
    };

  const insertServiceTemplate      = makeTemplateInserter(setServiceRows,      newServiceRow,      's');
  const insertPackagedTemplate     = makeTemplateInserter(setPackagedRows,     newPackagedRow,     'p');
  const insertSplitTemplate        = makeTemplateInserter(setSplitRows,        newSplitRow,        'sp');
  const insertWallMountTemplate    = makeTemplateInserter(setWallMountRows,    newWallMountRow,    'wm');
  const insertVRFTemplate          = makeTemplateInserter(setVRFRows,          newVRFRow,          'v');
  const insertFanTemplate          = makeTemplateInserter(setFanRows,          newFanRow,          'f');
  const insertLouverDamperTemplate = makeTemplateInserter(setLouverDamperRows, newLouverDamperRow, 'ld');

  const exportCSV = () => {
    const f = (n) => (n || 0).toFixed(2);
    const lines = [['Section','#','Name','Qty/Tons','Total Material $','Total Labor $','Total Cost $'].join(',')];
    const addSection = (label, rows, results, sizeKey = 'coolTons') => {
      results.rows.forEach((r, i) => {
        lines.push([label, i + 1, r.name || '', r[sizeKey] || 0,
          f(r.totalMaterial), f(r.totalLabor), f(r.totalCost)].join(','));
      });
    };
    addSection('Service Existing', serviceRows,      serviceResults,      'coolTons');
    addSection('Packaged Units',   packagedRows,     packagedResults,     'coolTons');
    addSection('Split Systems',    splitRows,        splitResults,        'coolTons');
    addSection('Wall Mount',       wallMountRows,    wallMountResults,    'coolTons');
    addSection('VRF Systems',      vrfRows,          vrfResults,          'coolTons');
    addSection('Fans',             fanRows,          fanResults,          'cfm');
    addSection('Louvers/Dampers',  louverDamperRows, louverDamperResults, 'qty');
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'unit_schedule.csv';
    a.click();
    toast.success('Unit Schedule exported');
  };

  // ── Inline Copper Settings handlers ────────────────────────────────────────
  const cs = pricingConfig?.copperSettings ?? DEFAULT_COPPER_SETTINGS;

  const setCopperField = (key, value) =>
    setCopperDraft(prev => ({ ...(prev ?? cs), [key]: value }));

  const setCopperSafetyFactor = (equipType, value) =>
    setCopperDraft(prev => {
      const base = prev ?? cs;
      return { ...base, safetyFactors: { ...base.safetyFactors, [equipType]: value } };
    });

  const applyCopperSettings = async () => {
    const draft = copperDraft;
    if (!draft) return;
    if (!activeProjectId) return; // guard — should never happen now that button is disabled
    try {
      // Send ONLY the copperSettings key — never spread entire pricingConfig,
      // which would write all rates as project overrides even if unchanged.
      await savePricingConfig({ copperSettings: draft });
      setCopperDraft(null);
      toast.success('Copper settings saved for this project');
    } catch { toast.error('Could not save copper settings'); }
  };

  // ── Inline Accessory Price handlers ──────────────────────────────────────
  const handleAccSet = (section, key, value) =>
    setAccDraft(prev => {
      const ao = prev ?? accessoryPriceOverrides;
      return { ...ao, [section]: { ...ao[section], [key]: value } };
    });

  const handleAccReset = (section, key) =>
    setAccDraft(prev => {
      const ao = prev ?? accessoryPriceOverrides;
      const next = { ...ao[section] };
      delete next[key];
      return { ...ao, [section]: next };
    });

  const handleAccResetAll = () => setAccDraft(DEFAULT_ACCESSORY_OVERRIDES);

  const applyAccSettings = async () => {
    const draft = accDraft;
    if (!draft) return;
    if (!activeProjectId) return; // guard — should never happen now that button is disabled
    try {
      // Send ONLY accessoryPriceOverrides — never spread entire pricingConfig.
      await savePricingConfig({ accessoryPriceOverrides: draft });
      setAccDraft(null);
      toast.success('Accessory prices saved for this project');
    } catch { toast.error('Could not save accessory prices'); }
  };

  const rowCounts = {
    service:      serviceRows.length,
    packaged:     packagedRows.length,
    split:        splitRows.length,
    wallMount:    wallMountRows.length,
    vrf:          vrfRows.length,
    fans:         fanRows.length,
    louverDamper: louverDamperRows.length,
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'service':
        return (
          <SectionWrapper title="Service of Existing Units"
            subtitle="PM service visits — material and labor by system type and tonnage"
            sectionKey="service" totals={serviceResults.totals}
            onAdd={addServiceRow} onImportRows={importServiceRows} onInsertTemplate={insertServiceTemplate}>
            {serviceRows.map((row, i) => {
              const result = serviceResults.rows.find(r => r.id === row.id) || {};
              return (
                <ServiceRow key={row.id} row={row} result={result} index={i}
                  onChange={updateService}
                  onRemove={() => removeRow(setServiceRows, row.id)}
                  onDuplicate={() => duplicateRow(setServiceRows, row.id, 's')} />
              );
            })}
          </SectionWrapper>
        );
      case 'packaged':
        return (
          <SectionWrapper title="New Packaged Units"
            subtitle="Rooftop / packaged units with curbs, economizers, and accessories"
            sectionKey="packaged" totals={packagedResults.totals}
            onAdd={addPackagedRow} onImportRows={importPackagedRows} onInsertTemplate={insertPackagedTemplate}>
            {packagedRows.map((row, i) => {
              const result = packagedResults.rows.find(r => r.id === row.id) || {};
              return (
                <PackagedRow key={row.id} row={row} result={result} index={i}
                  onChange={updatePackaged}
                  onRemove={() => removeRow(setPackagedRows, row.id)}
                  onDuplicate={() => duplicateRow(setPackagedRows, row.id, 'p')} />
              );
            })}
          </SectionWrapper>
        );
      case 'split':
        return (
          <SectionWrapper title="Split Systems"
            subtitle="Standard splits with condensers, copper lines, and accessories"
            sectionKey="split" totals={splitResults.totals}
            onAdd={addSplitRow} onImportRows={importSplitRows} onInsertTemplate={insertSplitTemplate}>
            {splitRows.map((row, i) => {
              const result = splitResults.rows.find(r => r.id === row.id) || {};
              return (
                <SplitRow key={row.id} row={row} result={result} index={i}
                  onChange={updateSplit}
                  onRemove={() => removeRow(setSplitRows, row.id)}
                  onDuplicate={() => duplicateRow(setSplitRows, row.id, 'sp')} />
              );
            })}
          </SectionWrapper>
        );
      case 'wallMount':
        return (
          <SectionWrapper title="Wall Mounted Split Systems"
            subtitle="Mini-split / ductless units with condensate pump and copper lines"
            sectionKey="wallMount" totals={wallMountResults.totals}
            onAdd={addWallMountRow} onImportRows={importWallMountRows} onInsertTemplate={insertWallMountTemplate}>
            {wallMountRows.map((row, i) => {
              const result = wallMountResults.rows.find(r => r.id === row.id) || {};
              return (
                <WallMountRow key={row.id} row={row} result={result} index={i}
                  onChange={updateWallMount}
                  onRemove={() => removeRow(setWallMountRows, row.id)}
                  onDuplicate={() => duplicateRow(setWallMountRows, row.id, 'wm')} />
              );
            })}
          </SectionWrapper>
        );
      case 'vrf':
        return (
          <SectionWrapper title="VRF Systems"
            subtitle="Variable refrigerant flow — multi-zone, multiple condensing and indoor units"
            sectionKey="vrf" totals={vrfResults.totals}
            onAdd={addVRFRow} onImportRows={importVRFRows} onInsertTemplate={insertVRFTemplate}>
            {vrfRows.map((row, i) => {
              const result = vrfResults.rows.find(r => r.id === row.id) || {};
              return (
                <VRFRow key={row.id} row={row} result={result} index={i}
                  onChange={updateVRF}
                  onRemove={() => removeRow(setVRFRows, row.id)}
                  onDuplicate={() => duplicateRow(setVRFRows, row.id, 'v')} />
              );
            })}
          </SectionWrapper>
        );
      case 'fans':
        return (
          <SectionWrapper title="Fans"
            subtitle="Exhaust, supply, kitchen, and power ventilator fans — sized by CFM"
            sectionKey="fans" totals={fanResults.totals}
            onAdd={addFanRow} onImportRows={importFanRows} onInsertTemplate={insertFanTemplate}>
            {fanRows.map((row, i) => {
              const result = fanResults.rows.find(r => r.id === row.id) || {};
              return (
                <FanRow key={row.id} row={row} result={result} index={i}
                  onChange={updateFan}
                  onRemove={() => removeRow(setFanRows, row.id)}
                  onDuplicate={() => duplicateRow(setFanRows, row.id, 'f')} />
              );
            })}
          </SectionWrapper>
        );
      case 'louverDamper':
        return (
          <SectionWrapper title="Louvers & Dampers"
            subtitle="OA/supply/return louvers and fire/smoke/volume/backdraft dampers — sized by face area"
            sectionKey="louverDamper" totals={louverDamperResults.totals}
            onAdd={addLouverDamperRow} onImportRows={importLouverDamperRows} onInsertTemplate={insertLouverDamperTemplate}>
            {louverDamperRows.map((row, i) => {
              const result = louverDamperResults.rows.find(r => r.id === row.id) || {};
              return (
                <LouverDamperRow key={row.id} row={row} result={result} index={i}
                  onChange={updateLouverDamper}
                  onRemove={() => removeRow(setLouverDamperRows, row.id)}
                  onDuplicate={() => duplicateRow(setLouverDamperRows, row.id, 'ld')} />
              );
            })}
          </SectionWrapper>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-full">
      <EstimateProjectBanner
        projectId={projectId} projectName={projectName}
        saving={saving} lastSaved={lastSaved} saveError={saveError}
      />
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unit Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            HVAC equipment, fans, louvers and dampers — auto-naming, bulk add, templates, CSV import
          </p>
        </div>
        <div className="flex items-center gap-2">
          {localStorage.getItem('demo_mode') === 'true' && (
            <button
              onClick={() => {
                try {
                  const saved = localStorage.getItem('demo_unit_schedule');
                  if (!saved) return;
                  const d = JSON.parse(saved);
                  if (d.serviceRows?.length)      setServiceRows(d.serviceRows);
                  if (d.packagedRows?.length)     setPackagedRows(d.packagedRows);
                  if (d.splitRows?.length)        setSplitRows(d.splitRows);
                  if (d.wallMountRows?.length)    setWallMountRows(d.wallMountRows);
                  if (d.vrfRows?.length)          setVRFRows(d.vrfRows);
                  if (d.fanRows?.length)          setFanRows(d.fanRows);
                  if (d.louverDamperRows?.length) setLouverDamperRows(d.louverDamperRows);
                  toast.success('Demo unit schedule loaded!');
                } catch (_) { toast.error('Could not load demo data'); }
              }}
              className="btn-secondary flex items-center gap-2 text-sm text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
            >
              <Play size={15} /> Load Demo
            </button>
          )}
          <button onClick={() => setShowTechRates(v => !v)}
            className={`btn-secondary flex items-center gap-2 text-sm ${showTechRates ? 'ring-2 ring-blue-400' : ''}`}
            title="Adjust labor rates per unit type">
            <Settings2 size={15} /> Labor Rates
          </button>
          <button onClick={() => { setShowCopperSettings(v => !v); setShowAccSettings(false); }}
            className={`btn-secondary flex items-center gap-2 text-sm ${showCopperSettings ? 'ring-2 ring-orange-400' : ''}`}
            title="Copper & refrigerant settings">
            <Zap size={15} /> Copper
          </button>
          <button onClick={() => { setShowAccSettings(v => !v); setShowCopperSettings(false); }}
            className={`btn-secondary flex items-center gap-2 text-sm ${showAccSettings ? 'ring-2 ring-amber-400' : ''}`}
            title="Accessory material price overrides">
            <LayoutList size={15} /> Acc. Prices
          </button>
          <button onClick={saveSnapshot} className="btn-secondary flex items-center gap-2 text-sm"
            title="Save a snapshot of this project for use in 'Copy from project'">
            <CopyIcon size={15} /> Save Snapshot
          </button>
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── Tech Rate Settings Panel ───────────────────────────────────────── */}
      {showTechRates && (
        <div className="card p-4 mb-4 border-blue-200 bg-blue-50/40">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-700 text-sm">Labor Rates by Unit Type</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Adjust $/hr rates to match your Excel workbook. Packaged RTUs confirmed at $25/hr.
                Split/Wall-Mount/VRF use refrigerant-certified rates (TX market defaults shown).
              </p>
            </div>
            <button onClick={() => setShowTechRates(false)}
              className="text-xs text-gray-400 hover:text-gray-600">Close</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: 'packaged',  label: 'Packaged RTU',    hint: 'Sheet-metal crew',      color: 'purple' },
              { key: 'split',     label: 'Standard Split',  hint: 'HVAC-R certified tech', color: 'green'  },
              { key: 'wallMount', label: 'Wall Mount',      hint: 'HVAC-R certified tech', color: 'orange' },
              { key: 'vrf',       label: 'VRF System',      hint: 'VRF specialist',        color: 'red'    },
            ].map(({ key, label, hint }) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-gray-600">{label}</span>
                <span className="text-[10px] text-gray-400">{hint}</span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <input
                    type="number" min="10" max="500" step="5"
                    className="input text-sm pl-5 pr-8 w-full"
                    value={techRates[key]}
                    onChange={e => setTechRates(prev => ({
                      ...prev, [key]: parseFloat(e.target.value) || 0,
                    }))}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">/hr</span>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
            <strong>Tip:</strong> To calibrate, pick a unit you know the exact Excel labor for,
            set all accessories to match, then adjust the $/hr until the totals align.
          </div>
        </div>
      )}

      {/* ── Inline Copper Settings Panel ──────────────────────────────────── */}
      {showCopperSettings && (
        <div className="card p-4 mb-4 border-orange-200 bg-orange-50/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-1.5">
                <Zap size={14} className="text-orange-500" /> Copper &amp; Refrigerant Settings
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeProjectId
                  ? 'Changes saved for this project only — company defaults unchanged.'
                  : <span className="text-amber-600">Open a project to save these settings.</span>}
                {' '}Per-row inputs (pipe type, run length) stay inside each row.
                {copperDraft && <span className="text-amber-600 font-medium"> · Unsaved changes</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {copperDraft && (
                <button
                  onClick={applyCopperSettings}
                  disabled={!activeProjectId}
                  title={!activeProjectId ? 'Open a project first — company defaults can only be changed in Settings' : undefined}
                  className="text-xs bg-orange-500 text-white rounded px-3 py-1 hover:bg-orange-600 font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                  Save to Project
                </button>
              )}
              <button onClick={() => { setShowCopperSettings(false); setCopperDraft(null); }}
                className="text-xs text-gray-400 hover:text-gray-600">Close</button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {/* LME Price */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">LME Copper Price ($/lb)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                <input type="number" min="0" step="0.01"
                  value={(copperDraft ?? cs).lmeCopperPrice ?? 4.25}
                  onChange={e => setCopperField('lmeCopperPrice', parseFloat(e.target.value) || 4.25)}
                  className="input text-sm pl-5 w-full"
                />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Baseline $4.25/lb</p>
            </div>
            {/* Cylinder Price */}
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Refrig. Cylinder Price ($)</label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                <input type="number" min="0" step="5"
                  value={(copperDraft ?? cs).refrigCylinderPrice ?? 280}
                  onChange={e => setCopperField('refrigCylinderPrice', parseFloat(e.target.value) || 280)}
                  className="input text-sm pl-5 w-full"
                />
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Default $280 · anchors refrig. table</p>
            </div>
          </div>

          {/* Safety Factors */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">Safety / Contingency Factors</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { key: 'split',       label: 'Split Systems'  },
                { key: 'wallMounted', label: 'Wall Mounted'   },
                { key: 'vrv',         label: 'VRF Systems'    },
                { key: 'ahuWithCU',   label: 'AHU with CU'   },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <div className="relative">
                    <input type="number" min="1.0" max="2.0" step="0.01"
                      value={(copperDraft ?? cs).safetyFactors?.[key] ?? DEFAULT_COPPER_SETTINGS.safetyFactors[key]}
                      onChange={e => setCopperSafetyFactor(key, parseFloat(e.target.value) || 1.0)}
                      className="input text-sm pr-6 w-full"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">×</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Inline Accessory Price Settings Panel ─────────────────────────── */}
      {showAccSettings && (
        <div className="card p-4 mb-4 border-amber-200 bg-amber-50/20">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-1.5">
                <LayoutList size={14} className="text-amber-600" /> Accessory Material Price Overrides
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeProjectId
                  ? 'Changes saved for this project only — company defaults unchanged.'
                  : <span className="text-amber-600">Open a project to save these settings.</span>}
                {' '}Leave blank to use default tonnage-based table.
                {accDraft && <span className="text-amber-600 font-medium"> · Unsaved changes</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {accDraft && (
                <button
                  onClick={applyAccSettings}
                  disabled={!activeProjectId}
                  title={!activeProjectId ? 'Open a project first — company defaults can only be changed in Settings' : undefined}
                  className="text-xs bg-amber-500 text-white rounded px-3 py-1 hover:bg-amber-600 font-semibold disabled:opacity-40 disabled:cursor-not-allowed">
                  Save to Project
                </button>
              )}
              <button onClick={() => { setShowAccSettings(false); setAccDraft(null); }}
                className="text-xs text-gray-400 hover:text-gray-600">Close</button>
            </div>
          </div>
          <AccessoryPriceSettings
            standalone
            overrides={effAccOverrides}
            onSet={handleAccSet}
            onReset={handleAccReset}
            onResetAll={handleAccResetAll}
          />
        </div>
      )}

      <UnitSummaryPanel summary={summary} />

      <div className="flex flex-wrap gap-1 border-b border-gray-200 mt-6 mb-0">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const colors   = TAB_COLOR_CLASSES[tab.color];
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${isActive
                  ? `${colors.active} border-b-2`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              <span className={`w-2 h-2 rounded-full ${isActive ? colors.dot : 'bg-gray-300'}`} />
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold
                ${isActive ? 'bg-white/70' : 'bg-gray-100 text-gray-500'}`}>
                {rowCounts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-0">{renderTabContent()}</div>
    </div>
  );
}

// Section Wrapper — provides SectionExpandContext + Templates + CSV Import + Copy From Project
function SectionWrapper({ title, subtitle, sectionKey, totals, onAdd, onImportRows, onInsertTemplate, children }) {
  const fmt = (n) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const [expandCount,   setExpandCount]   = useState(0);
  const [collapseCount, setCollapseCount] = useState(0);
  const [bulkCount,     setBulkCount]     = useState(1);
  const [showCsvModal,  setShowCsvModal]  = useState(false);

  return (
    <SectionExpandContext.Provider value={{ expandCount, collapseCount }}>
      <div className="card p-0 overflow-hidden rounded-tl-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-base font-semibold text-gray-800">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex items-center gap-1 mr-4">
            <button onClick={() => setExpandCount(c => c + 1)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
              title="Expand all accessory panels">
              <ChevronDown size={12} /> All
            </button>
            <button onClick={() => setCollapseCount(c => c + 1)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
              title="Collapse all accessory panels">
              <ChevronUp size={12} /> All
            </button>
          </div>

          <div className="mr-4 relative">
            <TemplatesPanel sectionKey={sectionKey} onInsert={onInsertTemplate} />
          </div>

          <div className="flex items-center gap-6 text-sm shrink-0">
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Material</div>
              <div className="font-semibold text-gray-800">{fmt(totals?.totalMaterial)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Labor</div>
              <div className="font-semibold text-gray-800">{fmt(totals?.totalLabor)}</div>
            </div>
            <div className="text-right border-l border-gray-200 pl-6">
              <div className="text-xs text-gray-400 uppercase tracking-wide">Section Total</div>
              <div className="text-lg font-bold text-blue-700">{fmt(totals?.totalCost)}</div>
            </div>
          </div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-100">{children}</div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center gap-4 flex-wrap">
          <button onClick={() => onAdd(bulkCount)}
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
            <Plus size={15} />
            {bulkCount > 1 ? `Add ${bulkCount} Units` : 'Add Unit'}
          </button>

          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span>x</span>
            <input type="number" min="1" max="20" value={bulkCount}
              onChange={e => setBulkCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="w-12 border border-gray-200 rounded px-1.5 py-0.5 text-center text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
              title="Set > 1 to add multiple sequentially-named rows at once" />
            <span className="text-gray-300 hover:text-blue-400 cursor-help transition-colors"
              title="Names are auto-incremented: EF-1 -> EF-2 -> EF-3">
              <Info size={12} />
            </span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button type="button" onClick={() => setShowCsvModal(true)}
              className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium transition-colors"
              title="Import rows from CSV">
              <Upload size={12} /> Import CSV
            </button>
            <CopyFromProjectBtn sectionKey={sectionKey} onImport={onImportRows} />
          </div>
        </div>
      </div>

      {showCsvModal && (
        <CsvImportModal
          sectionKey={sectionKey}
          sectionLabel={title}
          onImport={onImportRows}
          onClose={() => setShowCsvModal(false)}
        />
      )}
    </SectionExpandContext.Provider>
  );
}
