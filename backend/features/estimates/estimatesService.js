// features/estimates/estimatesService.js
//
// Business logic for Estimates.
// All queries are scoped through the parent project (companyId) so tenants
// can never touch each other's data.

const prisma = require('../../prisma/client');

// ── Guard: verify the project exists and belongs to this company ──────────────

async function assertProject(projectId, companyId) {
  const project = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!project) {
    const err = new Error('Project not found.');
    err.status = 404;
    throw err;
  }
  return project;
}

// ── List Estimates for a project ──────────────────────────────────────────────

async function listEstimates({ projectId, companyId }) {
  await assertProject(projectId, companyId);

  const estimates = await prisma.estimate.findMany({
    where:   { projectId },
    orderBy: { module: 'asc' },
    select: {
      id:            true,
      module:        true,
      totalMaterial: true,
      totalLabor:    true,
      totalHours:    true,
      totalCost:     true,
      settings:      true,
      createdAt:     true,
      updatedAt:     true,
      createdBy: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  return estimates;
}

// ── Get a single estimate (with all rows) ─────────────────────────────────────

async function getEstimate({ id, projectId, companyId }) {
  await assertProject(projectId, companyId);

  const estimate = await prisma.estimate.findFirst({
    where:   { id, projectId },
    include: { rows: { orderBy: { sortOrder: 'asc' } } },
  });

  if (!estimate) {
    const err = new Error('Estimate not found.');
    err.status = 404;
    throw err;
  }

  return estimate;
}

// ── Get estimate by module (for frontend module load) ─────────────────────────

async function getEstimateByModule({ projectId, companyId, module, scenarioId = null }) {
  await assertProject(projectId, companyId);

  const estimate = await prisma.estimate.findFirst({
    where: { projectId, module, scenarioId },
    include: { rows: { orderBy: { sortOrder: 'asc' } } },
  });

  // Return null (not 404) when no estimate saved yet — caller decides
  return estimate ?? null;
}

// ── Upsert estimate by module (primary save from frontend modules) ────────────
//
// Uses findFirst + update/create because upsert with a nullable unique key
// field (scenarioId) is unreliable across databases.

async function upsertEstimate({ projectId, companyId, userId, data }) {
  await assertProject(projectId, companyId);

  const {
    module,
    scenarioId      = null,
    settings,
    rowsJson,
    pricesJson,
    totalsJson,
    totalMaterial,
    totalLabor,
    totalHours,
    totalCost,
  } = data;

  const existing = await prisma.estimate.findFirst({
    where: { projectId, scenarioId, module },
  });

  // Build only the fields that were actually sent (undefined = don't touch)
  const payload = {};
  if (settings      !== undefined) payload.settings      = settings;
  if (rowsJson      !== undefined) payload.rowsJson      = rowsJson;
  if (pricesJson    !== undefined) payload.pricesJson    = pricesJson;
  if (totalsJson    !== undefined) payload.totalsJson    = totalsJson;
  if (totalMaterial !== undefined) payload.totalMaterial = totalMaterial ?? null;
  if (totalLabor    !== undefined) payload.totalLabor    = totalLabor    ?? null;
  if (totalHours    !== undefined) payload.totalHours    = totalHours    ?? null;
  if (totalCost     !== undefined) payload.totalCost     = totalCost     ?? null;

  if (existing) {
    return prisma.estimate.update({
      where: { id: existing.id },
      data:  payload,
    });
  }

  return prisma.estimate.create({
    data: {
      projectId,
      scenarioId,
      createdById:   userId,
      module,
      settings:      settings      ?? {},
      rowsJson:      rowsJson      ?? null,
      pricesJson:    pricesJson    ?? null,
      totalsJson:    totalsJson    ?? null,
      totalMaterial: totalMaterial ?? null,
      totalLabor:    totalLabor    ?? null,
      totalHours:    totalHours    ?? null,
      totalCost:     totalCost     ?? null,
    },
  });
}

// ── Delete an estimate ────────────────────────────────────────────────────────

async function deleteEstimate({ id, projectId, companyId }) {
  await assertProject(projectId, companyId);

  const existing = await prisma.estimate.findFirst({ where: { id, projectId } });
  if (!existing) {
    const err = new Error('Estimate not found.');
    err.status = 404;
    throw err;
  }

  await prisma.estimate.delete({ where: { id } });
}

module.exports = {
  listEstimates,
  getEstimate,
  getEstimateByModule,
  upsertEstimate,
  deleteEstimate,
};
