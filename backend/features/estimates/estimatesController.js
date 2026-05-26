// features/estimates/estimatesController.js
//
// HTTP layer only — reads req, calls service, sends res.

const service = require('./estimatesService');

// GET /api/projects/:projectId/estimates
async function list(req, res) {
  try {
    const estimates = await service.listEstimates({
      projectId: req.params.projectId,
      companyId: req.user.companyId,
    });
    res.json(estimates);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// GET /api/projects/:projectId/estimates/:id
async function getOne(req, res) {
  try {
    const estimate = await service.getEstimate({
      id:        req.params.id,
      projectId: req.params.projectId,
      companyId: req.user.companyId,
    });
    res.json(estimate);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// GET /api/projects/:projectId/estimates/module/:module
// Returns null (200) when no estimate saved yet — not a 404
async function getByModule(req, res) {
  try {
    const estimate = await service.getEstimateByModule({
      projectId:  req.params.projectId,
      companyId:  req.user.companyId,
      module:     req.params.module,
      scenarioId: req.query.scenarioId || null,
    });
    res.json(estimate); // null means "not saved yet"
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// POST /api/projects/:projectId/estimates
// Creates or updates the estimate for a given module (upsert semantics)
async function upsert(req, res) {
  try {
    const estimate = await service.upsertEstimate({
      projectId: req.params.projectId,
      companyId: req.user.companyId,
      userId:    req.user.userId,
      data:      req.body,
    });
    res.status(200).json(estimate);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// DELETE /api/projects/:projectId/estimates/:id
async function remove(req, res) {
  try {
    await service.deleteEstimate({
      id:        req.params.id,
      projectId: req.params.projectId,
      companyId: req.user.companyId,
    });
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { list, getOne, getByModule, upsert, remove };
