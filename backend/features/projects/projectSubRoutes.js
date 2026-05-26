// features/projects/projectSubRoutes.js
//
// All three sub-resources in one router (mergeParams: true so :projectId flows through).

const router          = require('express').Router({ mergeParams: true });
const { requireAuth } = require('../../middleware/auth');
const svc             = require('./projectSubService');

router.use(requireAuth);

const ok   = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const ok201= (fn) => async (req, res) => { try { res.status(201).json(await fn(req)); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const ok204= (fn) => async (req, res) => { try { await fn(req); res.status(204).send(); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };

const pid = (req) => req.params.projectId;
const cid = (req) => req.user.companyId;
const uid = (req) => req.user.userId;

// ── Contacts ──────────────────────────────────────────────────────────────────
router.get   ('/contacts',       ok(   r => svc.listContacts({ projectId: pid(r), companyId: cid(r) })));
router.post  ('/contacts',       ok201(r => svc.createContact({ projectId: pid(r), companyId: cid(r), data: r.body })));
router.patch ('/contacts/:id',   ok(   r => svc.updateContact({ id: r.params.id, projectId: pid(r), companyId: cid(r), data: r.body })));
router.delete('/contacts/:id',   ok204(r => svc.deleteContact({ id: r.params.id, projectId: pid(r), companyId: cid(r) })));

// ── Changelog ─────────────────────────────────────────────────────────────────
router.get ('/changelog',  ok(   r => svc.listChangelog({ projectId: pid(r), companyId: cid(r), limit: r.query.limit ? parseInt(r.query.limit) : 50 })));
router.post('/changelog',  ok201(r => svc.addChangelogEntry({ projectId: pid(r), companyId: cid(r), userId: uid(r), data: r.body })));

// ── Reports ───────────────────────────────────────────────────────────────────
router.get   ('/reports',      ok(   r => svc.listReports({ projectId: pid(r), companyId: cid(r) })));
router.post  ('/reports',      ok201(r => svc.createReport({ projectId: pid(r), companyId: cid(r), data: r.body })));
router.delete('/reports/:id',  ok204(r => svc.deleteReport({ id: r.params.id, projectId: pid(r), companyId: cid(r) })));

module.exports = router;
