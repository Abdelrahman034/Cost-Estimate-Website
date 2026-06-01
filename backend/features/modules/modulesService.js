// features/modules/modulesService.js
//
// Generic CRUD for all isolated module tables.
// Routing to the correct table is handled by moduleRegistry — this file
// never changes when a new module is added.
//
// All operations are tenant-scoped: every call goes through
//   estimate → project → companyId
// so tenants can never touch each other's data.

const prisma           = require('../../prisma/client');
const { getModel }     = require('./moduleRegistry');

// ── Guard: verify estimate belongs to this project + company ──────────────────

async function assertEstimate(estimateId, projectId, companyId) {
  const estimate = await prisma.estimate.findFirst({
    where: {
      id:      estimateId,
      project: { id: projectId, companyId },
    },
  });
  if (!estimate) {
    const err = new Error('Estimate not found.');
    err.status = 404;
    throw err;
  }
  return estimate;
}

// ── List rows ─────────────────────────────────────────────────────────────────

async function listRows({ estimateId, projectId, companyId, moduleKey }) {
  await assertEstimate(estimateId, projectId, companyId);
  const model = getModel(moduleKey);

  return model.findMany({
    where:   { estimateId },
    orderBy: { sortOrder: 'asc' },
    take:    1000,
  });
}

// ── Get single row ────────────────────────────────────────────────────────────

async function getRow({ id, estimateId, projectId, companyId, moduleKey }) {
  await assertEstimate(estimateId, projectId, companyId);
  const model = getModel(moduleKey);

  const row = await model.findFirst({ where: { id, estimateId } });
  if (!row) {
    const err = new Error('Row not found.');
    err.status = 404;
    throw err;
  }
  return row;
}

// ── Create row ────────────────────────────────────────────────────────────────

async function createRow({ estimateId, projectId, companyId, moduleKey, data }) {
  await assertEstimate(estimateId, projectId, companyId);
  const model = getModel(moduleKey);

  const { sortOrder = 0, rowData, resultData, ...typed } = data;

  return model.create({
    data: {
      estimateId,
      sortOrder,
      rowData:    rowData    ?? {},
      resultData: resultData ?? null,
      ...typed,
    },
  });
}

// ── Update row ────────────────────────────────────────────────────────────────

async function updateRow({ id, estimateId, projectId, companyId, moduleKey, data }) {
  await assertEstimate(estimateId, projectId, companyId);
  const model = getModel(moduleKey);

  const existing = await model.findFirst({ where: { id, estimateId } });
  if (!existing) {
    const err = new Error('Row not found.');
    err.status = 404;
    throw err;
  }

  // Only update keys that were actually sent
  const payload = {};
  const allowedKeys = [
    'sortOrder', 'rowData', 'resultData',
    // shared typed columns
    'tag', 'qty', 'material', 'labor', 'hours', 'total',
    // module-specific typed columns — all optional, ignored if not present
    'unitType', 'tons', 'systemType',
    'ductSize', 'shape', 'lengthFt', 'surfaceAreaSqft', 'gauge', 'weightLb',
    'pipeSize', 'pipeType', 'wastePct',
    'vavType', 'cfm', 'hasReheat',
    'kw', 'volts',
    'fanType', 'hp',
    'itemType', 'width', 'height',
    'diffuserType', 'size',
    'description', 'moduleType', 'unit',
  ];
  for (const key of allowedKeys) {
    if (data[key] !== undefined) payload[key] = data[key];
  }

  return model.update({ where: { id }, data: payload });
}

// ── Delete row ────────────────────────────────────────────────────────────────

async function deleteRow({ id, estimateId, projectId, companyId, moduleKey }) {
  await assertEstimate(estimateId, projectId, companyId);
  const model = getModel(moduleKey);

  const existing = await model.findFirst({ where: { id, estimateId } });
  if (!existing) {
    const err = new Error('Row not found.');
    err.status = 404;
    throw err;
  }

  await model.delete({ where: { id } });
}

// ── Bulk replace (save entire module at once) ─────────────────────────────────
// Deletes all existing rows for this estimate+module and inserts fresh ones.
// Used when frontend sends the full row array on save.

async function bulkReplaceRows({ estimateId, projectId, companyId, moduleKey, rows }) {
  await assertEstimate(estimateId, projectId, companyId);
  const model = getModel(moduleKey);

  return prisma.$transaction(async (tx) => {
    // Use the transaction-scoped model
    const txModel = tx[_prismaModelName(moduleKey)];

    await txModel.deleteMany({ where: { estimateId } });

    if (!rows?.length) return [];

    const created = await Promise.all(
      rows.map((row, i) => {
        const { sortOrder = i, rowData, resultData, ...typed } = row;
        return txModel.create({
          data: {
            estimateId,
            sortOrder,
            rowData:    rowData    ?? {},
            resultData: resultData ?? null,
            ...typed,
          },
        });
      })
    );

    return created;
  });
}

// ── Helper: resolve Prisma model name for transaction delegate ────────────────

const MODEL_NAMES = {
  UNIT_SCHEDULE:     'unitScheduleItem',
  METAL_DUCT:        'metalDuctItem',
  VAV_SCHEDULE:      'vavItem',
  ELECTRIC_HEAT:     'electricHeatItem',
  FAN_SCHEDULE:      'fanItem',
  LOUVERS_DAMPERS:   'louverItem',
  DIFFUSER_SCHEDULE: 'diffuserItem',
  GENERAL_ITEMS:     'generalItem',
};

function _prismaModelName(moduleKey) {
  return MODEL_NAMES[moduleKey?.toUpperCase()];
}

module.exports = {
  listRows,
  getRow,
  createRow,
  updateRow,
  deleteRow,
  bulkReplaceRows,
};
