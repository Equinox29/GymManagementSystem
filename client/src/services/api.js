import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

// Clear the saved login and return to sign-in when the server rejects it.
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gym_token');
      localStorage.removeItem('gym_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const dashboardAPI = {
  getStats: () => api.get('/dashboard'),
};

export const membersAPI = {
  getAll: (params) => api.get('/members', { params }),
  getOne: (id) => api.get(`/members/${id}`),
  create: (data) => api.post('/members', data),
  update: (id, data) => api.put(`/members/${id}`, data),
  remove: (id) => api.delete(`/members/${id}`),
  createPortalInvite: (id) => api.post(`/members/${id}/portal-invite`),
  suspend: (id, data) => api.post(`/members/${id}/suspend`, data),
  clearSuspension: (id) => api.delete(`/members/${id}/suspension`),
};

export const plansAPI = {
  getAll: () => api.get('/plans'),
  create: (data) => api.post('/plans', data),
  update: (id, data) => api.put(`/plans/${id}`, data),
  remove: (id) => api.delete(`/plans/${id}`),
};

export const equipmentPlansAPI = {
  getAll: () => api.get('/equipment-plans'),
  create: (data) => api.post('/equipment-plans', data),
  update: (id, data) => api.put(`/equipment-plans/${id}`, data),
  remove: (id) => api.delete(`/equipment-plans/${id}`),
};

export const equipmentSubscriptionsAPI = {
  getAll: () => api.get('/equipment-subscriptions'),
  create: (data) => api.post('/equipment-subscriptions', data),
};

export const settingsAPI = {
  getAttendance: () => api.get('/settings/attendance'),
  updateAttendance: (data) => api.put('/settings/attendance', data),
};

export const membershipsAPI = {
  getAll: () => api.get('/memberships'),
  create: (data) => api.post('/memberships', data),
  update: (id, data) => api.put(`/memberships/${id}`, data),
};

export const paymentsAPI = {
  getAll: (params) => api.get('/payments', { params }),
  checkout: (data) => api.post('/payments/checkout', data),
  getPlanStatus: (memberId) => api.get(`/payments/member/${memberId}/plan-status`),
  refund: (id) => api.post(`/payments/${id}/refund`),
};

export const attendanceAPI = {
  getToday: (params) => api.get('/attendance', { params }),
  getTimeLimitAlerts: () => api.get('/attendance/alerts/time-limits'),
  reviewTimeLimitAlert: (id, data) => api.post(`/attendance/alerts/time-limits/${id}/review`, data),
  checkIn: (data) => api.post('/attendance/checkin', data),
  checkOut: (id) => api.put(`/attendance/${id}/checkout`),
  getMyVisit: () => api.get('/attendance/me'),
  checkInMyself: () => api.post('/attendance/me/checkin'),
  checkOutMyself: () => api.post('/attendance/me/checkout'),
};

export const memberPortalAPI = {
  getProfile: () => api.get('/member/me'),
  acknowledgeSuspensionNotice: () => api.post('/member/suspension-notice/acknowledge'),
  checkIn: () => api.post('/member/checkin'),
  checkOut: () => api.post('/member/checkout'),
};

export const inventoryAPI = {
  getAll: (params) => api.get('/inventory', { params }),
  getTransactions: (params) => api.get('/inventory/transactions', { params }),
  getSales: (params) => api.get('/inventory/sales', { params }),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  remove: (id) => api.delete(`/inventory/${id}`),
  restock: (id, data) => api.post(`/inventory/${id}/restock`, data),
  sell: (id, data) => api.post(`/inventory/${id}/sell`, data),
};

export const equipmentAPI = {
  getAll: (params) => api.get('/equipment', { params }),
  create: (data) => api.post('/equipment', data),
  update: (id, data) => api.put(`/equipment/${id}`, data),
  remove: (id) => api.delete(`/equipment/${id}`),
  addMaintenance: (id, data) => api.post(`/equipment/${id}/maintenance`, data),
  updateMaintenance: (id, logId, data) => api.put(`/equipment/${id}/maintenance/${logId}`, data),
};

export default api;
