// features/company/companyService.js

const prisma = require('../../prisma/client');
const crypto = require('node:crypto');

// ── Company Profile ───────────────────────────────────────────────────────────

async function getCompany({ companyId }) {
  const company = await prisma.company.findUnique({
    where:  { id: companyId },
    select: { id: true, name: true, address: true, phone: true, email: true,
              logoUrl: true, licenseNum: true, createdAt: true, updatedAt: true },
  });
  if (!company) { const e = new Error('Company not found.'); e.status = 404; throw e; }
  return company;
}

async function updateCompany({ companyId, data }) {
  const { name, address, phone, email, logoUrl, licenseNum } = data;
  const payload = {};
  if (name       !== undefined) payload.name       = name;
  if (address    !== undefined) payload.address    = address;
  if (phone      !== undefined) payload.phone      = phone;
  if (email      !== undefined) payload.email      = email;
  if (logoUrl    !== undefined) payload.logoUrl    = logoUrl;
  if (licenseNum !== undefined) payload.licenseNum = licenseNum;
  return prisma.company.update({ where: { id: companyId }, data: payload });
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function listUsers({ companyId }) {
  return prisma.user.findMany({
    where:   { companyId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isActive: true, lastLoginAt: true, createdAt: true,
    },
  });
}

async function updateUser({ id, companyId, data, requestorRole }) {
  const user = await prisma.user.findFirst({ where: { id, companyId } });
  if (!user) { const e = new Error('User not found.'); e.status = 404; throw e; }

  // Only ADMINs can change roles
  if (data.role !== undefined && requestorRole !== 'ADMIN') {
    const e = new Error('Only admins can change roles.'); e.status = 403; throw e;
  }

  const { firstName, lastName, role, isActive } = data;
  const payload = {};
  if (firstName !== undefined) payload.firstName = firstName;
  if (lastName  !== undefined) payload.lastName  = lastName;
  if (role      !== undefined) payload.role      = role;
  if (isActive  !== undefined) payload.isActive  = isActive;

  return prisma.user.update({
    where: { id },
    data:  payload,
    select: { id: true, email: true, firstName: true, lastName: true,
              role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
}

async function deleteUser({ id, companyId, requestorId }) {
  if (id === requestorId) {
    const e = new Error('You cannot delete your own account.'); e.status = 400; throw e;
  }
  const user = await prisma.user.findFirst({ where: { id, companyId } });
  if (!user) { const e = new Error('User not found.'); e.status = 404; throw e; }
  // Soft delete — deactivate instead of hard delete so estimates are preserved
  return prisma.user.update({
    where: { id },
    data:  { isActive: false },
    select: { id: true, email: true, isActive: true },
  });
}

// ── Invites ───────────────────────────────────────────────────────────────────

async function listInvites({ companyId }) {
  return prisma.invite.findMany({
    where:   { companyId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
  });
}

async function createInvite({ companyId, invitedById, data }) {
  const { email, role = 'ESTIMATOR' } = data;
  if (!email) { const e = new Error('email is required.'); e.status = 400; throw e; }

  // Check the email isn't already a user in this company
  const existing = await prisma.user.findFirst({ where: { companyId, email } });
  if (existing) {
    const e = new Error('A user with that email already exists in this company.'); e.status = 409; throw e;
  }

  // Expire any previous pending invites for this email
  await prisma.invite.updateMany({
    where: { companyId, email, status: 'PENDING' },
    data:  { status: 'REVOKED' },
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  return prisma.invite.create({
    data: {
      companyId,
      email,
      role,
      invitedById: invitedById || null,
      expiresAt,
      token: crypto.randomUUID(),
    },
    select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true, token: true },
  });
}

async function revokeInvite({ id, companyId }) {
  const invite = await prisma.invite.findFirst({ where: { id, companyId } });
  if (!invite) { const e = new Error('Invite not found.'); e.status = 404; throw e; }
  return prisma.invite.update({
    where: { id },
    data:  { status: 'REVOKED' },
    select: { id: true, email: true, status: true },
  });
}

module.exports = {
  getCompany, updateCompany,
  listUsers, updateUser, deleteUser,
  listInvites, createInvite, revokeInvite,
};
