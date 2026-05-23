// features/projects/projectsController.js
//
// HTTP layer only — reads req, calls service, sends res.
// No business logic lives here.

const service = require('./projectsService');

// GET /api/projects
async function list(req, res) {
  try {
    const { status, page, limit } = req.query;
    const result = await service.listProjects({
      companyId: req.user.companyId,
      status,
      page:  page  ? parseInt(page,  10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// GET /api/projects/:id
async function getOne(req, res) {
  try {
    const project = await service.getProject({
      id:        req.params.id,
      companyId: req.user.companyId,
    });
    res.json(project);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// POST /api/projects
async function create(req, res) {
  try {
    const project = await service.createProject({
      companyId:   req.user.companyId,
      createdById: req.user.userId,
      data:        req.body,
    });
    res.status(201).json(project);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// PATCH /api/projects/:id
async function update(req, res) {
  try {
    const project = await service.updateProject({
      id:        req.params.id,
      companyId: req.user.companyId,
      data:      req.body,
    });
    res.json(project);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// DELETE /api/projects/:id
async function remove(req, res) {
  try {
    await service.deleteProject({
      id:        req.params.id,
      companyId: req.user.companyId,
    });
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { list, getOne, create, update, remove };
