// features/projects/projectsService.js
//
// Business logic for Projects.
// Rule: no req/res here — pure data in, data out.
// All queries are scoped to companyId so one tenant can never see another's data.
//
// Access rules:
//   ADMIN     → sees ALL projects in the company
//   ESTIMATOR/VIEWER → sees only projects they created OR are a member of

const prisma = require('../../prisma/client');

// ── List Projects ─────────────────────────────────────────────────────────────

async function listProjects({ companyId, userId, role, status, page = 1, limit = 50 }) {
  const where = {
    companyId,
    ...(status ? { status } : {}),
  };

  // Non-admins: only projects they created or are a member of
  if (role !== 'ADMIN') {
    where.OR = [
      { createdById: userId },
      { members: { some: { userId } } },
    ];
  }

  const [projects, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      select: {
        id:          true,
        name:        true,
        location:    true,
        owner:       true,
        gc:          true,
        bidDate:     true,
        status:      true,
        notes:       true,
        createdAt:   true,
        updatedAt:   true,
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: { select: { estimates: true } },
      },
    }),
    prisma.project.count({ where }),
  ]);

  return {
    data:  projects,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// ── Get Single Project ────────────────────────────────────────────────────────

async function getProject({ id, companyId, userId, role }) {
  const membershipFilter = role !== 'ADMIN'
    ? { OR: [{ createdById: userId }, { members: { some: { userId } } }] }
    : {};

  const project = await prisma.project.findFirst({
    where: { id, companyId, ...membershipFilter },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      estimates: {
        orderBy: { createdAt: 'desc' },
        select:  { id: true, module: true, totalMaterial: true, totalLabor: true, totalCost: true, updatedAt: true },
      },
      members: {
        select: {
          id:         true,
          assignedAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
        orderBy: { assignedAt: 'asc' },
      },
      _count: { select: { estimates: true } },
    },
  });

  if (!project) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  return project;
}

// ── Create Project ────────────────────────────────────────────────────────────

async function createProject({ companyId, createdById, data }) {
  const { name, location, owner, gc, bidDate, notes,
          companyName, companyAddress, companyPhone, companyEmail } = data;

  const project = await prisma.project.create({
    data: {
      companyId,
      createdById,
      name,
      location:       location    || null,
      owner:          owner       || null,
      gc:             gc          || null,
      bidDate:        bidDate ? new Date(bidDate) : null,
      notes:          notes       || null,
      companyName:    companyName    || null,
      companyAddress: companyAddress || null,
      companyPhone:   companyPhone   || null,
      companyEmail:   companyEmail   || null,
    },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return project;
}

// ── Update Project ────────────────────────────────────────────────────────────

async function updateProject({ id, companyId, data }) {
  const existing = await prisma.project.findFirst({ where: { id, companyId } });
  if (!existing) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  const { name, location, owner, gc, bidDate, notes, status,
          companyName, companyAddress, companyPhone, companyEmail } = data;

  const updateData = {};
  if (name          !== undefined) updateData.name           = name;
  if (location      !== undefined) updateData.location       = location;
  if (owner         !== undefined) updateData.owner          = owner;
  if (gc            !== undefined) updateData.gc             = gc;
  if (bidDate       !== undefined) updateData.bidDate        = bidDate ? new Date(bidDate) : null;
  if (notes         !== undefined) updateData.notes          = notes;
  if (status        !== undefined) updateData.status         = status;
  if (companyName   !== undefined) updateData.companyName    = companyName;
  if (companyAddress!== undefined) updateData.companyAddress = companyAddress;
  if (companyPhone  !== undefined) updateData.companyPhone   = companyPhone;
  if (companyEmail  !== undefined) updateData.companyEmail   = companyEmail;

  const updated = await prisma.project.update({
    where: { id },
    data:  updateData,
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return updated;
}

// ── Delete Project ────────────────────────────────────────────────────────────

async function deleteProject({ id, companyId }) {
  const existing = await prisma.project.findFirst({ where: { id, companyId } });
  if (!existing) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  await prisma.project.delete({ where: { id } });
}

// ── List Members ──────────────────────────────────────────────────────────────

async function listMembers({ projectId, companyId }) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  return prisma.projectMember.findMany({
    where: { projectId },
    select: {
      id:         true,
      assignedAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
    },
    orderBy: { assignedAt: 'asc' },
  });
}

// ── Assign Member ─────────────────────────────────────────────────────────────

async function assignMember({ projectId, companyId, userId, assignedById }) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  const user = await prisma.user.findFirst({ where: { id: userId, companyId } });
  if (!user) {
    const err = new Error('User not found in this company.');
    err.status = 404;
    throw err;
  }

  const member = await prisma.projectMember.upsert({
    where:  { projectId_userId: { projectId, userId } },
    update: { assignedById },
    create: { projectId, userId, assignedById },
    select: {
      id:         true,
      assignedAt: true,
      user: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
    },
  });

  return member;
}

// ── Remove Member ─────────────────────────────────────────────────────────────

async function removeMember({ projectId, companyId, userId }) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!existing) {
    const err = new Error('Member not found on this project.');
    err.status = 404;
    throw err;
  }

  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId, userId } },
  });
}

// ── Project Settings Overrides ────────────────────────────────────────────────
// Estimators can override company-wide pricing/rates on a per-project basis.
// These overrides are stored on the Project row itself (settingsOverrides JSON).
// Company PricingConfig is NEVER modified by these functions.

async function getProjectSettingsOverrides({ id, companyId, userId, role }) {
  // Reuse getProject so access rules are enforced
  const project = await getProject({ id, companyId, userId, role });
  return project.settingsOverrides || {};
}

async function saveProjectSettingsOverrides({ id, companyId, userId, role, overrides }) {
  // Verify access first
  await getProject({ id, companyId, userId, role });

  // Only allow valid keys — mirrors PricingConfig fields
  const ALLOWED_KEYS = [
    'ratePackaged','rateSplit','rateWallMount','rateVrf','rateFan','rateDuct','ratePipe','rateElec',
    'overheadPct','profitPct','taxPct','ductWastePct','pipeWastePct',
    'copperSettings','accessoryPriceOverrides',
    'ductPrices','diffuserSettings','fanSettings','elecHeatSettings',
  ];
  const sanitized = {};
  for (const key of ALLOWED_KEYS) {
    if (overrides[key] !== undefined) sanitized[key] = overrides[key];
  }

  const updated = await prisma.project.update({
    where: { id },
    data:  { settingsOverrides: sanitized },
    select: { id: true, settingsOverrides: true },
  });
  return updated.settingsOverrides || {};
}

async function resetProjectSettingsOverrides({ id, companyId, userId, role }) {
  // Verify access first
  await getProject({ id, companyId, userId, role });

  await prisma.project.update({
    where: { id },
    data:  { settingsOverrides: null },
  });
}

module.exports = {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  listMembers,
  assignMember,
  removeMember,
  getProjectSettingsOverrides,
  saveProjectSettingsOverrides,
  resetProjectSettingsOverrides,
};
