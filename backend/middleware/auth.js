// middleware/auth.js
//
// After requireAuth runs, every handler has access to:
//   req.user.userId      — the logged-in user's ID
//   req.user.companyId   — their company (used to scope ALL database queries)
//   req.user.role        — 'OWNER' | null
//   req.user.permissions — array of permission keys (null for owners)

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = payload; // { userId, companyId, role, customRoleId, permissions, iat, exp }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
}

// requireOwner — only the OWNER role passes
function requireOwner(req, res, next) {
  if (req.user?.role !== 'OWNER') {
    return res.status(403).json({ error: 'Access denied. Owner role required.' });
  }
  next();
}

// requireRole kept for backward compat — treats 'ADMIN' as alias for 'OWNER'
function requireRole(...roles) {
  const normalized = roles.map(r => r === 'ADMIN' ? 'OWNER' : r);
  return (req, res, next) => {
    if (!normalized.includes(req.user?.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${normalized.join(' or ')}.`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireOwner, requireRole };
