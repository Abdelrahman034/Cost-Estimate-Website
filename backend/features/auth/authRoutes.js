// features/auth/authRoutes.js — Mounted at /api/auth in server.js

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { validateRegister, validateLogin, validateRefresh } = require('./authValidation');
const controller = require('./authController');

// Public
router.post('/register',     validateRegister, controller.register);
router.post('/login',        validateLogin,    controller.login);
router.post('/refresh',      validateRefresh,  controller.refresh);
router.post('/logout',                         controller.logout);
router.get('/invite/:token',                   controller.getInvite);
router.post('/accept-invite',                  controller.acceptInvite);

// Protected
router.get('/me', requireAuth, controller.getMe);

module.exports = router;
