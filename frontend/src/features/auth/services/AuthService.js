import api from '@/services/api';
import { resetAuthFailureGuard } from '@/utils/authFailureHandler';

export const authService = {
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        resetAuthFailureGuard();
        return response;
    },
    register: (userData) => api.post('/auth/register', userData),
    getMe: () => api.get('/auth/me'),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    validateResetToken: (token) => api.get(`/auth/reset-password/${token}`),
    resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
    verifyEmail: (otp) => api.post('/auth/verify-email', { otp }),
    resendVerification: () => api.post('/auth/resend-verification'),
};

export default authService;
