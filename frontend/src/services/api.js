import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
});

// Attach the JWT access token to every request automatically.
// AuthContext writes it to sessionStorage on login/refresh.
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
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

// ─── PRICING CONFIG ───────────────────────────────────────────────────────────
export const pricingApi = {
  getConfig:  ()     => api.get('/pricing'),
  saveConfig: (data) => api.put('/pricing', data),
};

// ─── PROJECT SETTINGS OVERRIDES ──────────────────────────────────────────────
// Estimators can override company defaults for a specific project.
// These never touch PricingConfig — company settings stay intact.
export const projectSettingsApi = {
  /** Returns { overrides: {...} } — only keys the estimator overrode */
  get:   (projectId)           => api.get(`/projects/${projectId}/settings`),
  /** Saves overrides; body { overrides: {...} } */
  save:  (projectId, overrides) => api.put(`/projects/${projectId}/settings`, { overrides }),
  /** Clears all project overrides → falls back to company defaults */
  reset: (projectId)           => api.delete(`/projects/${projectId}/settings`),
};

// ─── COPPER PRICING ───────────────────────────────────────────────────────────
// Wires the backend copperPricingEngine to the frontend Unit Schedule.
// Inputs mirror the row's copper sub-object plus equipment context.
export const copperApi = {
  /**
   * Compute LME-adjusted copper line cost for a single unit row.
   * @param {object} params – { equipType, tonnage, isLongRun, lineSetType,
   *   lmePrice, copperType, safetyFactor, avgLengthFt, includeInsulation,
   *   indoorUnits, vrfBlendedTonnage, copperFractionOverride }
   */
  calc: (params) => api.post('/copper-pricing', params),

  /** Per-size VRV table at the given LME. */
  vrvPerSize: (params) => api.post('/copper-pricing/vrv-per-size', params),

  /** Active reference data: pipe sizes, weights, baseline prices (DB-aware). */
  getTables: () => api.get('/copper-pricing/tables'),

  // ── Admin reference-data endpoints ──────────────────────────────────────
  /** Get all pipe specs from DB (with hardcoded fallback). */
  getPipeSpecs: () => api.get('/copper-pricing/specs'),

  /** Admin: update a single pipe spec by DB id. */
  updatePipeSpec: (id, data) => api.put(`/copper-pricing/specs/${id}`, data),

  /** Get all equipment configs from DB. */
  getEquipmentConfigs: () => api.get('/copper-pricing/equipment-configs'),

  /** Admin: update a single equipment config by DB id. */
  updateEquipmentConfig: (id, data) => api.put(`/copper-pricing/equipment-configs/${id}`, data),

  /** Admin: restore all calibrated defaults (Grainger $4.25/lb baseline). */
  restoreDefaults: () => api.post('/copper-pricing/restore-defaults'),
};

// ─── ANALYTICS ───────────────────────────────────────────────────────────────
export const analyticsApi = {
  get: () => api.get('/analytics'),
};

export default api;
