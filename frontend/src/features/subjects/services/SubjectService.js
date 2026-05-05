import api from '@/services/api';

export const subjectService = {
    // Subject Management - now supports pagination params
    getAll: (params = {}) => api.get('/subjects', { params }),
    getOne: (id) => api.get(`/subjects/${id}`),
    create: (name, description) => api.post('/subjects', { name, description }),
    update: (id, name, description) => api.patch(`/subjects/${id}`, { name, description }),
    delete: (id) => api.delete(`/subjects/${id}`),
    getTrash: (params = {}) => api.get('/subjects/trash', { params }),
    restore: (id) => api.post(`/subjects/${id}/restore`),
    permanentDelete: (id) => api.delete(`/subjects/${id}/permanent`),
};

export default subjectService;
