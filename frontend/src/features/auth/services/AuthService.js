import api from '@/services/api';

export const authService = {
    login: (email, password) => api.post('/auth/login', { email, password }),
    register: (userData) => api.post('/auth/register', userData),
    getMe: () => api.get('/auth/me'),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    validateResetToken: (token) => api.get(`/auth/reset-password/${token}`),
    resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};

export default authService;
