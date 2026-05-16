import React, { useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function PriceSettings({ prices, overhead, onPricesChange, onOverheadChange, onClose }) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState(prices);
  const [draftOverhead, setDraftOverhead] = useState(overhead);

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
          <label className="label">Sheet Metal (kg/ft²)</label>
          <input
            type="number"
            step="0.0001"
            className="input"
            value={draft.sheetMetalKgPerFt2}
            onChange={(e) => setDraft({ ...draft, sheetMetalKgPerFt2: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Sheet Metal (lbs/ft²)</label>
          <input
            type="number"
            step="0.0001"
            className="input"
            value={draft.sheetMetalLbsPerFt2}
            onChange={(e) => setDraft({ ...draft, sheetMetalLbsPerFt2: parseFloat(e.target.value) })}
          />
        </div>
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
          <label className="label">Sheet Metal Labor ($/ft)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.sheetMetalLaborPerFt}
            onChange={(e) => setDraft({ ...draft, sheetMetalLaborPerFt: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Duct Wrap Material ($/sqft)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={draft.insulationPerSqFt}
            onChange={(e) => setDraft({ ...draft, insulationPerSqFt: parseFloat(e.target.value) })}
          />
        </div>
        <div>
          <label className="label">Duct Wrap Labor ($/ft)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={draft.ductWrapLaborPerFt}
            onChange={(e) => setDraft({ ...draft, ductWrapLaborPerFt: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Flex Duct Labor Short ($/run)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.flexDuctLaborShort}
            onChange={(e) => setDraft({ ...draft, flexDuctLaborShort: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Flex Duct Labor Long ($/run)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.flexDuctLaborLong}
            onChange={(e) => setDraft({ ...draft, flexDuctLaborLong: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Offtake Cost ($/run)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.offtakeCost}
            onChange={(e) => setDraft({ ...draft, offtakeCost: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">VD Cost ($/run)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.vdCost}
            onChange={(e) => setDraft({ ...draft, vdCost: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Max Flex Duct Len (ft)</label>
          <input
            type="number"
            step="0.1"
            className="input"
            value={draft.maxFlexDuctLen}
            onChange={(e) => setDraft({ ...draft, maxFlexDuctLen: parseFloat(e.target.value) })}
          />
        </div>

        <div>
          <label className="label">Int. Ins. Uplift (%)</label>
          <input
            type="number"
            step="1"
            className="input"
            value={Math.round((draft.internalInsulationUplift || 0) * 100)}
            onChange={(e) => setDraft({ ...draft, internalInsulationUplift: parseInt(e.target.value) / 100 })}
          />
        </div>

        <div style={{display:'none'}}>
          {/* Overhead % moved to Global tab in Settings */}
          <label className="label">Overhead %</label>
          <input
            type="number"
            step="1"
            className="input"
            value={Math.round(draftOverhead.overheadPct * 100)}
            onChange={(e) => setDraftOverhead({ ...draftOverhead, overheadPct: parseInt(e.target.value) / 100 })}
          />
        </div>
        <div style={{display:'none'}}>
          {/* Profit % moved to Global tab in Settings */}
          <label className="label">Profit %</label>
          <input
            type="number"
            step="1"
            className="input"
            value={Math.round(draftOverhead.profitPct * 100)}
            onChange={(e) => setDraftOverhead({ ...draftOverhead, profitPct: parseInt(e.target.value) / 100 })}
          />
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
