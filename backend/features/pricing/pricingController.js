// features/pricing/pricingController.js

const svc = require('./pricingService');

async function getConfig(req, res) {
  try { res.json(await svc.getPricingConfig({ companyId: req.user.companyId })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function saveConfig(req, res) {
  try { res.json(await svc.upsertPricingConfig({ companyId: req.user.companyId, data: req.body })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function getHistory(req, res) {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
    res.json(await svc.getPriceHistory({ companyId: req.user.companyId, limit }));
  }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function saveSnapshot(req, res) {
  try {
    const { pricesJson, source } = req.body;
    if (!pricesJson) return res.status(400).json({ error: 'pricesJson is required.' });
    res.status(201).json(await svc.savePriceSnapshot({ companyId: req.user.companyId, pricesJson, source }));
  }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

module.exports = { getConfig, saveConfig, getHistory, saveSnapshot };
