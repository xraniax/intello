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
    deleteFile: (id) => api.delete(`/admin/files/${id}`),

    // Settings Management
    getSettings: () => api.get('/admin/settings'),
    updateSettings: (settings) => api.patch('/admin/settings', settings),
    cleanupStorage: () => api.post('/admin/storage/cleanup'),

    getLogs: () => api.get('/admin/logs')
};

export default adminService;
