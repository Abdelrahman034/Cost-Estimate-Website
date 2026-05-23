// features/projects/projectsRoutes.js

const router     = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { validateCreateProject, validateUpdateProject } = require('./projectsValidation');
const controller = require('./projectsController');

// All project routes require a valid access token
router.use(requireAuth);

router.get('/',    controller.list);
router.post('/',   validateCreateProject, controller.create);
router.get('/:id', controller.getOne);
router.patch('/:id', validateUpdateProject, controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
