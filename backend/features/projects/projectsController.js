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
      userId:    req.user.userId,
      role:      req.user.role,
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
      userId:    req.user.userId,
      role:      req.user.role,
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

// ── Member management (admin only) ────────────────────────────────────────────

// GET /api/projects/:id/members
async function getMembers(req, res) {
  try {
    const members = await service.listMembers({
      projectId: req.params.id,
      companyId: req.user.companyId,
    });
    res.json(members);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// POST /api/projects/:id/members   body: { userId }
async function addMember(req, res) {
  try {
    const member = await service.assignMember({
      projectId:   req.params.id,
      companyId:   req.user.companyId,
      userId:      req.body.userId,
      assignedById: req.user.userId,
    });
    res.status(201).json(member);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// DELETE /api/projects/:id/members/:userId
async function removeMember(req, res) {
  try {
    await service.removeMember({
      projectId: req.params.id,
      companyId: req.user.companyId,
      userId:    req.params.userId,
    });
    res.status(204).send();
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// ── Project Settings Overrides ────────────────────────────────────────────────
// Estimators save per-project overrides here. Company PricingConfig unchanged.

// GET /api/projects/:id/settings
async function getSettings(req, res) {
  try {
    const overrides = await service.getProjectSettingsOverrides({
      id:        req.params.id,
      companyId: req.user.companyId,
      userId:    req.user.userId,
      role:      req.user.role,
    });
    res.json({ overrides });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// PUT /api/projects/:id/settings   body: { overrides: {...} }
async function saveSettings(req, res) {
  try {
    const saved = await service.saveProjectSettingsOverrides({
      id:        req.params.id,
      companyId: req.user.companyId,
      userId:    req.user.userId,
      role:      req.user.role,
      overrides: req.body.overrides || req.body,
    });
    res.json({ overrides: saved });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

// DELETE /api/projects/:id/settings
async function resetSettings(req, res) {
  try {
    await service.resetProjectSettingsOverrides({
      id:        req.params.id,
      companyId: req.user.companyId,
      userId:    req.user.userId,
      role:      req.user.role,
    });
    res.json({ overrides: {} });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

module.exports = { list, getOne, create, update, remove, getMembers, addMember, removeMember, getSettings, saveSettings, resetSettings };
