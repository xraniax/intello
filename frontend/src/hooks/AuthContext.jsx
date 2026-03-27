import React, { createContext, useContext, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';

const AuthContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const auth = useAuthStore();
    const { isInitialized, loadUser } = auth;

    useEffect(() => {
        if (!isInitialized) {
            loadUser();
        }
    }, [isInitialized, loadUser]);

    const value = {
        user: auth.user,
        loading: auth.loading,
        error: auth.error,
        login: auth.login,
        register: auth.register,
        logout: auth.logout,
        updateUser: auth.setUser,
        loginWithToken: async (token) => {
            localStorage.setItem('token', token);
            return await auth.loadUser();
        }
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
