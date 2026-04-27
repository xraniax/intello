import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import toast from 'react-hot-toast';

/**
 * Centralized utility to gate protected actions.
 * 
 * If the user is logged in, the action is executed immediately.
 * If the user is NOT logged in, the action is saved to the UI store's
 * pendingAction state, the auth modal is triggered, and execution is halted.
 * 
 * @param {Function} action - The intended function to execute.
 */
export const requireAuth = (action) => {
    // We check the local Zustand store state without needing a React hook context
    const user = useAuthStore.getState().data.user;

    if (!user) {
        toast('Please login to continue', { duration: 3000 });
        const uiActions = useUIStore.getState().actions;
        uiActions.setPendingAction(action);
        uiActions.setModal('authPrompt');
        return; // Hault execution
    }

    return action();
};
