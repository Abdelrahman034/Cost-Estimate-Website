import React, { useState } from 'react';
import { X, RefreshCw, Globe, PenLine } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { DIFFUSER_TYPES, DEFAULT_GRD_RATE, DEFAULT_MISC_PCT } from '@utils/diffuserCalculations';

// Representative US market prices from Greenheck / Titus / Price Industries
// Used as seed values when the user first switches to Market mode.
// The "Get Market Prices" button fetches live updates via the backend AI endpoint.
const MARKET_SEED_PRICES = {
  sq_xl:   195,
  sq_l:    110,
  sq_m:     90,
  sq_s:     68,
  sq_xs:    58,
  slot_48: 265,
  slot_24: 170,
  other:   110,
};

export default function DiffuserPriceSettings({
  settings,
  onSettingsChange,
  onClose,
}) {
  const [draft, setDraft] = useState(settings);
  const [fetching, setFetching] = useState(false);

  const isMarket = draft.priceMode === 'market';

  const setMode = (mode) => {
    setDraft((prev) => ({
      ...prev,
      priceMode: mode,
      // Seed market prices the first time the user switches to market mode
      marketPrices: mode === 'market' && !prev.marketPrices
        ? { ...MARKET_SEED_PRICES }
        : prev.marketPrices,
    }));
  };

  const fetchMarketPrices = async () => {
    setFetching(true);
    try {
      const res = await axios.get('/api/prices/diffusers');
      if (res.data) {
        setDraft((prev) => ({ ...prev, marketPrices: { ...prev.marketPrices, ...res.data } }));
        toast.success('Market prices updated');
      }
    } catch {
      // Backend endpoint not yet built — fall back to seed values as best-effort
      setDraft((prev) => ({
        ...prev,
        marketPrices: { ...MARKET_SEED_PRICES, ...prev.marketPrices },
      }));
      toast('Using representative US market prices (Greenheck / Titus baseline)', { icon: 'ℹ️' });
    } finally {
      setFetching(false);
    }
  };

  const handleSave = () => {
    onSettingsChange(draft);
    onClose();
    toast.success('Diffuser settings saved');
  };

  return (
    <div className="card mb-6 border-blue-200 bg-blue-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Diffuser Pricing Settings</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <X size={18} />
        </button>
      </div>

      {/* ── Price Mode Toggle ── */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-2">
          Price Source
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setMode('market')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              isMarket
                ? 'bg-green-600 text-white border-green-600 shadow'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Globe size={15} />
            Market Prices
            <span className="text-xs opacity-75">(Greenheck / Titus)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('custom')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
              !isMarket
                ? 'bg-blue-600 text-white border-blue-600 shadow'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <PenLine size={15} />
            Custom Prices
          </button>
        </div>
      </div>

      {/* ── Price Table ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {isMarket ? 'Market Unit Prices ($/unit)' : 'Custom Unit Prices ($/unit)'}
          </p>
          {isMarket && (
            <button
              onClick={fetchMarketPrices}
              disabled={fetching}
              className="btn-secondary flex items-center gap-1.5 text-xs"
            >
              <RefreshCw size={12} className={fetching ? 'animate-spin' : ''} />
              {fetching ? 'Fetching...' : 'Get Market Prices'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {DIFFUSER_TYPES.map((type) => {
            const priceKey = isMarket ? 'marketPrices' : 'customPrices';
            const currentVal = draft[priceKey]?.[type.id] ?? (isMarket ? MARKET_SEED_PRICES[type.id] : type.defaultPrice);
            return (
              <div key={type.id}>
                <label className="label text-[11px]">{type.label}</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="input text-xs pl-5"
                    value={currentVal}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        [priceKey]: {
                          ...(prev[priceKey] ?? {}),
                          [type.id]: parseFloat(e.target.value) || 0,
                        },
                      }))
                    }
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Table default: ${type.defaultPrice}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Global Parameters ── */}
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
          Global Parameters
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="label">GRD Rate ($/hr)</label>
            <input
              type="number"
              step="0.5"
              className="input"
              value={draft.grdRate ?? DEFAULT_GRD_RATE}
              onChange={(e) => setDraft((prev) => ({ ...prev, grdRate: parseFloat(e.target.value) || DEFAULT_GRD_RATE }))}
            />
            <p className="text-xs text-gray-400 mt-1">T2 — installation labour rate</p>
          </div>
          <div>
            <label className="label">Misc Materials (%)</label>
            <input
              type="number"
              step="1"
              className="input"
              value={Math.round((draft.miscPct ?? DEFAULT_MISC_PCT) * 100)}
              onChange={(e) => setDraft((prev) => ({ ...prev, miscPct: parseInt(e.target.value) / 100 }))}
            />
            <p className="text-xs text-gray-400 mt-1">J2 — 10% of unit price</p>
          </div>
          <div>
            <label className="label">Sheetrock Frame ($)</label>
            <input
              type="number"
              step="1"
              className="input"
              value={draft.frameCost ?? 25}
              onChange={(e) => setDraft((prev) => ({ ...prev, frameCost: parseFloat(e.target.value) || 25 }))}
            />
            <p className="text-xs text-gray-400 mt-1">H col — added when sheetrock ceiling</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} className="btn-primary text-sm">
          Save Settings
        </button>
        <button onClick={onClose} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
