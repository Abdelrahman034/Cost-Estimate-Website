// features/scenarios/scenariosRoutes.js — mounted with mergeParams: true

const router          = require('express').Router({ mergeParams: true });
const { requireAuth } = require('../../middleware/auth');
const ctrl            = require('./scenariosController');

router.use(requireAuth);

router.get('/',     ctrl.list);
router.post('/',    ctrl.create);
router.get('/:id',  ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
