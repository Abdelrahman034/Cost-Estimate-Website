/**
 * Suppliers & RFQ routes
 *
 * GET    /api/suppliers              — list all suppliers
 * POST   /api/suppliers              — create supplier
 * PUT    /api/suppliers/:id          — update supplier
 * DELETE /api/suppliers/:id          — delete supplier
 *
 * GET    /api/suppliers/rfqs         — list all RFQs (optional ?projectId=)
 * POST   /api/suppliers/rfqs         — create RFQ
 * PUT    /api/suppliers/rfqs/:id     — update RFQ
 * DELETE /api/suppliers/rfqs/:id     — delete RFQ
 *
 * GET    /api/suppliers/rfqs/:rfqId/quotes          — quotes for an RFQ
 * PUT    /api/suppliers/rfqs/:rfqId/quotes/:supId   — upsert quote
 */
const express = require('express');
const router = express.Router();
const db = require('../services/data/dbService');

// ─── Suppliers ────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    res.json({ suppliers: db.suppliers.getAll() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const supplier = db.suppliers.create(req.body);
    res.status(201).json({ supplier });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const supplier = db.suppliers.update(Number(req.params.id), req.body);
    res.json({ supplier });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.suppliers.delete(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RFQs ─────────────────────────────────────────────────────────────────────
router.get('/rfqs', (req, res) => {
  try {
    const rfqs = db.rfqs.getAll(req.query.projectId ? Number(req.query.projectId) : undefined);
    res.json({ rfqs: rfqs.map(r => db.rfqs.parse(r)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rfqs', (req, res) => {
  try {
    const rfq = db.rfqs.create(req.body);
    res.status(201).json({ rfq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/rfqs/:id', (req, res) => {
  try {
    const rfq = db.rfqs.update(Number(req.params.id), req.body);
    res.json({ rfq });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/rfqs/:id', (req, res) => {
  try {
    db.rfqs.delete(Number(req.params.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Quotes ───────────────────────────────────────────────────────────────────
router.get('/rfqs/:rfqId/quotes', (req, res) => {
  try {
    const quotes = db.supplierQuotes.getByRfq(Number(req.params.rfqId));
    res.json({ quotes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/rfqs/:rfqId/quotes/:supId', (req, res) => {
  try {
    const quote = db.supplierQuotes.upsert(
      Number(req.params.rfqId),
      Number(req.params.supId),
      req.body
    );
    res.json({ quote });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
