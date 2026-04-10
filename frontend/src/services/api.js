import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const BASE_URL = API_URL.replace(/\/api$/, '');

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

export default api;
