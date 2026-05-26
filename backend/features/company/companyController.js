// features/company/companyController.js

const svc = require('./companyService');

// Profile
const getCompany    = async (req, res) => { try { res.json(await svc.getCompany({ companyId: req.user.companyId })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const updateCompany = async (req, res) => { try { res.json(await svc.updateCompany({ companyId: req.user.companyId, data: req.body })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };

// Users
const listUsers   = async (req, res) => { try { res.json(await svc.listUsers({ companyId: req.user.companyId })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const updateUser  = async (req, res) => { try { res.json(await svc.updateUser({ id: req.params.id, companyId: req.user.companyId, data: req.body, requestorRole: req.user.role })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const deleteUser  = async (req, res) => { try { await svc.deleteUser({ id: req.params.id, companyId: req.user.companyId, requestorId: req.user.userId }); res.status(204).send(); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };

// Invites
const listInvites  = async (req, res) => { try { res.json(await svc.listInvites({ companyId: req.user.companyId })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const createInvite = async (req, res) => { try { res.status(201).json(await svc.createInvite({ companyId: req.user.companyId, invitedById: req.user.userId, data: req.body })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const revokeInvite = async (req, res) => { try { res.json(await svc.revokeInvite({ id: req.params.id, companyId: req.user.companyId })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };

module.exports = { getCompany, updateCompany, listUsers, updateUser, deleteUser, listInvites, createInvite, revokeInvite };
