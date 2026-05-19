/**
 * Unit Schedule Module
 * Implements the "Unit Sched" Excel tab as a full React module.
 *
 * Architecture for future backend integration:
 *   - All state shapes mirror the DB entity models
 *   - API_TODO comments show exactly where to swap in API calls
 *   - Calculation engine is pure-function (easy to move to server-side)
 *   - projectId prop is ready to be wired once projects API exists
 */
import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, Download, Calculator, ChevronDown, ChevronRight, Copy, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  calcServiceBatch,
  calcPackagedBatch,
  calcSplitBatch,
  calcWallMountBatch,
  calcVRFBatch,
  rollUpUnitSummary,
  SYSTEM_TYPES,
} from '@utils/unitScheduleCalculations';
import ServiceRow        from './ServiceRow';
import PackagedRow       from './PackagedRow';
import SplitRow          from './SplitRow';
import WallMountRow      from './WallMountRow';
import VRFRow            from './VRFRow';
import UnitSummaryPanel  from './UnitSummaryPanel';

// ─── DEFAULT ROW FACTORIES ────────────────────────────────────────────────────
// These shapes map directly to the database entity columns

const newServiceRow = (id) => ({
  id, name: '', coolTons: 0, systemType: SYSTEM_TYPES.PACKAGED,
  pmMaterials: 0, pmLabor: 0,
});

const newPackagedRow = (id) => ({
  id, name: '', coolTons: 0, ownerProvided: '',
  baseCostPerTon: 0, quotedEquipCost: null,
  accessories: {
    standardCurb: '', metalRoofCurb: '', curbAdapter: '', economizer: '',
    pvcCond: '', cuCond: '', thermostat: '', smokeDetectors: '',
    sensorQty: 0, newDrops: '', drumLouvers: '',
  },
  notes: '',
});

const newSplitRow = (id) => ({
  id, name: '', coolTons: 0, ownerProvided: '',
  baseCostPerTon: 0, quotedEquipCost: null,
  accessories: {
    condenserRails: '', drainPan: '', cuLineUnder100: '', cuLineOver100: '',
    cuRollUnder100: '', cuRollOver100: '', oaDamper: '', floatSwitch: '',
    pvcCond: '', cuCond: '', thermostat: '', smokeDetectors: '',
    sensorQty: 0, ductTransitions: '',
  },
  notes: '',
});

const newWallMountRow = (id) => ({
  id, name: '', coolTons: 0, ownerProvided: '',
  baseCostPerTon: 0, quotedEquipCost: null,
  accessories: {
    condenserRails: '', condPump: '', cuUnder100: '', cuOver100: '',
    pvcCond: '', cuCond: '', thermostat: '',
  },
  notes: '',
});

const newVRFRow = (id) => ({
  id, name: '', coolTons: 0, condensingUnits: 1, indoorUnits: 1,
  indoorCoolAvgTons: 0, ownerProvided: '', baseCostPerTon: 0,
  quotedEquipCost: null, cuLineAvgLength: 0,
  accessories: {
    condenserRails: '', drainPan: '', cuLine: '', refrigCharge: '',
    pvcCond: '', cuCond: '', thermostat: '', smokeDetectors: '', sensorQty: 0,
  },
  notes: '',
});

// ─── TAB CONFIG ───────────────────────────────────────────────────────────────
const TABS = [
  { id: 'service',   label: 'Service Existing', color: 'blue'   },
  { id: 'packaged',  label: 'Packaged Units',   color: 'purple' },
  { id: 'split',     label: 'Split Systems',    color: 'green'  },
  { id: 'wallMount', label: 'Wall Mount',        color: 'orange' },
  { id: 'vrf',       label: 'VRF Systems',       color: 'red'    },
];

