import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

// ─── PROJECTS (SQLite) ────────────────────────────────────────────────────────
export const projectsApi = {
  getAll:  ()           => api.get('/projects'),
  getById: (id)         => api.get(`/projects/${id}`),
  create:  (data)       => api.post('/projects', data),
  update:  (id, data)   => api.put(`/projects/${id}`, data),
  delete:  (id)         => api.delete(`/projects/${id}`),

  // Estimates
  saveEstimate: (projectId, module, rows, prices, totals) =>
    api.post(`/projects/${projectId}/estimates/${module}`, { rows, prices, totals }),
  loadEstimate: (projectId, module) =>
    api.get(`/projects/${projectId}/estimates/${module}`),
};

// ─── PRICES ───────────────────────────────────────────────────────────────────
export const pricesApi = {
  getCurrent: (refresh = false) => api.get(`/prices/current${refresh ? '?refresh=true' : ''}`),
  getDefaults: ()               => api.get('/prices/defaults'),
  getHistory:  ()               => api.get('/prices/history'),
};

// ─── DRAWINGS ─────────────────────────────────────────────────────────────────
export const drawingsApi = {
  analyze: (file, onProgress) => {
    const formData = new FormData();
    formData.append('drawing', file);
    return api.post('/drawings/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },
};

// ─── EMAILS ───────────────────────────────────────────────────────────────────
export const emailsApi = {
  generateRFQ: (units, projectInfo)           => api.post('/emails/generate-rfq', { units, projectInfo }),
  sendRFQ:     (units, projectInfo, suppliers) => api.post('/emails/send-rfq', { units, projectInfo, suppliers }),
};

// ─── PROPOSALS ────────────────────────────────────────────────────────────────
export const proposalsApi = {
  generate: (estimateData, projectInfo)                       => api.post('/proposals/generate', { estimateData, projectInfo }),
  send:     (estimateData, projectInfo, clientEmail, clientName) => api.post('/proposals/send', { estimateData, projectInfo, clientEmail, clientName }),
};

// ─── SUPPLIERS & RFQs ─────────────────────────────────────────────────────────
export const suppliersApi = {
  getAll:   ()          => api.get('/suppliers'),
  create:   (data)      => api.post('/suppliers', data),
  update:   (id, data)  => api.put(`/suppliers/${id}`, data),
  delete:   (id)        => api.delete(`/suppliers/${id}`),
};

export const rfqApi = {
  getAll:   (projectId) => api.get(`/suppliers/rfqs${projectId ? `?projectId=${projectId}` : ''}`),
  create:   (data)      => api.post('/suppliers/rfqs', data),
  update:   (id, data)  => api.put(`/suppliers/rfqs/${id}`, data),
  delete:   (id)        => api.delete(`/suppliers/rfqs/${id}`),

  getQuotes:   (rfqId)           => api.get(`/suppliers/rfqs/${rfqId}/quotes`),
  upsertQuote: (rfqId, supId, d) => api.put(`/suppliers/rfqs/${rfqId}/quotes/${supId}`, d),
};

export default api;
