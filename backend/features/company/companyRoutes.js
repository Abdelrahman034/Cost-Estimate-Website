// features/company/companyRoutes.js — /api/company

const router          = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const ctrl            = require('./companyController');

router.use(requireAuth);

// Company profile
router.get('/',      ctrl.getCompany);    // GET  /api/company
router.patch('/',    ctrl.updateCompany); // PATCH /api/company

// Users
router.get('/users',        ctrl.listUsers);   // GET    /api/company/users
router.patch('/users/:id',  ctrl.updateUser);  // PATCH  /api/company/users/:id
router.delete('/users/:id', ctrl.deleteUser);  // DELETE /api/company/users/:id

// Invites
router.get('/invites',        ctrl.listInvites);  // GET    /api/company/invites
router.post('/invites',       ctrl.createInvite); // POST   /api/company/invites
router.delete('/invites/:id', ctrl.revokeInvite); // DELETE /api/company/invites/:id

module.exports = router;