const TAB_COLOR_CLASSES = {
  blue:   { active: 'border-blue-600 text-blue-700 bg-blue-50',   dot: 'bg-blue-500'   },
  purple: { active: 'border-purple-600 text-purple-700 bg-purple-50', dot: 'bg-purple-500' },
  green:  { active: 'border-green-600 text-green-700 bg-green-50', dot: 'bg-green-500'  },
  orange: { active: 'border-orange-500 text-orange-700 bg-orange-50', dot: 'bg-orange-500' },
  red:    { active: 'border-red-600 text-red-700 bg-red-50',       dot: 'bg-red-500'    },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function UnitScheduleModule({ projectInfo }) {
  const [activeTab, setActiveTab] = useState('service');

  // Row state per section
  // API_TODO: initialise these from GET /api/estimates/{projectId}/unit-schedule
  const [serviceRows,   setServiceRows]   = useState([newServiceRow('s-1'), newServiceRow('s-2')]);
  const [packagedRows,  setPackagedRows]  = useState([newPackagedRow('p-1')]);
  const [splitRows,     setSplitRows]     = useState([newSplitRow('sp-1')]);
  const [wallMountRows, setWallMountRows] = useState([newWallMountRow('wm-1')]);
  const [vrfRows,       setVRFRows]       = useState([newVRFRow('v-1')]);

  // Results (recalculated live)
  // API_TODO: replace with useSWR/React Query when backend is ready
  const serviceResults   = useMemo(() => calcServiceBatch(serviceRows),      [serviceRows]);
  const packagedResults  = useMemo(() => calcPackagedBatch(packagedRows),    [packagedRows]);
  const splitResults     = useMemo(() => calcSplitBatch(splitRows),          [splitRows]);
  const wallMountResults = useMemo(() => calcWallMountBatch(wallMountRows),  [wallMountRows]);
  const vrfResults       = useMemo(() => calcVRFBatch(vrfRows),              [vrfRows]);

  const summary = useMemo(() => rollUpUnitSummary({
    serviceTotals:   serviceResults.totals,
    packagedTotals:  packagedResults.totals,
    splitTotals:     splitResults.totals,
    wallMountTotals: wallMountResults.totals,
    vrfTotals:       vrfResults.totals,
  }), [serviceResults, packagedResults, splitResults, wallMountResults, vrfResults]);

  // ── Row update helpers ──────────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const updateService   = useCallback((id, field, value) => {
    setServiceRows(prev => prev.map(r => r.id !== id ? r : { ...r, [field]: value }));
  }, []);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const updatePackaged  = useCallback((id, field, value) => {
    setPackagedRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field.startsWith('accessories.')) {
        const k = field.split('.')[1];
        return { ...r, accessories: { ...r.accessories, [k]: value } };
      }
      return { ...r, [field]: value };
    }));
  }, []);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const updateSplit = useCallback((id, field, value) => {
    setSplitRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field.startsWith('accessories.')) {
        const k = field.split('.')[1];
        return { ...r, accessories: { ...r.accessories, [k]: value } };
      }
      return { ...r, [field]: value };
    }));
  }, []);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const updateWallMount = useCallback((id, field, value) => {
    setWallMountRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field.startsWith('accessories.')) {
        const k = field.split('.')[1];
        return { ...r, accessories: { ...r.accessories, [k]: value } };
      }
      return { ...r, [field]: value };
    }));
  }, []);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const updateVRF = useCallback((id, field, value) => {
    setVRFRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (field.startsWith('accessories.')) {
        const k = field.split('.')[1];
        return { ...r, accessories: { ...r.accessories, [k]: value } };
      }
      return { ...r, [field]: value };
    }));
  }, []);

  // ── Remove helpers ──────────────────────────────────────────────────────────
  const removeRow = (setter, id) => setter(prev => prev.filter(r => r.id !== id));

  // ── Duplicate helpers — deep-clone the row, give it a new ID, append " (copy)" ──
  // Inserts the clone immediately after the original so it stays in context
  const duplicateRow = (setter, id, prefix) => {
    setter(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const clone = {
        ...JSON.parse(JSON.stringify(original)), // deep clone accessories too
        id: `${prefix}-${Date.now()}`,
        name: original.name ? `${original.name} (copy)` : '(copy)',
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    toast.success('Row duplicated');
  };

  // ── Add helpers ─────────────────────────────────────────────────────────────
  const addServiceRow   = () => setServiceRows(p   => [...p, newServiceRow(`s-${Date.now()}`)]);
  const addPackagedRow  = () => setPackagedRows(p  => [...p, newPackagedRow(`p-${Date.now()}`)]);
  const addSplitRow     = () => setSplitRows(p     => [...p, newSplitRow(`sp-${Date.now()}`)]);
  const addWallMountRow = () => setWallMountRows(p => [...p, newWallMountRow(`wm-${Date.now()}`)]);
  const addVRFRow       = () => setVRFRows(p       => [...p, newVRFRow(`v-${Date.now()}`)]);

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const fmt = (n) => (n || 0).toFixed(2);
    const header = ['Section','#','Name','Tons','Total Material $','Total Labor $','Total Cost $'];
    const lines = [header.join(',')];

    const addSection = (label, rows, results) => {
      results.rows.forEach((r, i) => {
        lines.push([label, i+1, r.name || '', r.coolTons || 0,
          fmt(r.totalMaterial), fmt(r.totalLabor), fmt(r.totalCost)].join(','));
      });
    };
    addSection('Service Existing', serviceRows,   serviceResults);
    addSection('Packaged Units',   packagedRows,  packagedResults);
    addSection('Split Systems',    splitRows,     splitResults);
    addSection('Wall Mount',       wallMountRows, wallMountResults);
    addSection('VRF Systems',      vrfRows,       vrfResults);

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'unit_schedule.csv';
    a.click();
    toast.success('Unit Schedule exported');
  };

  // ── Render current tab ──────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'service':
        return (
          <SectionWrapper
            title="Service of Existing Units"
            subtitle="PM service visits — material and labor looked up by system type and tonnage"
            totals={serviceResults.totals}
            onAdd={addServiceRow}
          >
            {serviceRows.map((row, i) => {
              const result = serviceResults.rows.find(r => r.id === row.id) || {};
              return (
                <ServiceRow
                  key={row.id} row={row} result={result} index={i}
                  onChange={updateService}
                  onRemove={() => removeRow(setServiceRows, row.id)}
                  onDuplicate={() => duplicateRow(setServiceRows, row.id, 's')}
                />
              );
            })}
          </SectionWrapper>
        );

      case 'packaged':
        return (
          <SectionWrapper
            title="New Packaged Units"
            subtitle="Rooftop / packaged units with curbs, economizers, and accessories"
            totals={packagedResults.totals}
            onAdd={addPackagedRow}
          >
            {packagedRows.map((row, i) => {
              const result = packagedResults.rows.find(r => r.id === row.id) || {};
              return (
                <PackagedRow
                  key={row.id} row={row} result={result} index={i}
                  onChange={updatePackaged}
                  onRemove={() => removeRow(setPackagedRows, row.id)}
                  onDuplicate={() => duplicateRow(setPackagedRows, row.id, 'p')}
                />
              );
            })}
          </SectionWrapper>
        );

      case 'split':
        return (
          <SectionWrapper
            title="Split Systems"
            subtitle="Standard split systems with condensers, copper lines, and accessories"
            totals={splitResults.totals}
            onAdd={addSplitRow}
          >
            {splitRows.map((row, i) => {
              const result = splitResults.rows.find(r => r.id === row.id) || {};
              return (
                <SplitRow
                  key={row.id} row={row} result={result} index={i}
                  onChange={updateSplit}
                  onRemove={() => removeRow(setSplitRows, row.id)}
                  onDuplicate={() => duplicateRow(setSplitRows, row.id, 'sp')}
                />
              );
            })}
          </SectionWrapper>
        );

      case 'wallMount':
        return (
          <SectionWrapper
            title="Wall Mounted Split Systems"
            subtitle="Mini-split / ductless units with condensate pump and copper lines"
            totals={wallMountResults.totals}
            onAdd={addWallMountRow}
          >
            {wallMountRows.map((row, i) => {
              const result = wallMountResults.rows.find(r => r.id === row.id) || {};
              return (
                <WallMountRow
                  key={row.id} row={row} result={result} index={i}
                  onChange={updateWallMount}
                  onRemove={() => removeRow(setWallMountRows, row.id)}
                  onDuplicate={() => duplicateRow(setWallMountRows, row.id, 'wm')}
                />
              );
            })}
          </SectionWrapper>
        );

      case 'vrf':
        return (
          <SectionWrapper
            title="VRF Systems"
            subtitle="Variable refrigerant flow systems — multi-zone, multiple condensing & indoor units"
            totals={vrfResults.totals}
            onAdd={addVRFRow}
          >
            {vrfRows.map((row, i) => {
              const result = vrfResults.rows.find(r => r.id === row.id) || {};
              return (
                <VRFRow
                  key={row.id} row={row} result={result} index={i}
                  onChange={updateVRF}
                  onRemove={() => removeRow(setVRFRows, row.id)}
                  onDuplicate={() => duplicateRow(setVRFRows, row.id, 'v')}
                />
              );
            })}
          </SectionWrapper>
        );

      default:
        return null;
    }
  };

  // ── Count non-empty rows per tab ────────────────────────────────────────────
  const rowCounts = {
    service:   serviceRows.length,
    packaged:  packagedRows.length,
    split:     splitRows.length,
    wallMount: wallMountRows.length,
    vrf:       vrfRows.length,
  };

  return (
    <div className="max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Unit Schedule</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            HVAC equipment scheduling — service, packaged, splits, wall mounts, and VRF
          </p>
        </div>
        <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Summary panel */}
      <UnitSummaryPanel summary={summary} />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mt-6 mb-0">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const colors   = TAB_COLOR_CLASSES[tab.color];
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors
                ${isActive
                  ? `${colors.active} border-b-2`
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? colors.dot : 'bg-gray-300'}`} />
              {tab.label}
              <span className={`
                text-xs px-1.5 py-0.5 rounded-full font-semibold
                ${isActive ? 'bg-white/70' : 'bg-gray-100 text-gray-500'}
              `}>
                {rowCounts[tab.id]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="mt-0">
        {renderTabContent()}
      </div>
    </div>
  );
}

// ─── SECTION WRAPPER ─────────────────────────────────────────────────────────
function SectionWrapper({ title, subtitle, totals, onAdd, children }) {
  const fmt = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="card p-0 overflow-hidden rounded-tl-none">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div>
          <h2 className="text-base font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <div className="flex items-center gap-6 text-sm">
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
      <div className="divide-y divide-gray-100">
        {children}
      </div>

      {/* Add row */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
        <button
          onClick={onAdd}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <Plus size={15} /> Add Unit
        </button>
      </div>
    </div>
  );
}
