// routes/auth.js
//
// Auth endpoints:
//   POST /api/auth/register  — create a new company + first admin user
//   POST /api/auth/login     — returns access token + refresh token
//   POST /api/auth/refresh   — swap a valid refresh token for a new access token
//   POST /api/auth/logout    — revoke the refresh token (server-side logout)
//   GET  /api/auth/me        — return the logged-in user's profile

const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const prisma  = require('../prisma/client');
const { requireAuth } = require('../middleware/auth');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 12; // bcrypt work factor — higher = slower = harder to brute-force

function signAccessToken(payload) {
  // Signs a short-lived token. The payload is embedded inside the token
  // (readable by anyone), but the signature proves it came from us.
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
// Creates a brand-new company + the first ADMIN user in one transaction.
// A "transaction" means both inserts succeed together, or neither does.

router.post('/register', async (req, res) => {
  try {
    const { companyName, email, password, firstName, lastName } = req.body;

    // Basic validation — in production you'd use Zod or express-validator
    if (!companyName || !email || !password) {
      return res.status(400).json({ error: 'companyName, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // Hash the password. bcrypt.hash() is async and CPU-intensive by design.
    // Never store plain-text passwords.
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Prisma transaction: create Company + User atomically
    const { company, user } = await prisma.$transaction(async (tx) => {
      // 1. Create the company
      const company = await tx.company.create({
        data: { name: companyName },
      });

      // 2. Create the first admin user inside that company
      const user = await tx.user.create({
        data: {
          companyId: company.id,
          email:     email.toLowerCase().trim(),
          passwordHash,
          firstName,
          lastName,
          role: 'ADMIN', // first user is always admin
        },
      });

      // 3. Create a default pricing config for the company
      await tx.pricingConfig.create({
        data: { companyId: company.id },
      });

      return { company, user };
    });

    // Issue tokens right away so the user is logged in after registering
    const tokenPayload = { userId: user.id, companyId: company.id, role: user.role };
    const accessToken  = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Save refresh token to DB so we can revoke it on logout
    await prisma.refreshToken.create({
      data: {
        userId:    user.id,
        token:     refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        id:        user.id,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,
        companyId: company.id,
        company:   company.name,
      },
    });
  } catch (err) {
    // Prisma throws a specific error code when a unique constraint fails
    // P2002 = "Unique constraint violation"
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    console.error('[auth/register]', err);
    return res.status(500).json({ error: 'Registration failed.' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    // Find user by email (case-insensitive)
    const user = await prisma.user.findFirst({
      where:   { email: email.toLowerCase().trim(), isActive: true },
      include: { company: { select: { id: true, name: true } } },
    });

    // Always run bcrypt.compare even if user not found — prevents timing attacks
    // where an attacker can tell the difference between "wrong email" and "wrong password"
    // based on how fast the server responds.
    const dummyHash   = '$2b$12$invaliddummyhashfortimingreasons000000000000000000';
    const passwordOk  = await bcrypt.compare(password, user?.passwordHash || dummyHash);

    if (!user || !passwordOk) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const tokenPayload = { userId: user.id, companyId: user.companyId, role: user.role };
    const accessToken  = signAccessToken(tokenPayload);
    const refreshToken = signRefreshToken(tokenPayload);

    // Save new refresh token + update lastLoginAt in one transaction
    await prisma.$transaction([
      prisma.refreshToken.create({
        data: {
          userId:    user.id,
          token:     refreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data:  { lastLoginAt: new Date() },
      }),
    ]);

    return res.json({
      accessToken,
      refreshToken,
      user: {
        id:        user.id,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,
        companyId: user.companyId,
        company:   user.company.name,
      },
    });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Login failed.' });
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
// The frontend calls this automatically when the access token expires.
// It sends the refresh token and gets back a brand-new access token.

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    // 1. Verify the token signature and expiry
    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }

    // 2. Check it exists in DB and hasn't been revoked
    const stored = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Refresh token is no longer valid.' });
    }

    // 3. Rotate: revoke old token, issue new pair
    // Token rotation means each refresh token can only be used once —
    // if someone steals it, using it will immediately invalidate the session.
    const newAccessToken  = signAccessToken({ userId: payload.userId, companyId: payload.companyId, role: payload.role });
    const newRefreshToken = signRefreshToken({ userId: payload.userId, companyId: payload.companyId, role: payload.role });

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: stored.id },
        data:  { revokedAt: new Date() }, // revoke old
      }),
      prisma.refreshToken.create({
        data: {
          userId:    payload.userId,
          token:     newRefreshToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      }),
    ]);

    return res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error('[auth/refresh]', err);
    return res.status(500).json({ error: 'Token refresh failed.' });
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
// Revokes the refresh token so it can never be used again.
// The access token will still be valid for up to 15 minutes (that's fine —
// it'll expire on its own, and the frontend should delete it immediately).

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { token: refreshToken, revokedAt: null },
        data:  { revokedAt: new Date() },
      });
    }
    return res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[auth/logout]', err);
    return res.status(500).json({ error: 'Logout failed.' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
// Returns the current user's profile. requireAuth middleware runs first.

router.get('/me', requireAuth, async (req, res) => {
  try {
    // req.user is attached by the requireAuth middleware
    const user = await prisma.user.findUnique({
      where:   { id: req.user.userId },
      select: {
        id:          true,
        email:       true,
        firstName:   true,
        lastName:    true,
        role:        true,
        companyId:   true,
        lastLoginAt: true,
        company:     { select: { id: true, name: true, address: true, phone: true } },
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found.' });
    return res.json(user);
  } catch (err) {
    console.error('[auth/me]', err);
    return res.status(500).json({ error: 'Failed to load profile.' });
  }
});

module.exports = router;
