const express = require('express');
const router  = express.Router();
const { getCurrentPrices } = require('../services');
const prisma = require('../prisma/client');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ── Helpers (replaces legacy SQLite priceHistory) ─────────────────────────────

async function getLatestPriceHistory(companyId) {
  try {
    return await prisma.priceHistory.findFirst({
      where: companyId ? { companyId } : undefined,
      orderBy: { fetchedAt: 'desc' },
    });
  } catch { return null; }
}

async function savePriceHistory(companyId, pricesData) {
  try {
    await prisma.priceHistory.create({
      data: { companyId, pricesJson: pricesData, source: 'api' },
    });
  } catch { /* non-fatal */ }
}

// ─────────────────────────────────────────────────────────────────────────────

router.get('/current', async (req, res) => {
  const companyId = req.user?.companyId;
  try {
    const forceRefresh = req.query.refresh === 'true';

    if (!forceRefresh) {
      const cached = await getLatestPriceHistory(companyId);
      if (cached?.fetchedAt) {
        const age = Date.now() - new Date(cached.fetchedAt).getTime();
        if (age < CACHE_TTL_MS) {
          return res.json({ ...cached.pricesJson, cached: true });
        }
      }
    }

    const prices = await getCurrentPrices();
    if (companyId) await savePriceHistory(companyId, prices);
    res.json({ ...prices, cached: false });
  } catch (err) {
    console.error('[prices/current]', err.message);
    const lastSaved = await getLatestPriceHistory(companyId);
    if (lastSaved) return res.json({ ...lastSaved.pricesJson, cached: true, fallback: true });
    // Never send raw err.message to client — it may contain DB or internal details
    res.status(500).json({ error: 'Failed to fetch current prices.' });
  }
});

router.get('/history', async (req, res) => {
  const companyId = req.user?.companyId;
  // companyId is required — this route is protected by requireAuth which sets req.user
  if (!companyId) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    const rows = await prisma.priceHistory.findMany({
      where:   { companyId },   // always scoped — never return another company's history
      orderBy: { fetchedAt: 'desc' },
      take:    20,
    });
    res.json(rows.map(r => ({ ...r.pricesJson, fetchedAt: r.fetchedAt, source: r.source })));
  } catch (err) {
    console.error('[prices/history]', err.message);
    res.status(500).json({ error: 'Failed to load price history.' });
  }
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
