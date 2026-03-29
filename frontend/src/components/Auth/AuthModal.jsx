import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUIStore } from '../../store/useUIStore';
import { validateEmail, validatePassword, validateName } from '../../utils/validators';
import { X } from 'lucide-react';

const AuthModal = () => {
    const modal = useUIStore(state => state.data.modal);
    const setModal = useUIStore(state => state.actions.setModal);
    const runPendingAction = useUIStore(state => state.actions.runPendingAction);
    const clearPendingAction = useUIStore(state => state.actions.clearPendingAction);
    const uiError = useUIStore(state => state.data.errors['auth']);
    const clearUIError = useUIStore(state => state.actions.clearError);
    const sending = useUIStore(state => state.data.loadingStates['auth']?.loading || false);

    const login = useAuthStore(state => state.actions.login);
    const register = useAuthStore(state => state.actions.register);

    const [view, setView] = useState('login'); // 'login' or 'register'
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [touched, setTouched] = useState({ name: false, email: false, password: false });
    const [fieldErrors, setFieldErrors] = useState({ name: '', email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);

    const isOpen = modal === 'authPrompt';

    useEffect(() => {
        if (!isOpen) {
            setFormData({ name: '', email: '', password: '' });
            setTouched({ name: false, email: false, password: false });
            setFieldErrors({ name: '', email: '', password: '' });
            clearUIError('auth');
            setView('login');
        }
    }, [isOpen]);

    useEffect(() => {
        if (uiError) clearUIError('auth');
    }, [formData]);

    if (!isOpen) return null;

    const handleClose = () => {
        setModal(null);
        clearPendingAction();
    };

    const runValidation = (field, value) => {
        let result = { valid: true };
        if (field === 'name' && view === 'register') result = validateName(value);
        if (field === 'email') result = validateEmail(value);
        if (field === 'password') result = validatePassword(value);
        
        setFieldErrors(prev => ({ 
            ...prev, 
            [field]: result.valid ? '' : result.message 
        }));
        return result.valid;
    };

    const handleBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }));
        runValidation(field, formData[field]);
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (touched[field]) {
            runValidation(field, value);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        let valid = true;
        const emailValid = runValidation('email', formData.email);
        const passValid = runValidation('password', formData.password);
        valid = emailValid && passValid;

        if (view === 'register') {
            const nameValid = runValidation('name', formData.name);
            valid = valid && nameValid;
            setTouched({ name: true, email: true, password: true });
        } else {
            setTouched({ email: true, password: true });
        }

        if (!valid) return;

        try {
            if (view === 'login') {
                await login(formData.email, formData.password);
            } else {
                await register({ name: formData.name, email: formData.email, password: formData.password });
            }
            // Success
            setModal(null);
            runPendingAction();
        } catch (err) {
            if (err.fieldErrors) {
                setFieldErrors(prev => ({ ...prev, ...err.fieldErrors }));
            }
        }
    };

    const handleSocialLogin = (provider) => {
        const backendBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        window.location.href = `${backendBase}/auth/${provider}`;
    };

    const emailErrorVisible = touched.email && fieldErrors.email;
    const passwordErrorVisible = touched.password && fieldErrors.password;
    const nameErrorVisible = touched.name && fieldErrors.name;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl w-full max-w-[420px] max-h-[92vh] overflow-y-auto p-6 sm:p-8 animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 relative pb-8">
                
                <button 
                    onClick={handleClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-2">
                        {view === 'login' ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <p className="text-sm text-gray-500 font-medium h-4">
                        {view === 'login' ? 'Sign in to continue your action' : 'Join Cognify to save your work'}
                    </p>
                </div>

                {uiError && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-xl mb-6 text-xs font-medium border border-red-100">
                        {uiError}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {view === 'register' && (
                        <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Full Name</label>
                            <input
                                type="text"
                                className={`input-field py-2.5 ${nameErrorVisible ? 'border-red-400 ring-2 ring-red-50' : ''}`}
                                placeholder="John Doe"
                                value={formData.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                onBlur={() => handleBlur('name')}
                            />
                            {nameErrorVisible && <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium">{fieldErrors.name}</p>}
                        </div>
                    )}

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Email Address</label>
                        <input
                            type="email"
                            className={`input-field py-2.5 ${emailErrorVisible ? 'border-red-400 ring-2 ring-red-50' : ''}`}
                            placeholder="name@example.com"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            onBlur={() => handleBlur('email')}
                        />
                        {emailErrorVisible && <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium">{fieldErrors.email}</p>}
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className={`input-field py-2.5 pr-12 ${passwordErrorVisible ? 'border-red-400 ring-2 ring-red-50' : ''}`}
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                onBlur={() => handleBlur('password')}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-400 transition-colors focus:outline-none"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {showPassword ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                    )}
                                </svg>
                            </button>
                        </div>
                        {passwordErrorVisible && <p className="text-[10px] text-red-500 mt-1 ml-1 font-medium">{fieldErrors.password}</p>}
                    </div>

                    <button type="submit" className="btn-primary w-full mt-4 py-3 text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-100" disabled={sending}>
                        {sending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>{view === 'login' ? 'Signing in...' : 'Creating...' }</span>
                            </>
                        ) : (view === 'login' ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>

                <p className="text-center mt-6 text-xs text-gray-500 font-medium">
                    {view === 'login' ? "New to Cognify? " : "Already have an account? "}
                    <button 
                        onClick={() => setView(view === 'login' ? 'register' : 'login')}
                        className="text-indigo-500 hover:text-indigo-600 font-bold transition-colors"
                    >
                        {view === 'login' ? 'Create an account' : 'Sign in'}
                    </button>
                </p>
            </div>
        </div>
    );
};

export default AuthModal;
