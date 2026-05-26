// features/scenarios/scenariosController.js

const svc = require('./scenariosService');

const list   = async (req, res) => { try { res.json(await svc.listScenarios({ projectId: req.params.projectId, companyId: req.user.companyId })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const getOne = async (req, res) => { try { res.json(await svc.getScenario({ id: req.params.id, projectId: req.params.projectId, companyId: req.user.companyId })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const create = async (req, res) => { try { res.status(201).json(await svc.createScenario({ projectId: req.params.projectId, companyId: req.user.companyId, data: req.body })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const update = async (req, res) => { try { res.json(await svc.updateScenario({ id: req.params.id, projectId: req.params.projectId, companyId: req.user.companyId, data: req.body })); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };
const remove = async (req, res) => { try { await svc.deleteScenario({ id: req.params.id, projectId: req.params.projectId, companyId: req.user.companyId }); res.status(204).send(); } catch (e) { res.status(e.status||500).json({ error: e.message }); } };

module.exports = { list, getOne, create, update, remove };
