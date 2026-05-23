// features/auth/authValidation.js
//
// Validation middleware for auth routes.
// Each exported function returns a middleware that checks req.body
// and calls next() if valid, or sends 400 with a clear error message.
//
// Why validate here and not in the controller?
//   The controller should only deal with "what to do", not "is the input valid".
//   Keeping validation separate means you can swap validation libraries
//   (e.g. Zod, Joi) without touching business logic.

function validateRegister(req, res, next) {
  const { companyName, email, password } = req.body;

  if (!companyName || !companyName.trim()) {
    return res.status(400).json({ error: 'Company name is required.' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email format is invalid.' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  next();
}

function validateRefresh(req, res, next) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }

  next();
}

module.exports = { validateRegister, validateLogin, validateRefresh };
