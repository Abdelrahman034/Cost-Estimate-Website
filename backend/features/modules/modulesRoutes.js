// features/modules/modulesRoutes.js
//
// Two mount points (both registered in server.js):
//
//   1. /api/projects/:projectId/estimates/:estimateId/rows/:module
//      → CRUD for rows of a specific module table
//
//   2. /api/modules
//      → List all registered module keys

const router     = require('express').Router({ mergeParams: true });
const { requireAuth } = require('../../middleware/auth');
const controller = require('./modulesController');

router.use(requireAuth);

// Bulk-replace must come before /:id to avoid "rows" being treated as an id
router.put('/',    controller.bulkReplace);  // PUT   /rows/:module
router.get('/',    controller.list);         // GET   /rows/:module
router.post('/',   controller.create);       // POST  /rows/:module
router.get('/:id', controller.getOne);       // GET   /rows/:module/:id
router.patch('/:id', controller.update);     // PATCH /rows/:module/:id
router.delete('/:id', controller.remove);    // DELETE /rows/:module/:id

module.exports = router;
