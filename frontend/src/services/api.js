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
    (error) => {
        return Promise.reject(error);
    }
);

export const authService = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    register: (userData) => api.post('/auth/register', userData),
    getMe: () => api.get('/auth/me'),
};

export const materialService = {
    upload: (data) => api.post('/materials/upload', data),
    getHistory: () => api.get('/materials/history'),
    generate: (id, taskType) => api.post(`/materials/${id}/generate`, { taskType }),
};

export const subjectService = {
    getAll: () => api.get('/subjects'),
    getOne: (id) => api.get(`/subjects/${id}`),
    create: (name, description) => api.post('/subjects', { name, description }),
    rename: (id, name) => api.patch(`/subjects/${id}`, { name }),
    delete: (id) => api.delete(`/subjects/${id}`),
};

export default api;
