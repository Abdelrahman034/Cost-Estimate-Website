'use strict';
const router = require('express').Router();
const ctrl   = require('./copperController');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);

// ── Calculation endpoints (all authenticated users) ────────────────────────

/** GET  /api/copper-pricing/tables  — active reference data (pipe sizes, weights…) */
router.get('/tables', ctrl.getTables);

/** POST /api/copper-pricing/vrv-per-size — VRV per-size table at given LME */
router.post('/vrv-per-size', ctrl.calcVRVPerSize);

/** POST /api/copper-pricing — main calculation endpoint */
router.post('/', ctrl.calcCopper);

// ── Admin reference-data endpoints ────────────────────────────────────────
// Read access for all authenticated users; writes enforce ADMIN role
// inside each handler (non-admins still see the data, can't change it).

/** GET  /api/copper-pricing/specs — all pipe specs (DB or hardcoded fallback) */
router.get('/specs', ctrl.getPipeSpecs);

/** PUT  /api/copper-pricing/specs/:id — update a pipe spec [ADMIN] */
router.put('/specs/:id', ctrl.updatePipeSpec);

/** GET  /api/copper-pricing/equipment-configs — all equipment configs */
router.get('/equipment-configs', ctrl.getEquipmentConfigs);

/** PUT  /api/copper-pricing/equipment-configs/:id — update a config [ADMIN] */
router.put('/equipment-configs/:id', ctrl.updateEquipmentConfig);

/** POST /api/copper-pricing/restore-defaults — re-seed calibrated data [ADMIN] */
router.post('/restore-defaults', ctrl.restoreDefaults);

module.exports = router;
