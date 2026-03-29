import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to add the JWT token to headers
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Add a response interceptor to normalize errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Handle 401 Unauthorized errors (expired or invalid token)
        if (error.response?.status === 401) {
            const hadToken = !!localStorage.getItem('token');
            if (hadToken) {
                // Clear the token and redirect to login
                localStorage.removeItem('token');
                // Use window.location to redirect as we are outside React component context
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login?expired=true';
                }
            }
        }

        // Build a standardized error object
        const customError = new Error(
            error.response?.data?.message || error.message || 'An unexpected error occurred'
        );
        customError.code = error.response?.data?.code || 'NETWORK_ERROR';
        customError.status = error.response?.status;
        customError.validationErrors = error.response?.data?.errors || {}; // For Zod flat errors

        return Promise.reject(customError);
    }
);

export const authService = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    register: (userData) => api.post('/auth/register', userData),
    getMe: () => api.get('/auth/me'),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    validateResetToken: (token) => api.get(`/auth/reset-password/${token}`),
    resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};

export const materialService = {
    getSettings: () => api.get('/materials/settings'),
    upload: (data) => {
        // Data can be FormData (with file) or plain object (text-only)
        const config = data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        return api.post('/materials/upload', data, config);
    },
    getHistory: () => api.get('/materials/history'),
    chatCombined: (materialIds, question) => api.post('/materials/chat-combined', { materialIds, question }),
    generateCombined: (materialIds, taskType) => api.post('/materials/generate-combined', { materialIds, taskType }),
    delete: (id) => api.delete(`/materials/${id}`),
    sync: (id) => api.get(`/materials/${id}/sync`),
    cancel: (id) => api.post(`/materials/${id}/cancel`),
};

export const subjectService = {
    getAll: () => api.get('/subjects'),
    getOne: (id) => api.get(`/subjects/${id}`),
    create: (name, description) => api.post('/subjects', { name, description }),
    rename: (id, name) => api.patch(`/subjects/${id}`, { name }),
    delete: (id) => api.delete(`/subjects/${id}`)
};

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

export const profileService = {
    getProfile: () => api.get('/profile'),
    updateProfile: (data) => api.put('/profile', data),
};

export default api;
