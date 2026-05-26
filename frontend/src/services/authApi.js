// services/authApi.js
// All HTTP calls to /api/auth/* endpoints.
// No business logic here — just network calls.

import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

export const authApi = {
  register:     (data)         => api.post('/auth/register', data),
  login:        (data)         => api.post('/auth/login', data),
  refresh:      (refreshToken) => api.post('/auth/refresh', { refreshToken }),
  logout:       (refreshToken) => api.post('/auth/logout', { refreshToken }),
  me:           (accessToken)  => api.get('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  }),
  // Invite flow (no auth token required — these are public endpoints)
  getInvite:    (token)        => api.get(`/auth/invite/${token}`),
  acceptInvite: (data)         => api.post('/auth/accept-invite', data),
};
