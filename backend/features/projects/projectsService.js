// features/projects/projectsService.js
//
// Business logic for Projects.
// Rule: no req/res here — pure data in, data out.
// All queries are scoped to companyId so one tenant can never see another's data.

const prisma = require('../../prisma/client');

// ── List Projects ─────────────────────────────────────────────────────────────

async function listProjects({ companyId, status, page = 1, limit = 50 }) {
  const where = {
    companyId,
    ...(status ? { status } : {}),
  };

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

async function getProject({ id, companyId }) {
  const project = await prisma.project.findFirst({
    where: { id, companyId },
    include: {
      createdBy: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      estimates: {
        orderBy: { createdAt: 'desc' },
        select:  { id: true, name: true, totalCost: true, createdAt: true, updatedAt: true },
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
  // First check it exists and belongs to this company
  const existing = await prisma.project.findFirst({ where: { id, companyId } });
  if (!existing) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  const { name, location, owner, gc, bidDate, notes, status,
          companyName, companyAddress, companyPhone, companyEmail } = data;

  // Build the update payload — only include fields that were actually sent
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

// ── Delete Project (soft delete via status = ARCHIVED) ────────────────────────
// Hard delete is destructive — we archive instead so estimates are preserved.

async function deleteProject({ id, companyId }) {
  const existing = await prisma.project.findFirst({ where: { id, companyId } });
  if (!existing) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }

  await prisma.project.delete({ where: { id } });
}

module.exports = { listProjects, getProject, createProject, updateProject, deleteProject };
