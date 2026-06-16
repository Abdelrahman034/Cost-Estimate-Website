// features/company/companyRoutes.js — /api/company

const router                     = require('express').Router();
const { requireAuth, requireOwner } = require('../../middleware/auth');
const ctrl                       = require('./companyController');

router.use(requireAuth);

// Company profile (owner only for writes)
router.get('/',   ctrl.getCompany);
router.patch('/', requireOwner, ctrl.updateCompany);

// Users
router.get('/users',        ctrl.listUsers);
router.patch('/users/:id',  requireOwner, ctrl.updateUser);
router.delete('/users/:id', requireOwner, ctrl.deleteUser);

// Invites
router.get('/invites',        ctrl.listInvites);
router.post('/invites',       requireOwner, ctrl.createInvite);
router.delete('/invites/:id', requireOwner, ctrl.revokeInvite);

// Custom Roles (owner only)
router.get('/roles',        ctrl.listCustomRoles);
router.post('/roles',       requireOwner, ctrl.createCustomRole);
router.patch('/roles/:id',  requireOwner, ctrl.updateCustomRole);
router.delete('/roles/:id', requireOwner, ctrl.deleteCustomRole);

module.exports = router;
