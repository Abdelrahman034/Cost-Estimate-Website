// features/analytics/analyticsController.js

const { getAnalytics } = require('./analyticsService');

async function dashboard(req, res) {
  try { res.json(await getAnalytics({ companyId: req.user.companyId })); }
  catch (e) { console.error('[analytics]', e); res.status(e.status || 500).json({ error: e.message }); }
}

module.exports = { dashboard };
