// features/estimates/estimatesRoutes.js
//
// Mounted at /api/projects/:projectId/estimates (mergeParams: true)

const router = require('express').Router({ mergeParams: true });
const { requireAuth }            = require('../../middleware/auth');
const { validateUpsertEstimate } = require('./estimatesValidation');
const controller                 = require('./estimatesController');

router.use(requireAuth);

// List all estimates for this project
router.get('/',                        controller.list);

// Get estimate by module slug  (must come before /:id to avoid "module" matching as an id)
router.get('/module/:module',          controller.getByModule);

// Get a single estimate by id (with rows)
router.get('/:id',                     controller.getOne);

// Create or update the estimate for a module (upsert)
router.post('/',  validateUpsertEstimate, controller.upsert);

// Delete an estimate
router.delete('/:id',                  controller.remove);

module.exports = router;
