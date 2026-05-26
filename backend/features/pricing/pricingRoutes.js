// features/pricing/pricingRoutes.js

const router          = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl            = require('./pricingController');

router.use(requireAuth);

router.get('/',          ctrl.getConfig);    // GET  /api/pricing
router.put('/',          ctrl.saveConfig);   // PUT  /api/pricing
router.get('/history',   ctrl.getHistory);   // GET  /api/pricing/history
router.post('/history',  ctrl.saveSnapshot); // POST /api/pricing/history (save a price snapshot)

module.exports = router;
