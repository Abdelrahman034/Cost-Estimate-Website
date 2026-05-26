// features/suppliers/suppliersController.js

const svc = require('./suppliersService');

// ── Suppliers ─────────────────────────────────────────────────────────────────

async function listSuppliers(req, res) {
  try { res.json(await svc.listSuppliers({ companyId: req.user.companyId })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function createSupplier(req, res) {
  try { res.status(201).json(await svc.createSupplier({ companyId: req.user.companyId, data: req.body })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function updateSupplier(req, res) {
  try { res.json(await svc.updateSupplier({ id: req.params.id, companyId: req.user.companyId, data: req.body })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function deleteSupplier(req, res) {
  try { await svc.deleteSupplier({ id: req.params.id, companyId: req.user.companyId }); res.status(204).send(); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

// ── RFQs ──────────────────────────────────────────────────────────────────────

async function listRfqs(req, res) {
  try { res.json(await svc.listRfqs({ companyId: req.user.companyId, projectId: req.query.projectId || null })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function createRfq(req, res) {
  try { res.status(201).json(await svc.createRfq({ companyId: req.user.companyId, data: req.body })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function updateRfq(req, res) {
  try { res.json(await svc.updateRfq({ id: req.params.id, companyId: req.user.companyId, data: req.body })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function deleteRfq(req, res) {
  try { await svc.deleteRfq({ id: req.params.id, companyId: req.user.companyId }); res.status(204).send(); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

// ── Quotes ────────────────────────────────────────────────────────────────────

async function listQuotes(req, res) {
  try { res.json(await svc.listQuotes({ rfqId: req.params.rfqId, companyId: req.user.companyId })); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

async function upsertQuote(req, res) {
  try {
    res.json(await svc.upsertQuote({
      rfqId: req.params.rfqId, supplierId: req.params.supplierId,
      companyId: req.user.companyId, data: req.body,
    }));
  }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
}

module.exports = {
  listSuppliers, createSupplier, updateSupplier, deleteSupplier,
  listRfqs, createRfq, updateRfq, deleteRfq,
  listQuotes, upsertQuote,
};
