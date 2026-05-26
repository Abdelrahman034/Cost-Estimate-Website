// features/projects/projectsRoutes.js

const router     = require('express').Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const { validateCreateProject, validateUpdateProject } = require('./projectsValidation');
const controller = require('./projectsController');

// All project routes require a valid access token
router.use(requireAuth);

router.get('/',    controller.list);
router.post('/',   validateCreateProject, controller.create);
router.get('/:id', controller.getOne);
router.patch('/:id', validateUpdateProject, controller.update);
router.put('/:id',   validateUpdateProject, controller.update);   // frontend uses PUT
router.delete('/:id', controller.remove);

// Member management — admin only
router.get('/:id/members',             requireRole('ADMIN'), controller.getMembers);
router.post('/:id/members',            requireRole('ADMIN'), controller.addMember);
router.delete('/:id/members/:userId',  requireRole('ADMIN'), controller.removeMember);

// Per-project settings overrides — any authenticated member of the project
// GET returns current overrides; PUT saves new overrides; DELETE resets to company defaults
router.get('/:id/settings',    controller.getSettings);
router.put('/:id/settings',    controller.saveSettings);
router.delete('/:id/settings', controller.resetSettings);

module.exports = router;
