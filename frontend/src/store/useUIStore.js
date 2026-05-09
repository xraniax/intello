import { create } from 'zustand';

/**
 * UI Store: Centralized tracking for loading states and global errors.
 * 
 * loadingStates: { [taskKey]: boolean }
 * errors: { [taskKey]: string | null }
 */
export const useUIStore = create((set, get) => ({
    data: {
        loadingStates: {},
        errors: {},
        activeWorkspacePanel: 'content', // 'files', 'content', 'tutor'
        modal: null, // 'authPrompt', etc.
        goalsDrawerOpen: false,
        pendingAction: null // function
    },
    loading: false,
    error: null,
    actions: {
        setWorkspacePanel: (panel) => 
            set((state) => ({
                ...state,
                data: { ...state.data, activeWorkspacePanel: panel }
            })),

        setModal: (modalType) =>
            set((state) => ({
                ...state,
                data: { ...state.data, modal: modalType }
            })),

        setGoalsDrawer: (isOpen) =>
            set((state) => ({
                ...state,
                data: { ...state.data, goalsDrawerOpen: isOpen }
            })),

        toggleGoalsDrawer: () =>
            set((state) => ({
                ...state,
                data: { ...state.data, goalsDrawerOpen: !state.data.goalsDrawerOpen }
            })),

        setPendingAction: (action) =>
            set((state) => ({
                ...state,
                data: { ...state.data, pendingAction: action }
            })),

        runPendingAction: () => {
            const { pendingAction } = get().data;
            if (pendingAction && typeof pendingAction === 'function') {
                pendingAction();
            }
            get().actions.clearPendingAction();
        },

        clearPendingAction: () =>
            set((state) => ({
                ...state,
                data: { ...state.data, pendingAction: null }
            })),

        setLoading: (key, isLoading, message = 'Loading...', blocking = true) =>
            set((state) => ({
                ...state,
                data: {
                    ...state.data,
                    loadingStates: { 
                        ...state.data.loadingStates, 
                        [key]: isLoading ? { loading: true, message, blocking } : { loading: false, message: '', blocking: true }
                    }
                }
            })),

        setError: (key, message) =>
            set((state) => ({
                ...state,
                data: {
                    ...state.data,
                    errors: { ...state.data.errors, [key]: message },
                    loadingStates: { 
                        ...state.data.loadingStates, 
                        [key]: { loading: false, message: '' }
                    }
                }
            })),

        clearError: (key) =>
            set((state) => ({
                ...state,
                data: {
                    ...state.data,
                    errors: { ...state.data.errors, [key]: null }
                }
            })),

        // Helper to check if ANY critical task is loading
        getGlobalLoading: (keys = [], onlyBlocking = false) => {
            const loadingStates = get().data.loadingStates || {};
            const activeKeys = keys.length > 0 ? keys : Object.keys(loadingStates);
            
            for (const key of activeKeys) {
                const status = loadingStates[key];
                if (status?.loading && (!onlyBlocking || status?.blocking)) {
                    return status;
                }
            }
            return null;
        }
    }
}));
