// features/auth/authRoutes.js — Mounted at /api/auth in server.js

const router = require('express').Router();
const { requireAuth }    = require('../../middleware/auth');
const { loginLockoutCheck, authSizeGuard } = require('../../middleware/security');
const { validateRegister, validateLogin, validateRefresh } = require('./authValidation');
const controller = require('./authController');

// Public — all auth endpoints get a size guard to block oversized payloads
router.post('/register',     authSizeGuard, validateRegister,              controller.register);
router.post('/login',        authSizeGuard, loginLockoutCheck, validateLogin, controller.login);
router.post('/refresh',      authSizeGuard, validateRefresh,               controller.refresh);
router.post('/logout',       authSizeGuard,                                controller.logout);
router.get('/invite/:token',                                               controller.getInvite);
router.post('/accept-invite', authSizeGuard,                               controller.acceptInvite);

// Protected
router.get('/me', requireAuth, controller.getMe);

module.exports = router;
