const express = require('express');
const router  = express.Router();
const { projects, estimates } = require('../services');

// GET /api/projects — list all
router.get('/', (req, res) => {
  try {
    res.json(projects.getAll());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id — single project with all estimates
router.get('/:id', (req, res) => {
  try {
    const project = projects.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const rawEstimates = estimates.getByProject(req.params.id);
    const parsed = rawEstimates.map(estimates.parse);
    res.json({ ...project, estimates: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects — create
router.post('/', (req, res) => {
  try {
    const project = projects.create(req.body);
    res.status(201).json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id — update project info
router.put('/:id', (req, res) => {
  try {
    const updated = projects.update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Project not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  try {
    projects.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/estimates/:module — save/update estimate rows
router.post('/:id/estimates/:module', (req, res) => {
  try {
    const { rows = [], prices = {}, totals = {} } = req.body;
    const result = estimates.upsert(req.params.id, req.params.module, rows, prices, totals);
    res.json({ success: true, estimate: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/estimates/:module — load estimate
router.get('/:id/estimates/:module', (req, res) => {
  try {
    const raw = estimates.getByProjectAndModule(req.params.id, req.params.module);
    res.json(estimates.parse(raw) || { rows: [], prices: {}, totals: {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
