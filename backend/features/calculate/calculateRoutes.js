const router          = require('express').Router();
const ctrl            = require('./calculateController');
const { requireAuth, requireRole } = require('../../middleware/auth');

router.use(requireAuth);
router.post('/', requireRole('ADMIN', 'ESTIMATOR'), ctrl.calculate);

module.exports = router;
