// features/scenarios/scenariosService.js
//
// Scenarios are named alternate versions of a project's estimates.
// e.g. "Base Bid", "Alternate 1 – VE Cut", "Aggressive Low Bid"
// Each scenario can have its own set of Estimates.

const prisma = require('../../prisma/client');

async function assertProject(projectId, companyId) {
  const p = await prisma.project.findFirst({ where: { id: projectId, companyId } });
  if (!p) { const e = new Error('Project not found.'); e.status = 404; throw e; }
  return p;
}

// ── List ──────────────────────────────────────────────────────────────────────

async function listScenarios({ projectId, companyId }) {
  await assertProject(projectId, companyId);
  return prisma.scenario.findMany({
    where:   { projectId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: {
      _count:    { select: { estimates: true } },
      estimates: {
        select: { module: true, totalCost: true, totalMaterial: true, totalLabor: true },
      },
    },
  });
}

// ── Get one ───────────────────────────────────────────────────────────────────

async function getScenario({ id, projectId, companyId }) {
  await assertProject(projectId, companyId);
  const s = await prisma.scenario.findFirst({
    where:   { id, projectId },
    include: {
      estimates: {
        orderBy: { module: 'asc' },
        select: { id: true, module: true, totalCost: true, totalMaterial: true,
                  totalLabor: true, totalHours: true, updatedAt: true },
      },
    },
  });
  if (!s) { const e = new Error('Scenario not found.'); e.status = 404; throw e; }
  return s;
}

// ── Create ────────────────────────────────────────────────────────────────────

async function createScenario({ projectId, companyId, data }) {
  await assertProject(projectId, companyId);
  const { name = 'Base Bid', isDefault = false } = data;

  // If making this the default, clear existing default first
  if (isDefault) {
    await prisma.scenario.updateMany({ where: { projectId, isDefault: true }, data: { isDefault: false } });
  }

  return prisma.scenario.create({
    data: { projectId, name, isDefault },
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

async function updateScenario({ id, projectId, companyId, data }) {
  await assertProject(projectId, companyId);
  const existing = await prisma.scenario.findFirst({ where: { id, projectId } });
  if (!existing) { const e = new Error('Scenario not found.'); e.status = 404; throw e; }

  const { name, isDefault } = data;
  const payload = {};
  if (name      !== undefined) payload.name      = name;
  if (isDefault !== undefined) payload.isDefault = isDefault;

  // Clear old default if promoting this one
  if (isDefault === true) {
    await prisma.scenario.updateMany({ where: { projectId, isDefault: true }, data: { isDefault: false } });
  }

  return prisma.scenario.update({ where: { id }, data: payload });
}

// ── Delete ────────────────────────────────────────────────────────────────────

async function deleteScenario({ id, projectId, companyId }) {
  await assertProject(projectId, companyId);
  const existing = await prisma.scenario.findFirst({ where: { id, projectId } });
  if (!existing) { const e = new Error('Scenario not found.'); e.status = 404; throw e; }
  if (existing.isDefault) { const e = new Error('Cannot delete the default scenario.'); e.status = 400; throw e; }
  await prisma.scenario.delete({ where: { id } });
}

module.exports = { listScenarios, getScenario, createScenario, updateScenario, deleteScenario };
