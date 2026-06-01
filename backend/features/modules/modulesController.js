const sendError = require('../../middleware/sendError');
// features/modules/modulesController.js
//
// HTTP layer only — reads req, calls service, sends res.
// module key comes from URL param :module (e.g. "UNIT_SCHEDULE")

const service = require('./modulesService');
const { listModules } = require('./moduleRegistry');

// GET /api/projects/:projectId/estimates/:estimateId/rows/:module
async function list(req, res) {
  try {
    const rows = await service.listRows({
      estimateId: req.params.estimateId,
      projectId:  req.params.projectId,
      companyId:  req.user.companyId,
      moduleKey:  req.params.module,
    });
    res.json(rows);
  } catch (err) {
    sendError(res, err);
  }
}

// GET /api/projects/:projectId/estimates/:estimateId/rows/:module/:id
async function getOne(req, res) {
  try {
    const row = await service.getRow({
      id:         req.params.id,
      estimateId: req.params.estimateId,
      projectId:  req.params.projectId,
      companyId:  req.user.companyId,
      moduleKey:  req.params.module,
    });
    res.json(row);
  } catch (err) {
    sendError(res, err);
  }
}

// POST /api/projects/:projectId/estimates/:estimateId/rows/:module
async function create(req, res) {
  try {
    const row = await service.createRow({
      estimateId: req.params.estimateId,
      projectId:  req.params.projectId,
      companyId:  req.user.companyId,
      moduleKey:  req.params.module,
      data:       req.body,
    });
    res.status(201).json(row);
  } catch (err) {
    sendError(res, err);
  }
}

// PATCH /api/projects/:projectId/estimates/:estimateId/rows/:module/:id
async function update(req, res) {
  try {
    const row = await service.updateRow({
      id:         req.params.id,
      estimateId: req.params.estimateId,
      projectId:  req.params.projectId,
      companyId:  req.user.companyId,
      moduleKey:  req.params.module,
      data:       req.body,
    });
    res.json(row);
  } catch (err) {
    sendError(res, err);
  }
}

// DELETE /api/projects/:projectId/estimates/:estimateId/rows/:module/:id
async function remove(req, res) {
  try {
    await service.deleteRow({
      id:         req.params.id,
      estimateId: req.params.estimateId,
      projectId:  req.params.projectId,
      companyId:  req.user.companyId,
      moduleKey:  req.params.module,
    });
    res.status(204).send();
  } catch (err) {
    sendError(res, err);
  }
}

// PUT /api/projects/:projectId/estimates/:estimateId/rows/:module
// Bulk-replace: replaces ALL rows for this estimate+module atomically.
async function bulkReplace(req, res) {
  try {
    const rows = await service.bulkReplaceRows({
      estimateId: req.params.estimateId,
      projectId:  req.params.projectId,
      companyId:  req.user.companyId,
      moduleKey:  req.params.module,
      rows:       req.body.rows ?? req.body, // accept { rows: [...] } or bare array
    });
    res.json(rows);
  } catch (err) {
    sendError(res, err);
  }
}

// GET /api/modules  — list all registered module keys (useful for frontend)
async function listRegistered(req, res) {
  res.json({ modules: listModules() });
}

module.exports = { list, getOne, create, update, remove, bulkReplace, listRegistered };
