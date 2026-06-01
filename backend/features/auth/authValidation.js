// features/auth/authValidation.js
//
// Validation middleware for auth routes.

// Strong password: 8+ chars, uppercase, lowercase, digit, special character
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+[\]{};':"\\|,.<>/?]).{8,72}$/;
// 72-char max because bcrypt silently truncates beyond 72 bytes

// Email: basic format check + length cap
const EMAIL_REGEX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

function validateRegister(req, res, next) {
  const { companyName, email, password } = req.body;

  if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
    return res.status(400).json({ error: 'Company name is required.' });
  }
  if (companyName.trim().length > 200) {
    return res.status(400).json({ error: 'Company name is too long.' });
  }
  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required.' });
  }
  if (!PASSWORD_POLICY.test(password)) {
    return res.status(400).json({
      error: 'Password must be 8–72 characters and include uppercase, lowercase, a number, and a special character.',
    });
  }

  next();
}

function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Password is required.' });
  }
  // Cap lengths to prevent bcrypt timing games on absurdly long inputs
  if (email.length > 320 || password.length > 1000) {
    return res.status(400).json({ error: 'Invalid credentials.' });
  }

  next();
}

function validateRefresh(req, res, next) {
  const { refreshToken } = req.body;

  if (!refreshToken || typeof refreshToken !== 'string') {
    return res.status(400).json({ error: 'Refresh token is required.' });
  }
  // JWT is header.payload.signature — sanity-check the format before hitting DB
  if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(refreshToken)) {
    return res.status(401).json({ error: 'Invalid token format.' });
  }

  next();
}

module.exports = { validateRegister, validateLogin, validateRefresh };
