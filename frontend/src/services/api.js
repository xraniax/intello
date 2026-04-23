import axios from 'axios';
import { handleAuthFailure } from '@/utils/authFailureHandler';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
export const BASE_URL = API_URL.replace(/\/api$/, '');

export const getAccessToken = () => localStorage.getItem('token');

export const buildAuthHeaders = (headers = {}) => {
    const token = getAccessToken();
    if (!token) return { ...headers };
    return {
        ...headers,
        Authorization: `Bearer ${token}`,
    };
};

export const authFetch = (url, options = {}) => {
    const mergedHeaders = buildAuthHeaders(options.headers || {});
    return fetch(url, {
        ...options,
        headers: mergedHeaders,
    });
};

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to add the JWT token to headers
api.interceptors.request.use(
    (config) => {
        config.headers = buildAuthHeaders(config.headers || {});
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
            handleAuthFailure();
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
