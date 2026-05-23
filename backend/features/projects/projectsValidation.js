// features/projects/projectsValidation.js
//
// Input validation middleware for project routes.
// Keeps controllers clean — they only deal with valid, sanitised data.

// ── Create Project ────────────────────────────────────────────────────────────

function validateCreateProject(req, res, next) {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  if (name.trim().length > 200) {
    return res.status(400).json({ error: 'Project name must be 200 characters or fewer.' });
  }

  // Sanitise in place so the controller/service gets clean values
  req.body.name = name.trim();

  if (req.body.location)    req.body.location    = req.body.location.trim();
  if (req.body.owner)       req.body.owner        = req.body.owner.trim();
  if (req.body.gc)          req.body.gc           = req.body.gc.trim();
  if (req.body.notes)       req.body.notes        = req.body.notes.trim();

  next();
}

// ── Update Project ────────────────────────────────────────────────────────────

const ALLOWED_STATUSES = ['ACTIVE', 'ARCHIVED', 'WON', 'LOST'];

function validateUpdateProject(req, res, next) {
  const { name, status } = req.body;

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Project name cannot be empty.' });
    }
    if (name.trim().length > 200) {
      return res.status(400).json({ error: 'Project name must be 200 characters or fewer.' });
    }
    req.body.name = name.trim();
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${ALLOWED_STATUSES.join(', ')}.`,
    });
  }

  if (req.body.location !== undefined) req.body.location = req.body.location?.trim() ?? null;
  if (req.body.owner    !== undefined) req.body.owner     = req.body.owner?.trim()    ?? null;
  if (req.body.gc       !== undefined) req.body.gc        = req.body.gc?.trim()       ?? null;
  if (req.body.notes    !== undefined) req.body.notes     = req.body.notes?.trim()    ?? null;

  next();
}

module.exports = { validateCreateProject, validateUpdateProject };
