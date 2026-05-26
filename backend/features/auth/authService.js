// features/auth/authService.js
//
// Business logic + database operations for authentication.
// The service layer is the "brain" — it knows HOW things work.
// Controllers call the service; the service calls Prisma.
//
// Rule: no req/res objects here. This layer is reusable outside HTTP context.

const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const prisma = require('../../prisma/client');

const SALT_ROUNDS        = 12;
const REFRESH_TTL_MS     = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// ── Token helpers ─────────────────────────────────────────────────────────────

function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

function signRefreshToken(payload) {
  // jti (JWT ID) makes every token cryptographically unique even when two
  // tokens are issued within the same second for the same user.
  const { randomBytes } = require('crypto');
  return jwt.sign(
    { ...payload, jti: randomBytes(16).toString('hex') },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' },
  );
}

function buildTokenPayload(user) {
  return { userId: user.id, companyId: user.companyId, role: user.role };
}

function formatUserResponse(user, company) {
  return {
    id:        user.id,
    email:     user.email,
    firstName: user.firstName,
    lastName:  user.lastName,
    role:      user.role,
    companyId: user.companyId,
    company:   company?.name ?? user.company?.name,
  };
}

// ── Register ──────────────────────────────────────────────────────────────────

async function register({ companyName, email, password, firstName, lastName }) {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Prisma transaction: all-or-nothing — if any step fails, nothing is saved
  const { company, user } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: companyName },
    });
    const user = await tx.user.create({
      data: {
        companyId: company.id,
        email:     email.toLowerCase().trim(),
        passwordHash,
        firstName,
        lastName,
        role: 'ADMIN',
      },
    });
    // Create a default pricing config so the company is ready to estimate
    await tx.pricingConfig.create({ data: { companyId: company.id } });
    return { company, user };
  });

  const payload      = buildTokenPayload(user);
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });

  return { accessToken, refreshToken, user: formatUserResponse(user, company) };
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function login({ email, password }) {
  const user = await prisma.user.findFirst({
    where:   { email: email.toLowerCase().trim(), isActive: true },
    include: { company: { select: { id: true, name: true } } },
  });

  // Always call bcrypt.compare even when user is not found to prevent timing attacks.
  // A timing attack is when an attacker measures how fast the server responds to
  // figure out if an email exists. Running bcrypt either way makes both cases
  // take the same amount of time.
  const dummy      = '$2b$12$invaliddummyhashfortimingreasons000000000000000000';
  const passwordOk = await bcrypt.compare(password, user?.passwordHash || dummy);

  if (!user || !passwordOk) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }

  const payload      = buildTokenPayload(user);
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Save refresh token and update lastLoginAt in parallel
  await prisma.$transaction([
    prisma.refreshToken.create({
      data: { userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    }),
    prisma.user.update({
      where: { id: user.id },
      data:  { lastLoginAt: new Date() },
    }),
  ]);

  return { accessToken, refreshToken, user: formatUserResponse(user) };
}

// ── Refresh Token ─────────────────────────────────────────────────────────────

async function refreshTokens({ refreshToken }) {
  // 1. Verify JWT signature and expiry
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    const err = new Error('Invalid or expired refresh token.');
    err.status = 401;
    throw err;
  }

  // 2. Check it's in the DB and not revoked
  const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    const err = new Error('Refresh token is no longer valid.');
    err.status = 401;
    throw err;
  }

  // 3. Rotate: revoke old, issue new pair
  // Token rotation: each refresh token is single-use. If it's stolen and used,
  // the real user's next refresh will fail (their token was already rotated),
  // alerting the system to a potential breach.
  const newPayload      = { userId: payload.userId, companyId: payload.companyId, role: payload.role };
  const newAccessToken  = signAccessToken(newPayload);
  const newRefreshToken = signRefreshToken(newPayload);

  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } }),
    prisma.refreshToken.create({
      data: { userId: payload.userId, token: newRefreshToken, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
    }),
  ]);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

async function logout({ refreshToken }) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken, revokedAt: null },
    data:  { revokedAt: new Date() },
  });
}

// ── Get Current User Profile ──────────────────────────────────────────────────

async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, companyId: true, lastLoginAt: true,
      company: { select: { id: true, name: true, address: true, phone: true } },
    },
  });
  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    throw err;
  }
  return user;
}

// ── Validate Invite Token ─────────────────────────────────────────────────────
// Returns invite + company info so the frontend can pre-fill the form.

async function getInvite(token) {
  const invite = await prisma.invite.findUnique({
    where:   { token },
    include: { company: { select: { name: true } } },
  });
  if (!invite) {
    const e = new Error('Invite not found.'); e.status = 404; throw e;
  }
  if (invite.status !== 'PENDING') {
    const e = new Error('This invite has already been used.'); e.status = 410; throw e;
  }
  if (new Date() > invite.expiresAt) {
    const e = new Error('This invite has expired. Ask your admin to resend it.'); e.status = 410; throw e;
  }
  return {
    email:       invite.email,
    role:        invite.role,
    companyName: invite.company.name,
    expiresAt:   invite.expiresAt,
  };
}

// ── Accept Invite ─────────────────────────────────────────────────────────────
// Creates the user account, marks the invite ACCEPTED, returns auth tokens.

async function acceptInvite({ token, firstName, lastName, password }) {
  const invite = await prisma.invite.findUnique({
    where:   { token },
    include: { company: { select: { id: true, name: true } } },
  });
  if (!invite) {
    const e = new Error('Invite not found.'); e.status = 404; throw e;
  }
  if (invite.status !== 'PENDING') {
    const e = new Error('This invite has already been used.'); e.status = 410; throw e;
  }
  if (new Date() > invite.expiresAt) {
    const e = new Error('This invite has expired. Ask your admin to resend it.'); e.status = 410; throw e;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create the user and mark the invite ACCEPTED in one transaction
  const [user] = await prisma.$transaction([
    prisma.user.create({
      data: {
        companyId:    invite.companyId,
        email:        invite.email,
        firstName,
        lastName,
        role:         invite.role,
        passwordHash,
      },
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data:  { status: 'ACCEPTED', acceptedAt: new Date() },
    }),
  ]);

  const payload      = buildTokenPayload(user);
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await prisma.refreshToken.create({
    data: { userId: user.id, token: refreshToken, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id, email: user.email, firstName: user.firstName,
      lastName: user.lastName, role: user.role, companyId: user.companyId,
      company: invite.company.name,
    },
  };
}

module.exports = { register, login, refreshTokens, logout, getMe, getInvite, acceptInvite };
