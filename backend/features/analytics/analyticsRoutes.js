// features/analytics/analyticsRoutes.js

const router          = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { dashboard }   = require('./analyticsController');

router.use(requireAuth);

router.get('/', dashboard); // GET /api/analytics

module.exports = router;
