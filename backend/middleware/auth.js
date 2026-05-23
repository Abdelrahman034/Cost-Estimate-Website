// middleware/auth.js
//
// Middleware that protects routes by verifying the JWT access token.
//
// Usage on a route:
//   router.get('/projects', requireAuth, handler)
//   router.delete('/projects/:id', requireAuth, requireRole('ADMIN'), handler)
//
// After requireAuth runs, every handler has access to:
//   req.user.userId    — the logged-in user's ID
//   req.user.companyId — their company (used to scope ALL database queries)
//   req.user.role      — ADMIN | ESTIMATOR | VIEWER

const jwt = require('jsonwebtoken');

// ─── requireAuth ─────────────────────────────────────────────────────────────
// Checks the Authorization header for a Bearer token,
// verifies the signature, and attaches the payload to req.user.
//
// The Authorization header looks like:
//   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Header format is "Bearer <token>" — split on space and take the second part
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  try {
    // jwt.verify() checks the signature AND the expiry in one call.
    // If the token is expired or tampered with, it throws an error.
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload; // { userId, companyId, role, iat, exp }
    next();             // pass control to the actual route handler
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

// ─── requireRole ─────────────────────────────────────────────────────────────
// Factory function that returns middleware checking the user's role.
// Call AFTER requireAuth so req.user is already set.
//
// Example: requireRole('ADMIN') or requireRole('ADMIN', 'ESTIMATOR')

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
