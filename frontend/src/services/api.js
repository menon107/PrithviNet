import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api/v1';

const api = axios.create({ baseURL: BASE_URL, timeout: 15000 });

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/auth/signup', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
  createUser: (data) => api.post('/auth/create-user', data),
};

// ── Regions ─────────────────────────────────────
export const regionsAPI = {
  getAll: (params) => api.get('/regions', { params }),
  getById: (id) => api.get(`/regions/${id}`),
  getDashboard: (id) => api.get(`/regions/${id}/dashboard`),
  create: (data) => api.post('/regions', data),
  update: (id, data) => api.put(`/regions/${id}`, data),
};

// ── Industries ───────────────────────────────────
export const industriesAPI = {
  getAll: (params) => api.get('/industries', { params }),
  getById: (id) => api.get(`/industries/${id}`),
  getStats: (id) => api.get(`/industries/${id}/stats`),
  getTopPolluters: (params) => api.get('/industries/top-polluters', { params }),
  getWithWaterData: (params) => api.get('/industries/with-water-data', { params }),
  create: (data) => api.post('/industries', data),
  update: (id, data) => api.put(`/industries/${id}`, data),
  getPending: (params) => api.get('/industries/pending', { params }),
  approve: (id) => api.patch(`/industries/${id}/approve`),
  reject: (id) => api.patch(`/industries/${id}/reject`),
  delete: (id) => api.delete(`/industries/${id}`),
};

// ── Reports ──────────────────────────────────────
export const reportsAPI = {
  submit: (data) => api.post('/reports', data),
  submitPeriod: (data) => api.post('/reports/period', data),
  getAll: (params) => api.get('/reports', { params }),
  getById: (id) => api.get(`/reports/${id}`),
  getByIndustry: (id, params) => api.get(`/reports/industry/${id}`, { params }),
  getByRegion: (regionId, params) => api.get(`/reports/region/${regionId}`, { params }),
  getMissing: (params) => api.get('/reports/missing', { params }),
  review: (id, data) => api.put(`/reports/${id}/review`, data),
  getInsights: (id) => api.get(`/reports/${id}/insights`),
};

// ── Pollution ─────────────────────────────────────
export const pollutionAPI = {
  getAir: (params) => api.get('/pollution/air', { params }),
  getWater: (params) => api.get('/pollution/water', { params }),
  getNoise: (params) => api.get('/pollution/noise', { params }),
  getMap: (params) => api.get('/pollution/map', { params }),
  getSummary: (params) => api.get('/pollution/summary', { params }),
  getExternal: (params) => api.get('/pollution/external', { params }),
  getAttribution: (params) => api.get('/pollution/attribution', { params }),
};

// ── AI / Simulation ───────────────────────────────
export const aiAPI = {
  runSimulation: (data) => api.post('/ai/simulation/run', data),
  getSimulation: (id) => api.get(`/ai/simulation/${id}`),
  getSimulations: (params) => api.get('/ai/simulation', { params }),
  getAirForecast: (params) => api.get('/ai/forecast/air', { params }),
  getAttribution: (params) => api.get('/ai/attribution', { params }),
  getComplianceRisk: (params) => api.get('/ai/compliance-risk', { params }),
  getInspectionOptimization: (params) => api.get('/ai/inspection-optimization', { params }),
};

// ── Forecast (from forecast collection, shown in alerts section) ──
export const forecastAPI = {
  getAll: (params) => api.get('/forecast', { params }),
};

// ── Alerts ────────────────────────────────────────
export const alertsAPI = {
  getAll: (params) => api.get('/alerts', { params }),
  getStats: () => api.get('/alerts/stats'),
  markRead: (id) => api.put(`/alerts/${id}/read`),
  markAllRead: () => api.put('/alerts/read-all'),
  resolve: (id) => api.put(`/alerts/${id}/resolve`),
};

// ── Warnings (officer → industry) ─────────────────
export const warningsAPI = {
  create: (data) => api.post('/warnings', data),
  getAll: (params) => api.get('/warnings', { params }),
  getByIndustry: (industryId) => api.get(`/warnings/industry/${industryId}`),
  markRead: (id) => api.patch(`/warnings/${id}/read`),
};

// ── Complaints ────────────────────────────────────
export const complaintsAPI = {
  submit: (data) => api.post('/complaints', data),
  getAll: (params) => api.get('/complaints', { params }),
  updateStatus: (id, data) => api.put(`/complaints/${id}/status`, data),
};

// ── Notices ────────────────────────────────────────
export const noticesAPI = {
  getAll: (params) => api.get('/notices', { params }),
  getById: (id) => api.get(`/notices/${id}`),
  create: (data) => api.post('/notices', data),
  addComment: (id, data) => api.post(`/notices/${id}/comments`, data),
};

export default api;
