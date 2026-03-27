import { create } from 'zustand';
import { authService } from '../services/api';

export const useAuthStore = create((set, get) => ({
    user: null,
    loading: true,
    error: null,
    isInitialized: false,

    setUser: (user) => set({ user, isLoggedIn: !!user }),

    loadUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            set({ loading: false, isInitialized: true });
            return;
        }

        try {
            const res = await authService.getMe();
            set({ user: res.data.data, loading: false, isInitialized: true });
        } catch (err) {
            console.error('Auth check failed:', err);
            localStorage.removeItem('token');
            set({ user: null, loading: false, isInitialized: true });
        }
    },

    login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            const res = await authService.login(email, password);
            const { token, ...userData } = res.data.data;
            localStorage.setItem('token', token);
            set({ user: userData, loading: false });
            return res.data;
        } catch (err) {
            const message = err.message || 'Login failed';
            set({ error: message, loading: false });
            throw err;
        }
    },

    register: async (userData) => {
        set({ loading: true, error: null });
        try {
            const res = await authService.register(userData);
            const { token, ...data } = res.data.data;
            localStorage.setItem('token', token);
            set({ user: data, loading: false });
            return res.data;
        } catch (err) {
            set({ error: err.message, loading: false });
            throw err;
        }
    },

    logout: () => {
        localStorage.removeItem('token');
        set({ user: null });
    }
}));
