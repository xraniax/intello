import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const loadUser = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    const res = await authService.getMe();
                    setUser(res.data.data);
                } catch (err) {
                    console.error('Failed to load user', err);
                    localStorage.removeItem('token');
                }
            }
            setLoading(false);
        };

        loadUser();
    }, []);

    const login = async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            const res = await authService.login(email, password);
            const { token, ...userData } = res.data.data;
            localStorage.setItem('token', token);
            setUser(userData);
            return res.data;
        } catch (err) {
            const message = err.response?.data?.message || 'Login failed';
            setError(message);
            throw new Error(message);
        } finally {
            setLoading(false);
        }
    };

    const register = async (userData) => {
        setLoading(true);
        setError(null);
        try {
            const res = await authService.register(userData);
            const { token, ...data } = res.data.data;
            localStorage.setItem('token', token);
            setUser(data);
            return res.data;
        } catch (err) {
            const errorData = err.response?.data;
            const message = errorData?.message || 'Registration failed';
            setError({ message, errors: errorData?.errors });

            // Build a more informative error object
            const customError = new Error(message);
            customError.errors = errorData?.errors;
            throw customError;
        } finally {
            setLoading(false);
        }
    };

    const loginWithToken = async (token) => {
        setLoading(true);
        localStorage.setItem('token', token);
        try {
            const res = await authService.getMe();
            setUser(res.data.data);
            return res.data;
        } catch (err) {
            localStorage.removeItem('token');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const updateUser = (userData) => {
        setUser(userData);
    };

    const value = {
        user,
        loading,
        error,
        login,
        register,
        loginWithToken,
        logout,
        updateUser
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
