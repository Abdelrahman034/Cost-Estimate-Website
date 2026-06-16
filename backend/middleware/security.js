// middleware/security.js
//
// Consolidated security middleware — no extra npm packages needed.
// Covers: security headers, rate limiting, HPP, input sanitization,
//         request size guard, and brute-force login protection.
//
// Mount order in server.js:
//   app.use(securityHeaders)
//   app.use(hpp)
//   app.use(sanitizeBody)
//   authLimiter   → on /api/auth/login and /api/auth/register
//   apiLimiter    → on /api/*
//   loginTracker  → on /api/auth/login only (account lockout)

// ─────────────────────────────────────────────────────────────────────────────
// 1. SECURITY HEADERS  (replaces `helmet`)
//    Sets HTTP response headers that defend against common browser-based attacks.
// ─────────────────────────────────────────────────────────────────────────────

function securityHeaders(req, res, next) {
  // Prevent browsers from sniffing content-type (MIME confusion attacks)
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Block page from being loaded in an iframe (clickjacking)
  res.setHeader('X-Frame-Options', 'DENY');

  // Enable browser's XSS filter (legacy — still useful for older browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Only send referrer for same-origin requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy — API-only server, so block everything browser-side
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none';"
  );

  // Strict Transport Security — tell browsers to only use HTTPS (1 year)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Hide that this is an Express server
  res.removeHeader('X-Powered-By');

  // Disable caching for all API responses (data is sensitive)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');

  // Prevent browsers from sending credentials cross-origin silently
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RATE LIMITER  (replaces `express-rate-limit`)
//    In-memory sliding-window counter per IP.
//    Two presets: strict (auth) and standard (general API).
// ─────────────────────────────────────────────────────────────────────────────

function createRateLimiter({ windowMs, max, message }) {
  // Map<ip, { count, resetAt }>
  const store = new Map();

  // Clean up stale entries every windowMs to prevent unbounded memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store.entries()) {
      if (val.resetAt <= now) store.delete(key);
    }
  }, windowMs).unref(); // .unref() so this timer doesn't keep the process alive

  return function rateLimiter(req, res, next) {
    // Use X-Forwarded-For if behind a proxy (set trust proxy in production)
    const ip  = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    let entry = store.get(ip);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(ip, entry);
    }

    entry.count++;

    // Set standard rate-limit headers so clients can back off gracefully
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: message });
    }

    next();
  };
}

// Auth endpoints: 10 attempts per 15 min in production, 100 in development
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max:      process.env.NODE_ENV === 'production' ? 10 : 100,
  message:  'Too many attempts. Please wait 15 minutes before trying again.',
});

// General API: 300 requests per minute per IP
const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max:      300,
  message:  'Too many requests. Please slow down.',
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ACCOUNT LOCKOUT  (brute-force login protection beyond rate limiting)
//    Tracks failed login attempts per email. Locks for 15 min after 5 failures.
//    This is separate from IP rate limiting — an attacker using proxies still
//    hits this wall.
// ─────────────────────────────────────────────────────────────────────────────

const LOCKOUT_MAX      = 5;             // failed attempts before lockout
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Map<email, { failures, lockedUntil }>
const loginAttempts = new Map();

// Clean stale lockout entries every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts.entries()) {
    if (val.lockedUntil && val.lockedUntil <= now) loginAttempts.delete(key);
  }
}, 30 * 60 * 1000).unref();

function loginLockoutCheck(req, res, next) {
  const email = req.body?.email?.toLowerCase?.()?.trim?.();
  if (!email) return next();

  const entry = loginAttempts.get(email);
  if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
    const waitSec = Math.ceil((entry.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: `Account temporarily locked due to too many failed attempts. Try again in ${waitSec} seconds.`,
    });
  }
  next();
}

