// features/auth/authRoutes.js
//
// Route definitions ONLY — maps URLs + HTTP methods to controller functions.
// Validation middleware runs before the controller.
// requireAuth protects routes that need a logged-in user.
//
// Mounted at /api/auth in server.js

const router = require('express').Router();
const { requireAuth } = require('../../middleware/auth');
const { validateRegister, validateLogin, validateRefresh } = require('./authValidation');
const controller = require('./authController');

// Public routes (no token needed)
router.post('/register', validateRegister, controller.register);
router.post('/login',    validateLogin,    controller.login);
router.post('/refresh',  validateRefresh,  controller.refresh);
router.post('/logout',                     controller.logout);  // optional token

// Protected route (requireAuth verifies JWT before controller runs)
router.get('/me', requireAuth, controller.getMe);

module.exports = router;
