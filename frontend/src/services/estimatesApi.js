// services/estimatesApi.js
//
// All HTTP calls for the Estimates feature.
// Estimates are always scoped under a parent project.

import api from './api';

export const estimatesApi = {
  // List all saved module estimates for a project (summary rows — no row data)
  list: (projectId) =>
    api.get(`/projects/${projectId}/estimates`).then(r => r.data),

  // Get a single estimate by id (includes all EstimateRows)
  get: (projectId, id) =>
    api.get(`/projects/${projectId}/estimates/${id}`).then(r => r.data),

  // Get an estimate by module type — returns null when not saved yet
  getByModule: (projectId, module, scenarioId = null) => {
    const params = scenarioId ? { scenarioId } : {};
    return api
      .get(`/projects/${projectId}/estimates/module/${module}`, { params })
      .then(r => r.data);
  },

  // Create-or-update the estimate for a module (upsert)
  // data = { module, rowsJson?, pricesJson?, totalsJson?, totalMaterial?, totalLabor?, totalHours?, totalCost?, settings? }
  save: (projectId, data) =>
    api.post(`/projects/${projectId}/estimates`, data).then(r => r.data),

  // Hard-delete an estimate (removes all saved rows)
  delete: (projectId, id) =>
    api.delete(`/projects/${projectId}/estimates/${id}`),
};
