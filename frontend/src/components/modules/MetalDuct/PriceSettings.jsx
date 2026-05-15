import React, { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function PriceSettings({ prices, overhead, onPricesChange, onOverheadChange, onClose, presets = [], onPresetsChange }) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(prices);
  const [draftOverhead, setDraftOverhead] = useState(overhead);
  const [draftPresets, setDraftPresets] = useState(presets.join(', '));

  const fetchLivePrices = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/prices/current');
      const p = res.data;
      if (p?.sheetMetal?.galvanizedSteel?.gauge24?.pricePerSqFt) {
        setDraft((prev) => ({
          ...prev,
          sheetMetalCostPerLb: p.sheetMetal.galvanizedSteel.gauge24.pricePerSqFt,
        }));
      }
      if (p?.labor?.sheetMetalWorkerRate) {
        setDraft((prev) => ({
          ...prev,
          laborRate: p.labor.sheetMetalWorkerRate,
        }));
      }
      toast.success('Prices updated from AI');
    } catch {
      toast.error('Could not fetch live prices');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    onPricesChange(draft);
    onOverheadChange(draftOverhead);
    if (onPresetsChange) {
      const arr = draftPresets.split(',').map((s) => s.trim()).filter(Boolean);
      onPresetsChange(arr);
      try { localStorage.setItem('ductSizePresets', JSON.stringify(arr)); } catch {}
    }
    onClose();
    toast.success('Settings saved');
  };

  return (
    <div className="card mb-6 border-blue-200 bg-blue-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Prices & Settings</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="label">Sheet Metal ($/lb)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={draft.sheetMetalCostPerLb}
            onChange={(e) => setDraft({ ...draft, sheetMetalCostPerLb: parseFloat(e.target.value) })}
          />
          <p className="text-xs text-gray-400 mt-1">Workbook-aligned square duct material rate</p>
        </div>
        <div>
          <label className="label">Labor Rate ($/hr)</label>
          <input
            type="number"
            step="0.5"
            className="input"
            value={draft.laborRate}
            onChange={(e) => setDraft({ ...draft, laborRate: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Insulation ($/sqft)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={draft.insulationPerSqFt}
            onChange={(e) => setDraft({ ...draft, insulationPerSqFt: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Overhead %</label>
          <input
            type="number"
            step="1"
            className="input"
            value={Math.round(draftOverhead.overheadPct * 100)}
            onChange={(e) => setDraftOverhead({ ...draftOverhead, overheadPct: parseInt(e.target.value) / 100 })}
          />
        </div>
        <div>
          <label className="label">Profit %</label>
          <input
            type="number"
            step="1"
            className="input"
            value={Math.round(draftOverhead.profitPct * 100)}
            onChange={(e) => setDraftOverhead({ ...draftOverhead, profitPct: parseInt(e.target.value) / 100 })}
          />
        </div>
        <div className="md:col-span-2">
          <label className="label">Size Presets (comma separated)</label>
          <input
            type="text"
            className="input"
            value={draftPresets}
            onChange={(e) => setDraftPresets(e.target.value)}
            placeholder="24x12, 18x10, 12"
          />
          <p className="text-xs text-gray-400 mt-1">Used as suggestions when entering duct sizes. You can still type custom sizes.</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={fetchLivePrices}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Fetching...' : 'Get AI Prices'}
        </button>
        <button onClick={handleSave} className="btn-primary text-sm">
          Save Settings
        </button>
      </div>
    </div>
  );
}
