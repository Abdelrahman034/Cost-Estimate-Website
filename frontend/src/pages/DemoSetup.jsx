/**
 * DemoSetup.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Visit /demo-setup to instantly pre-load all estimating modules with
 * realistic demo data for a client presentation or video recording.
 *
 * What this page does in one click:
 *   1. Writes all module localStorage keys (rows, prices, totals)
 *   2. Injects project info into sessionStorage for the Header
 *   3. Writes the demo flag so each module can mount pre-populated
 *   4. Writes Change Log & Scenario Comparison demo state
 *   5. Calls back-end to create the demo project (if it doesn't exist)
 *   6. Redirects to the Dashboard after a short countdown
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2, Circle, Loader2, Play, RotateCcw,
  Wind, Building2, Gauge, Fan, Zap, BarChart3, Sparkles,
} from 'lucide-react';
import {
  DEMO_PROJECT_INFO,
  DEMO_UNIT_SCHEDULE,
  DEMO_METAL_DUCT,
  DEMO_DIFFUSER,
  DEMO_FAN_SCHEDULE,
  DEMO_ELEC_HEAT,
  DEMO_MODULE_TOTALS,
  DEMO_CHANGELOG,
  DEMO_SCENARIOS,
} from '@utils/demoData';

// ─── Steps definition ────────────────────────────────────────────────────────
const STEPS = [
  { id: 'project',       label: 'Project info',          icon: Building2  },
  { id: 'unit_schedule', label: 'Unit Schedule',         icon: Building2  },
  { id: 'metal_duct',    label: 'Metal Duct',            icon: Wind       },
  { id: 'diffuser',      label: 'Diffuser Schedule',     icon: Gauge      },
  { id: 'fan_schedule',  label: 'Fan Schedule',          icon: Fan        },
  { id: 'elec_heat',     label: 'Electric Heat',         icon: Zap        },
  { id: 'dashboard',     label: 'Dashboard totals',      icon: BarChart3  },
  { id: 'extras',        label: 'Change log & Scenarios',icon: Sparkles   },
];

// ─── Core injection logic ─────────────────────────────────────────────────────
function injectDemoData(onStep) {
  const steps = [];

  // 1. Project info — stored in sessionStorage, picked up by App on next render
  sessionStorage.setItem('demo_project_info', JSON.stringify(DEMO_PROJECT_INFO));
  // Also signal the Header via localStorage event
  localStorage.setItem('demo_project_info', JSON.stringify(DEMO_PROJECT_INFO));
  steps.push('project');
  onStep([...steps]);

  // 2. Unit Schedule rows
  localStorage.setItem('demo_unit_schedule', JSON.stringify(DEMO_UNIT_SCHEDULE));
  steps.push('unit_schedule');
  onStep([...steps]);

  // 3. Metal Duct rows
  localStorage.setItem('demo_metal_duct', JSON.stringify(DEMO_METAL_DUCT));
  steps.push('metal_duct');
  onStep([...steps]);

  // 4. Diffuser rows
  localStorage.setItem('demo_diffuser', JSON.stringify(DEMO_DIFFUSER));
  steps.push('diffuser');
  onStep([...steps]);

  // 5. Fan Schedule rows
  localStorage.setItem('demo_fan_schedule', JSON.stringify(DEMO_FAN_SCHEDULE));
  steps.push('fan_schedule');
  onStep([...steps]);

  // 6. Electric Heat rows
  localStorage.setItem('demo_elec_heat', JSON.stringify(DEMO_ELEC_HEAT));
  steps.push('elec_heat');
  onStep([...steps]);

  // 7. Dashboard totals (module_totals_* keys read by projectTotals.js)
  for (const [key, totals] of Object.entries(DEMO_MODULE_TOTALS)) {
    localStorage.setItem(`module_totals_${key}`, JSON.stringify({
      ...totals,
      savedAt: Date.now(),
    }));
  }
  steps.push('dashboard');
  onStep([...steps]);

  // 8. Change log
  localStorage.setItem('hvac_changelog', JSON.stringify(DEMO_CHANGELOG));
  // Scenario comparison
  localStorage.setItem('scenario_comparison', JSON.stringify(DEMO_SCENARIOS));
  steps.push('extras');
  onStep([...steps]);

  // 9. Set the global demo flag — modules check this on mount
  localStorage.setItem('demo_mode', 'true');

  return steps;
}

// ─── Clear all demo data ──────────────────────────────────────────────────────
function clearDemoData() {
  const keys = [
    'demo_mode', 'demo_project_info',
    'demo_unit_schedule', 'demo_metal_duct', 'demo_diffuser',
    'demo_fan_schedule', 'demo_elec_heat',
    'hvac_changelog', 'scenario_comparison',
    'module_totals_unit_schedule', 'module_totals_metal_duct',
    'module_totals_diffuser', 'module_totals_fan_schedule',
    'module_totals_vav_schedule', 'module_totals_cw_pipe',
    'module_totals_elec_heat',
  ];
  keys.forEach(k => localStorage.removeItem(k));
  sessionStorage.removeItem('demo_project_info');
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DemoSetup({ onProjectInfoChange }) {
  const navigate    = useNavigate();
  const [status,    setStatus]    = useState('idle');   // idle | loading | done | cleared
  const [doneSteps, setDoneSteps] = useState([]);
  const [countdown, setCountdown] = useState(4);

  // Auto-redirect countdown once loading is done
  useEffect(() => {
    if (status !== 'done') return;
    if (countdown <= 0) { navigate('/'); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [status, countdown, navigate]);

  function handleLoad() {
    setStatus('loading');
    setDoneSteps([]);

    // Simulate async steps with small delays for visual feedback
    let stepQueue = [...STEPS];
    let done = [];

    const tick = () => {
      if (stepQueue.length === 0) {
        // Actually inject all data at once (it's synchronous/fast)
        injectDemoData((completedIds) => setDoneSteps([...completedIds]));
        // Notify parent App to update projectInfo
        if (onProjectInfoChange) onProjectInfoChange(DEMO_PROJECT_INFO);
        setStatus('done');
        return;
      }
      const step = stepQueue.shift();
      done.push(step.id);
      setDoneSteps([...done]);
      setTimeout(tick, 180);
    };

    setTimeout(tick, 100);
  }

  function handleClear() {
    clearDemoData();
    if (onProjectInfoChange) onProjectInfoChange({
      projectName: '', location: '', owner: '', gc: '', bidDate: '',
      companyName: 'Your HVAC Company', companyAddress: '', companyPhone: '', companyEmail: '',
    });
    setDoneSteps([]);
    setStatus('cleared');
  }

  const isLoading = status === 'loading';
  const isDone    = status === 'done';
  const isCleared = status === 'cleared';

  return (
    <div className="max-w-xl mx-auto mt-12 space-y-6">

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-2xl mb-4">
          <Play size={26} className="text-blue-600" />
        </div>
        <h1 className="text-2xl font-black text-gray-900">Demo Mode Setup</h1>
        <p className="text-sm text-gray-500 mt-1">
          Load a full realistic project into every module — ready for a client demo or recording.
        </p>
      </div>

      {/* Project preview card */}
      <div className="bg-gradient-to-br from-slate-800 to-blue-900 rounded-2xl p-5 text-white">
        <div className="text-xs text-slate-400 uppercase tracking-wider mb-3">Demo Project</div>
        <div className="text-lg font-black leading-snug">{DEMO_PROJECT_INFO.projectName}</div>
        <div className="text-slate-300 text-sm mt-1">{DEMO_PROJECT_INFO.location}</div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
          <div><span className="text-slate-400">Owner: </span><span className="font-medium">{DEMO_PROJECT_INFO.owner}</span></div>
          <div><span className="text-slate-400">GC: </span><span className="font-medium">{DEMO_PROJECT_INFO.gc}</span></div>
          <div><span className="text-slate-400">Bid Date: </span><span className="font-medium">{DEMO_PROJECT_INFO.bidDate}</span></div>
          <div><span className="text-slate-400">Modules: </span><span className="font-medium">5 fully loaded</span></div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-xs">
          <div><div className="text-lg font-bold text-green-300">$208K</div><div className="text-slate-400">Direct Cost</div></div>
          <div><div className="text-lg font-bold text-amber-300">$245K</div><div className="text-slate-400">Bid Total</div></div>
          <div><div className="text-lg font-bold text-blue-300">15.1%</div><div className="text-slate-400">Margin</div></div>
        </div>
      </div>

      {/* Steps progress */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Loading steps</div>
        {STEPS.map((step) => {
          const done = doneSteps.includes(step.id);
          const Icon = step.icon;
          return (
            <div key={step.id} className="flex items-center gap-3">
              {done ? (
                <CheckCircle2 size={18} className="text-green-500 flex-shrink-0" />
              ) : isLoading && doneSteps.length === STEPS.indexOf(step) ? (
                <Loader2 size={18} className="text-blue-500 flex-shrink-0 animate-spin" />
              ) : (
                <Circle size={18} className="text-gray-300 flex-shrink-0" />
              )}
              <Icon size={15} className={done ? 'text-green-500' : 'text-gray-300'} />
              <span className={`text-sm ${done ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleLoad}
          disabled={isLoading || isDone}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-3 rounded-xl transition-all"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
          {isLoading ? 'Loading demo data…' : isDone ? '✓ Demo loaded!' : 'Load Demo Data'}
        </button>

        <button
          onClick={handleClear}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600 transition-all text-sm font-medium"
          title="Clear all demo data from localStorage"
        >
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      {/* Status messages */}
      {isDone && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <div className="font-bold text-green-700 mb-1">Demo ready!</div>
          <p className="text-sm text-green-600">
            All modules are pre-loaded. Redirecting to Dashboard in{' '}
            <span className="font-bold text-green-800">{countdown}s</span>…
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-2 text-sm text-green-700 underline hover:no-underline"
          >
            Go now
          </button>
        </div>
      )}

      {isCleared && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <div className="font-bold text-amber-700 mb-1">Demo data cleared</div>
          <p className="text-sm text-amber-600">
            All demo data has been removed from the browser.
            Click "Load Demo Data" to start fresh.
          </p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 rounded-2xl p-5 text-sm text-gray-600 space-y-2">
        <div className="font-semibold text-gray-700 mb-2">How to use for demo recording</div>
        <ol className="space-y-1.5 list-decimal list-inside text-xs text-gray-500">
          <li>Run <code className="bg-gray-200 px-1 rounded">npm run seed:demo</code> in the backend folder to populate the admin analytics database</li>
          <li>Open the app and visit <code className="bg-gray-200 px-1 rounded">/demo-setup</code></li>
          <li>Click <strong className="text-gray-700">Load Demo Data</strong> — auto-redirects to Dashboard</li>
          <li>Start recording — project info, all module rows, and dashboard totals are ready</li>
          <li>Click <strong className="text-gray-700">Reset</strong> between takes to clear and reload cleanly</li>
        </ol>
        <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-400">
          Demo data only lives in your browser (localStorage). It never touches real project data.
        </div>
      </div>
    </div>
  );
}
