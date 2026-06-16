// features/company/companyController.js

const svc = require('./companyService');

const wrap = (fn) => async (req, res) => { try { const r = await fn(req); res.json(r); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };

// Profile
const getCompany    = wrap(req => svc.getCompany({ companyId: req.user.companyId }));
const updateCompany = wrap(req => svc.updateCompany({ companyId: req.user.companyId, data: req.body }));

// Users
const listUsers  = wrap(req => svc.listUsers({ companyId: req.user.companyId }));
const updateUser = wrap(req => svc.updateUser({ id: req.params.id, companyId: req.user.companyId, data: req.body, requestorRole: req.user.role }));
const deleteUser = async (req, res) => { try { await svc.deleteUser({ id: req.params.id, companyId: req.user.companyId, requestorId: req.user.userId }); res.status(204).send(); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };

// Invites
const listInvites  = wrap(req => svc.listInvites({ companyId: req.user.companyId }));
const createInvite = async (req, res) => { try { res.status(201).json(await svc.createInvite({ companyId: req.user.companyId, invitedById: req.user.userId, data: req.body })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const revokeInvite = wrap(req => svc.revokeInvite({ id: req.params.id, companyId: req.user.companyId }));

// Custom Roles
const listCustomRoles  = wrap(req => svc.listCustomRoles({ companyId: req.user.companyId }));
const createCustomRole = async (req, res) => { try { res.status(201).json(await svc.createCustomRole({ companyId: req.user.companyId, data: req.body })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const updateCustomRole = wrap(req => svc.updateCustomRole({ id: req.params.id, companyId: req.user.companyId, data: req.body }));
const deleteCustomRole = async (req, res) => { try { await svc.deleteCustomRole({ id: req.params.id, companyId: req.user.companyId }); res.status(204).send(); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };

module.exports = {
  getCompany, updateCompany,
  listUsers, updateUser, deleteUser,
  listInvites, createInvite, revokeInvite,
  listCustomRoles, createCustomRole, updateCustomRole, deleteCustomRole,
};
