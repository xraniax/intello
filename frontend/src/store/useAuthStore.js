import { create } from 'zustand';
import { authService } from '@/features/auth/services/AuthService';
import { profileService } from '@/features/user/services/ProfileService';
import { useUIStore } from './useUIStore';
import toast from 'react-hot-toast';

export const useAuthStore = create((set) => ({
    data: {
        user: null,
        isInitialized: false
    },
    error: null,
    actions: {
        setUser: (user) =>
            set((state) => ({
                ...state,
                data: { ...state.data, user }
            })),

        clearError: () => set({ error: null }),

        loadUser: async () => {
            const uiActions = useUIStore.getState().actions;
            const token = localStorage.getItem('token');
            if (!token) {
                set((state) => ({
                    ...state,
                    error: null,
                    data: { ...state.data, user: null, isInitialized: true }
                }));
                return null;
            }

            uiActions.setLoading('auth', true, 'Checking your session...', true);
            set({ error: null });
            try {
                const res = await authService.getMe();
                const user = res.data.data;
                set((state) => ({
                    ...state,
                    error: null,
                    data: { ...state.data, user, isInitialized: true }
                }));
                return user;
            } catch (err) {
                localStorage.removeItem('token');
                set((state) => ({
                    ...state,
                    error: err.message || 'Auth check failed',
                    data: { ...state.data, user: null, isInitialized: true }
                }));
                throw err;
            } finally {
                uiActions.setLoading('auth', false);
            }
        },
        login: async (email, password) => {
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('auth', true, 'Signing you in...', false); // Non-blocking
            uiActions.clearError('auth');
            set({ error: null });
            try {
                const res = await authService.login(email, password);
                const { token, ...userData } = res.data.data;
                localStorage.setItem('token', token);
                set((state) => ({
                    ...state,
                    error: null,
                    data: { ...state.data, user: userData, isInitialized: true }
                }));
                toast.success('Welcome back!');
                return res.data;
            } catch (err) {
                const message = err.message || 'Login failed';
                const fieldErrors = err.validationErrors || {};
                set({ error: message });
                uiActions.setError('auth', message);
                throw { message, fieldErrors };
            } finally {
                uiActions.setLoading('auth', false);
            }
        },

        register: async (userData) => {
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('auth', true, 'Creating your account...', false); // Non-blocking
            uiActions.clearError('auth');
            set({ error: null });
            try {
                const res = await authService.register(userData);
                const { token, ...user } = res.data.data;
                localStorage.setItem('token', token);
                set((state) => ({
                    ...state,
                    error: null,
                    data: { ...state.data, user, isInitialized: true }
                }));
                toast.success('Account created successfully!');
                return res.data;
            } catch (err) {
                const message = err.message || 'Registration failed';
                const fieldErrors = err.validationErrors || {};
                set({ error: message });
                uiActions.setError('auth', message);
                throw { message, fieldErrors };
            } finally {
                uiActions.setLoading('auth', false);
            }
        },

        logout: () => {
            localStorage.removeItem('token');
            set((state) => ({
                ...state,
                error: null,
                data: { ...state.data, user: null, isInitialized: true }
            }));
        },

    }
}));
