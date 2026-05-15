const express = require('express');
const router  = express.Router();
const { getCurrentPrices } = require('../services/aiService');
const { priceHistory }     = require('../services/dbService');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

router.get('/current', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === 'true';

    if (!forceRefresh) {
      const cached = priceHistory.getLatest();
      if (cached && cached.savedAt) {
        const age = Date.now() - new Date(cached.savedAt).getTime();
        if (age < CACHE_TTL_MS) {
          return res.json({ ...cached, cached: true });
        }
      }
    }

    const prices = await getCurrentPrices();
    priceHistory.save(prices);
    res.json({ ...prices, cached: false });
  } catch (err) {
    console.error('Price fetch error:', err.message);
    const lastSaved = priceHistory.getLatest();
    if (lastSaved) return res.json({ ...lastSaved, cached: true, fallback: true });
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', (req, res) => {
  try { res.json(priceHistory.getAll(20)); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/defaults', (req, res) => {
  res.json({
    sheetMetal: {
      galvanizedSteel: {
        gauge26: { pricePerSqFt: 1.85, unit: '$/sqft' },
        gauge24: { pricePerSqFt: 2.10, unit: '$/sqft' },
        gauge22: { pricePerSqFt: 2.45, unit: '$/sqft' },
        gauge20: { pricePerSqFt: 2.90, unit: '$/sqft' },
        gauge18: { pricePerSqFt: 3.60, unit: '$/sqft' },
      },
    },
    insulation: {
      ductWrap2inch: { pricePerSqFt: 0.85, unit: '$/sqft' },
      ductWrap1inch: { pricePerSqFt: 0.55, unit: '$/sqft' },
    },
    fittings: { elbowMultiplier: 1.8, teeMultiplier: 2.2, reducerMultiplier: 1.4, offsetMultiplier: 1.6 },
    labor: { sheetMetalWorkerRate: 68.00, foremanRate: 82.00, unit: '$/hour' },
  });
});

module.exports = router;
