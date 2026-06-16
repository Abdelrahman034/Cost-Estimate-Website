const router          = require('express').Router();
const ctrl            = require('./calculateController');
const { requireAuth } = require('../../middleware/auth');

router.use(requireAuth);
router.post('/', ctrl.calculate); // all authenticated users can calculate

module.exports = router;
