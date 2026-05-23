// features/auth/authController.js
//
// Controllers handle the HTTP layer ONLY:
//   - Read from req (body, params, headers)
//   - Call the service
//   - Send back res with the right status code
//
// Controllers do NOT contain business logic or database calls.
// If something goes wrong in the service, the error bubbles up here
// and we send the appropriate HTTP response.

const authService = require('./authService');

async function register(req, res) {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json(result);
  } catch (err) {
    // Prisma unique constraint violation (email already exists)
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error('[auth/register]', err);
    return res.status(err.status || 500).json({ error: err.message || 'Registration failed.' });
  }
}

async function login(req, res) {
  try {
    const result = await authService.login(req.body);
    return res.json(result);
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(err.status || 500).json({ error: err.message || 'Login failed.' });
  }
}

async function refresh(req, res) {
  try {
    const result = await authService.refreshTokens(req.body);
    return res.json(result);
  } catch (err) {
    console.error('[auth/refresh]', err);
    return res.status(err.status || 500).json({ error: err.message || 'Token refresh failed.' });
  }
}

async function logout(req, res) {
  try {
    await authService.logout(req.body);
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[auth/logout]', err);
    return res.status(500).json({ error: 'Logout failed.' });
  }
}

async function getMe(req, res) {
  try {
    // req.user is attached by requireAuth middleware before this runs
    const user = await authService.getMe(req.user.userId);
    return res.json(user);
  } catch (err) {
    console.error('[auth/me]', err);
    return res.status(err.status || 500).json({ error: err.message || 'Failed to load profile.' });
  }
}

module.exports = { register, login, refresh, logout, getMe };
