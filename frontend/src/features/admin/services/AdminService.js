import api from '@/services/api';

export const adminService = {
    getUsers: () => api.get('/admin/users'),
    updateUserStatus: (userId, status, reason = '') =>
        api.patch(`/admin/users/${userId}/status`, { status, reason }),
    updateUserRole: (userId, role) =>
        api.patch(`/admin/users/${userId}/role`, { role }),
    updateUserStorageLimit: (userId, limitBytes) =>
        api.patch(`/admin/users/${userId}/storage-limit`, { limitBytes }),
    deleteUser: (id) => api.delete(`/admin/users/${id}`),

    // File Management
    getFiles: (params) => api.get('/admin/files', { params }),
    downloadFile: (id) => api.get(`/admin/files/${id}/download`, { responseType: 'blob' }),
    deleteFile: (id) => api.delete(`/admin/files/${id}`),

    // Settings Management
    getSettings: () => api.get('/admin/settings'),
    updateSettings: (settings) => api.put('/admin/settings', settings),
    cleanupStorage: () => api.post('/admin/storage/cleanup'),
    getQuotaImpact: (limitMb) => api.get('/admin/quota-impact', { params: { limitMb } }),

    getLogs: () => api.get('/admin/logs'),

    // Alert Management
    getAlerts: (params) => api.get('/admin/alerts', { params }),
    getAlertStats: () => api.get('/admin/alerts/stats'),
    resolveAlert: (id) => api.patch(`/admin/alerts/${id}/resolve`),
    deleteAlert: (id) => api.delete(`/admin/alerts/${id}`)
};

export default adminService;
