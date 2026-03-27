import { create } from 'zustand';

/**
 * UI Store: Centralized tracking for loading states and global errors.
 * 
 * loadingStates: { [taskKey]: boolean }
 * errors: { [taskKey]: string | null }
 */
export const useUIStore = create((set, get) => ({
    loadingStates: {},
    errors: {},

    setLoading: (key, isLoading) => set((state) => ({
        loadingStates: { ...state.loadingStates, [key]: isLoading }
    })),

    setError: (key, message) => set((state) => ({
        errors: { ...state.errors, [key]: message },
        loadingStates: { ...state.loadingStates, [key]: false }
    })),

    clearError: (key) => set((state) => ({
        errors: { ...state.errors, [key]: null }
    })),

    // Helper to check if ANY critical task is loading
    isGlobalLoading: (keys = []) => {
        const loadingStates = get().loadingStates || {};
        if (keys.length === 0) return Object.values(loadingStates).some(Boolean);
        return keys.some((k) => Boolean(loadingStates[k]));
    }
}));
