import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { resetAuthFailureGuard } from '../utils/authFailureHandler';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const data = useAuthStore((state) => state.data);
    const globalLoading = useUIStore((state) => state.data.loadingStates['auth']?.loading || false);
    const error = useAuthStore((state) => state.error);
    const actions = useAuthStore((state) => state.actions);
    
    const { isInitialized, user } = data;
    const { loadUser, login, register, logout, setUser } = actions;
    
    const loading = !isInitialized || !!globalLoading;

    useEffect(() => {
        if (!isInitialized) {
            loadUser().catch(() => {});
        }
    }, [isInitialized, loadUser]);

    const loginWithToken = useCallback(async (token) => {
        localStorage.setItem('token', token);
        const user = await loadUser();
        resetAuthFailureGuard();
        return user;
    }, [loadUser]);

    const value = useMemo(() => ({
        user,
        loading,
        error,
        login,
        register,
        logout,
        updateUser: setUser,
        loginWithToken
    }), [user, loading, error, login, register, logout, setUser, loginWithToken]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
