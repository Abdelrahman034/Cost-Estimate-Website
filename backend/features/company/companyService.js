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
    take:    500,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, customRoleId: true, isActive: true, lastLoginAt: true, createdAt: true,
      customRole: { select: { id: true, name: true } },
    },
  });
}

async function updateUser({ id, companyId, data, requestorRole }) {
  const user = await prisma.user.findFirst({ where: { id, companyId } });
  if (!user) { const e = new Error('User not found.'); e.status = 404; throw e; }

  if ((data.role !== undefined || data.customRoleId !== undefined) && requestorRole !== 'OWNER') {
    const e = new Error('Only the owner can change roles.'); e.status = 403; throw e;
  }

  // Prevent demoting the last owner
  if (data.role !== 'OWNER' && user.role === 'OWNER') {
    const ownerCount = await prisma.user.count({ where: { companyId, role: 'OWNER', isActive: true } });
    if (ownerCount <= 1) {
      const e = new Error('Cannot remove the last owner.'); e.status = 400; throw e;
    }
  }

  const { firstName, lastName, role, customRoleId, isActive } = data;
  const payload = {};
  if (firstName    !== undefined) payload.firstName    = firstName;
  if (lastName     !== undefined) payload.lastName     = lastName;
  if (isActive     !== undefined) payload.isActive     = isActive;
  if (role         !== undefined) { payload.role = role || null; payload.customRoleId = null; }
  if (customRoleId !== undefined) { payload.customRoleId = customRoleId || null; payload.role = null; }

  return prisma.user.update({
    where: { id },
    data:  payload,
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, customRoleId: true, isActive: true, lastLoginAt: true, createdAt: true,
      customRole: { select: { id: true, name: true } },
    },
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
    take:    100,
    select:  {
      id: true, email: true, role: true, customRoleId: true, status: true, expiresAt: true, createdAt: true,
      customRole: { select: { id: true, name: true } },
    },
  });
}

async function createInvite({ companyId, invitedById, data }) {
  const { email, customRoleId } = data;
  if (!email) { const e = new Error('email is required.'); e.status = 400; throw e; }
  if (!customRoleId) { const e = new Error('customRoleId is required.'); e.status = 400; throw e; }

  // Verify the custom role belongs to this company
  const customRole = await prisma.customRole.findFirst({ where: { id: customRoleId, companyId } });
  if (!customRole) { const e = new Error('Role not found.'); e.status = 404; throw e; }

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
      role:         null,
      customRoleId,
      invitedById:  invitedById || null,
      expiresAt,
      token: crypto.randomUUID(),
    },
    select: {
      id: true, email: true, role: true, customRoleId: true, status: true,
      expiresAt: true, createdAt: true, token: true,
      customRole: { select: { id: true, name: true } },
    },
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

// ── Custom Roles ──────────────────────────────────────────────────────────────

async function listCustomRoles({ companyId }) {
  return prisma.customRole.findMany({
    where:   { companyId },
    orderBy: { createdAt: 'asc' },
    select:  { id: true, name: true, permissions: true, createdAt: true, updatedAt: true,
                _count: { select: { users: true } } },
  });
}

async function createCustomRole({ companyId, data }) {
  const { name, permissions = [] } = data;
  if (!name?.trim()) { const e = new Error('Role name is required.'); e.status = 400; throw e; }
  return prisma.customRole.create({
    data: { companyId, name: name.trim(), permissions },
    select: { id: true, name: true, permissions: true, createdAt: true, updatedAt: true },
  });
}

async function updateCustomRole({ id, companyId, data }) {
  const role = await prisma.customRole.findFirst({ where: { id, companyId } });
  if (!role) { const e = new Error('Role not found.'); e.status = 404; throw e; }
  const { name, permissions } = data;
  const payload = {};
  if (name        !== undefined) payload.name        = name.trim();
  if (permissions !== undefined) payload.permissions = permissions;
  return prisma.customRole.update({
    where: { id },
    data:  payload,
    select: { id: true, name: true, permissions: true, createdAt: true, updatedAt: true },
  });
}

async function deleteCustomRole({ id, companyId }) {
  const role = await prisma.customRole.findFirst({ where: { id, companyId } });
  if (!role) { const e = new Error('Role not found.'); e.status = 404; throw e; }
  // Users assigned to this role will have customRoleId set to null (SET NULL in DB)
  await prisma.customRole.delete({ where: { id } });
}

module.exports = {
  getCompany, updateCompany,
  listUsers, updateUser, deleteUser,
  listInvites, createInvite, revokeInvite,
  listCustomRoles, createCustomRole, updateCustomRole, deleteCustomRole,
};
