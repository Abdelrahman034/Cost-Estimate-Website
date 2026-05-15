import React, { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { pricesApi } from '../../services/api';

const TrendIcon = ({ trend }) => {
  if (trend === 'up') return <TrendingUp size={14} className="text-red-500" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-green-500" />;
  return <Minus size={14} className="text-gray-400" />;
};

export default function PriceMonitor() {
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState(null);

  const fetchPrices = async (force = false) => {
    setLoading(true);
    try {
      const res = await pricesApi.getCurrent(force);
      setPrices(res.data);
      setLastFetch(new Date());
      toast.success(res.data.cached ? 'Showing cached prices' : 'Prices updated by AI');
    } catch {
      toast.error('Could not fetch prices. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const sm = prices?.sheetMetal?.galvanizedSteel;
  const insul = prices?.insulation;
  const labor = prices?.labor;
  const fittings = prices?.fittings;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Live Price Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">
            AI-powered material and labor pricing — refreshed daily
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastFetch && (
            <span className="text-xs text-gray-400">
              Updated {lastFetch.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchPrices(true)}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Fetching...' : 'Refresh Prices'}
          </button>
        </div>
      </div>

      {!prices && !loading && (
        <div className="card text-center py-12">
          <AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Could not load prices. Make sure the backend server is running.</p>
          <button onClick={() => fetchPrices()} className="btn-primary mt-4">Retry</button>
        </div>
      )}

      {loading && (
        <div className="card text-center py-12">
          <div className="w-10 h-10 spinner mx-auto mb-4" />
          <p className="text-blue-600 font-medium">Claude AI is fetching current market prices...</p>
        </div>
      )}

      {prices && (
        <div className="space-y-6">
          {/* AI Notes */}
          {prices.marketNotes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-amber-800 mb-1">Market Intelligence</h3>
              <p className="text-sm text-amber-700">{prices.marketNotes}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-600">
                <span className="bg-amber-100 px-2 py-0.5 rounded">
                  Confidence: {prices.confidence || 'medium'}
                </span>
              </div>
            </div>
          )}

          {/* Sheet Metal Prices */}
          {sm && (
            <div className="card">
              <h3 className="section-title">Galvanized Sheet Metal</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {Object.entries(sm).map(([key, data]) => (
                  <div key={key} className="bg-gray-50 rounded-xl p-4 text-center">
                    <div className="text-xs text-gray-500 mb-1 font-medium">
                      {key.replace('gauge', '')} Gauge
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      ${data.pricePerSqFt?.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{data.unit}</div>
                    <div className="flex items-center justify-center gap-1 mt-2">
                      <TrendIcon trend={data.trend} />
                      <span className={`text-xs ${
                        data.trend === 'up' ? 'text-red-500' :
                        data.trend === 'down' ? 'text-green-500' : 'text-gray-400'
                      }`}>
                        {data.trend || 'stable'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Insulation */}
            {insul && (
              <div className="card">
                <h3 className="section-title text-sm">Insulation</h3>
                {Object.entries(insul).map(([key, data]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">
                      {key.replace(/([A-Z])/g, ' $1').replace('duct ', '').trim()}
                    </span>
                    <div className="flex items-center gap-2">
                      <TrendIcon trend={data.trend} />
                      <span className="font-semibold text-sm">${data.pricePerSqFt?.toFixed(2)}/sqft</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Labor */}
            {labor && (
              <div className="card">
                <h3 className="section-title text-sm">Labor Rates</h3>
                {Object.entries(labor).filter(([k]) => k !== 'unit').map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="font-semibold text-sm">${val}/hr</span>
                  </div>
                ))}
              </div>
            )}

            {/* Fitting Multipliers */}
            {fittings && (
              <div className="card">
                <h3 className="section-title text-sm">Fitting Multipliers</h3>
                {Object.entries(fittings).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                    <span className="text-sm text-gray-600 capitalize">
                      {key.replace('Multiplier', '')}
                    </span>
                    <span className="font-semibold text-sm">{val}×</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
