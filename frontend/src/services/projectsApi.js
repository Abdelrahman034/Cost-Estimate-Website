// services/projectsApi.js
//
// All HTTP calls for the Projects feature.
// The axios instance in api.js already attaches the Authorization header
// via the request interceptor (reads from sessionStorage), so we just call it.

import api from './api';

export const projectsApi = {
  // List projects — optional ?status= and ?page= query params
  list: (params = {}) =>
    api.get('/projects', { params }).then(r => r.data),

  // Get a single project (includes its estimates)
  get: (id) =>
    api.get(`/projects/${id}`).then(r => r.data),

  // Create a new project
  create: (data) =>
    api.post('/projects', data).then(r => r.data),

  // Partial update — send only the fields you want to change
  update: (id, data) =>
    api.patch(`/projects/${id}`, data).then(r => r.data),

  // Delete a project
  remove: (id) =>
    api.delete(`/projects/${id}`),

  // ── Member management (admin only) ──────────────────────────────────────────
  listMembers:  (projectId)           => api.get(`/projects/${projectId}/members`).then(r => r.data),
  addMember:    (projectId, userId)   => api.post(`/projects/${projectId}/members`, { userId }).then(r => r.data),
  removeMember: (projectId, userId)   => api.delete(`/projects/${projectId}/members/${userId}`),
};
