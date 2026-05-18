import React, { useState, useContext } from 'react';
import PriceSettings from '@modules/MetalDuct/PriceSettings';
import { SettingsContext } from '@contexts/SettingsContext';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [tab, setTab] = useState('global');
  const { prices, setPrices, overhead, setOverhead } = useContext(SettingsContext);

  const [draftOverhead, setDraftOverhead] = useState(overhead);

  const saveGlobal = () => {
    setOverhead(draftOverhead);
    toast.success('Global settings saved');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Project Settings</h1>
      </div>

      <div className="mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setTab('global')}
            className={`px-3 py-1 rounded ${tab === 'global' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            Global / Project
          </button>
          <button
            onClick={() => setTab('duct')}
            className={`px-3 py-1 rounded ${tab === 'duct' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            Duct Pricing
          </button>
          <button
            onClick={() => setTab('other')}
            className={`px-3 py-1 rounded ${tab === 'other' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            Other Equipment
          </button>
        </div>
      </div>

      {/* ── GLOBAL / PROJECT ─────────────────────────────────────── */}
      {tab === 'global' && (
        <div className="card border-green-200 bg-green-50">
          <h3 className="font-semibold text-gray-900 mb-1">Global Project Markup</h3>
          <p className="text-xs text-gray-500 mb-4">
            These percentages are applied at the project summary level — not inside any individual module.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="label">Overhead %</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                className="input"
                value={Math.round((draftOverhead.overheadPct ?? 0.15) * 100)}
                onChange={(e) =>
                  setDraftOverhead({ ...draftOverhead, overheadPct: parseInt(e.target.value) / 100 })
                }
              />
              <p className="text-xs text-gray-400 mt-1">Company operating costs</p>
            </div>
            <div>
              <label className="label">Profit %</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                className="input"
                value={Math.round((draftOverhead.profitPct ?? 0.10) * 100)}
                onChange={(e) =>
                  setDraftOverhead({ ...draftOverhead, profitPct: parseInt(e.target.value) / 100 })
                }
              />
              <p className="text-xs text-gray-400 mt-1">Applied after overhead</p>
            </div>
          </div>

          {/* Preview */}
          <div className="bg-white border border-green-200 rounded-lg p-3 mb-4 text-sm">
            <div className="font-semibold text-gray-700 mb-2">Markup Preview (on $1,000 direct cost)</div>
            <div className="space-y-1 text-gray-600">
              <div className="flex justify-between">
                <span>Direct Cost</span><span className="font-mono">$1,000</span>
              </div>
              <div className="flex justify-between">
                <span>Overhead ({Math.round((draftOverhead.overheadPct ?? 0.15) * 100)}%)</span>
                <span className="font-mono">+${Math.round(1000 * (draftOverhead.overheadPct ?? 0.15))}</span>
              </div>
              <div className="flex justify-between">
                <span>Profit ({Math.round((draftOverhead.profitPct ?? 0.10) * 100)}%)</span>
                <span className="font-mono">
                  +${Math.round(1000 * (1 + (draftOverhead.overheadPct ?? 0.15)) * (draftOverhead.profitPct ?? 0.10))}
                </span>
              </div>
              <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-1 mt-1">
                <span>Bid Price</span>
                <span className="font-mono">
                  ${Math.round(1000 * (1 + (draftOverhead.overheadPct ?? 0.15)) * (1 + (draftOverhead.profitPct ?? 0.10)))}
                </span>
              </div>
            </div>
          </div>

          <button onClick={saveGlobal} className="btn-primary text-sm">
            Save Global Settings
          </button>
        </div>
      )}

      {/* ── DUCT PRICING ──────────────────────────────────────────── */}
      {tab === 'duct' && (
        <div>
          <PriceSettings
            prices={prices}
            overhead={overhead}
            onPricesChange={setPrices}
            onOverheadChange={setOverhead}
            onClose={() => {}}
          />
        </div>
      )}

      {/* ── OTHER EQUIPMENT ──────────────────────────────────────── */}
      {tab === 'other' && (
        <div className="card p-4">More equipment settings will appear here.</div>
      )}
    </div>
  );
}