function recordLoginFailure(email) {
  if (!email) return;
  const key   = email.toLowerCase().trim();
  const entry = loginAttempts.get(key) || { failures: 0, lockedUntil: null };
  entry.failures++;
  if (entry.failures >= LOCKOUT_MAX) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION;
    entry.failures    = 0; // reset so next window works
  }
  loginAttempts.set(key, entry);
}

function recordLoginSuccess(email) {
  if (email) loginAttempts.delete(email.toLowerCase().trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. HPP — HTTP Parameter Pollution  (replaces `hpp`)
//    Normalizes array query params to single values to prevent logic confusion.
//    e.g. ?role=ADMIN&role=ESTIMATOR → role='ESTIMATOR' (last wins)
// ─────────────────────────────────────────────────────────────────────────────

function hpp(req, res, next) {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        // Take only the last value — prevents duplicate-param bypass tricks
        req.query[key] = req.query[key][req.query[key].length - 1];
      }
    }
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. INPUT SANITIZATION  (XSS + null byte injection)
//    Strips null bytes and HTML-encodes dangerous characters in all string
//    fields of req.body recursively. Prisma already parameterizes SQL, but
//    this protects against stored XSS in data that gets rendered by a frontend.
// ─────────────────────────────────────────────────────────────────────────────

function sanitizeValue(val) {
  if (typeof val !== 'string') return val;
  return val
    .replace(/\0/g, '')     // null bytes — can bypass filters
    .replace(/\x08/g, '')   // backspace bytes
    .replace(/</g, '&lt;')  // HTML tag open — the only char truly dangerous for XSS
    .replace(/>/g, '&gt;'); // HTML tag close
  // NOTE: We intentionally do NOT encode ' " / — those are valid in project names,
  // addresses, dates ("2026/06/01"), email addresses, etc. Encoding them would
  // corrupt stored data. SQL injection is already prevented by Prisma's
  // parameterized queries. XSS is prevented by never rendering raw HTML from
  // user input; the frontend should escape output at render time.
}

function sanitizeObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitizeValue(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (typeof obj === 'object') {
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = sanitizeObject(v);
    }
    return clean;
  }
  return obj;
}

// NOTE: We intentionally do NOT sanitize passwords, since special chars are
// valid and expected in passwords. The password is hashed before DB storage.
const SKIP_SANITIZE_KEYS = new Set(['password', 'newPassword', 'currentPassword']);

function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(req.body)) {
      cleaned[k] = SKIP_SANITIZE_KEYS.has(k) ? v : sanitizeObject(v);
    }
    req.body = cleaned;
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. REQUEST SIZE GUARD
//    Blocks abnormally large payloads on auth routes (no reason to send 50MB
//    to a login endpoint — that's a DoS attempt).
// ─────────────────────────────────────────────────────────────────────────────

function authSizeGuard(req, res, next) {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > 10 * 1024) { // 10 KB max on auth routes
    return res.status(413).json({ error: 'Request payload too large.' });
  }
  next();
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. JSONB INPUT GUARD
//    Prevents excessively nested or huge JSON objects from being stored in
//    JSONB columns (memory exhaustion / ReDoS via deeply nested objects).
// ─────────────────────────────────────────────────────────────────────────────

function getJsonDepth(obj, depth = 0) {
  if (depth > 20) return depth;
  if (typeof obj !== 'object' || obj === null) return depth;
  return Math.max(...Object.values(obj).map(v => getJsonDepth(v, depth + 1)));
}

function jsonbGuard(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    if (getJsonDepth(req.body) > 15) {
      return res.status(400).json({ error: 'Request body is too deeply nested.' });
    }
    const bodySize = JSON.stringify(req.body).length;
    if (bodySize > 5 * 1024 * 1024) {
      return res.status(413).json({ error: 'Request body too large.' });
    }
  }
  next();
}

module.exports = {
  securityHeaders,
  authLimiter,
  apiLimiter,
  loginLockoutCheck,
  recordLoginFailure,
  recordLoginSuccess,
  hpp,
  sanitizeBody,
  authSizeGuard,
  jsonbGuard,
};
