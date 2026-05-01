import api from '@/services/api';

export const adminService = {
    // User Management - now returns { data, pagination }
    getUsers: (params = {}) => api.get('/admin/users', { params }),
    updateUserStatus: (userId, status, reason = '') =>
        api.patch(`/admin/users/${userId}/status`, { status, reason }),
    updateUserRole: (userId, role) =>
        api.patch(`/admin/users/${userId}/role`, { role }),
    updateUserStorageLimit: (userId, limitBytes) =>
        api.patch(`/admin/users/${userId}/storage-limit`, { limitBytes }),
    deleteUser: (id) => api.delete(`/admin/users/${id}`),

    // File Management - now returns { data, pagination }
    getFiles: (params = {}) => api.get('/admin/files', { params }),
    downloadFile: (id) => api.get(`/admin/files/${id}/download`, { responseType: 'blob' }),
    deleteFile: (id) => api.delete(`/admin/files/${id}`),

    // Settings Management
    getSettings: () => api.get('/admin/settings'),
    updateSettings: (settings) => api.put('/admin/settings', settings),
    cleanupStorage: () => api.post('/admin/storage/cleanup'),
    getQuotaImpact: (limitMb) => api.get('/admin/quota-impact', { params: { limitMb } }),

    // Logs - now returns { data, pagination }
    getLogs: (params = {}) => api.get('/admin/logs', { params }),

    // Alert Management - now returns { data, pagination }
    getAlerts: (params = {}) => api.get('/admin/alerts', { params }),
    getAlertStats: () => api.get('/admin/alerts/stats'),
    resolveAlert: (id) => api.patch(`/admin/alerts/${id}/resolve`),
    deleteAlert: (id) => api.delete(`/admin/alerts/${id}`)
};

export default adminService;
