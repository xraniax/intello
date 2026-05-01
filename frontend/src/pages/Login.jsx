import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { validateEmail, validatePassword } from '@/utils/validators';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [touched, setTouched] = useState({ email: false, password: false });
    const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);

    const login = useAuthStore(state => state.actions.login);
    const uiError = useUIStore(state => state.data.errors['auth']);
    const clearUIError = useUIStore(state => state.actions.clearError);
    const sending = useUIStore(state => state.data.loadingStates['auth']?.loading || false);
    const navigate = useNavigate();
    const location = useLocation();

    // Clear global error when user types
    useEffect(() => {
        if (uiError) clearUIError('auth');
    }, [email, password]);

    const authErrorFromQuery = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const error = params.get('error');

        if (error === 'auth_failed') return 'Authentication failed. Please check your provider.';
        if (error === 'account_suspended') return 'Your account has been suspended.';
        if (params.get('expired') === 'true') return 'Your session has expired. Please log in again.';
        return '';
    }, [location.search]);

    const displayedGlobalError = uiError || authErrorFromQuery;

    const runValidation = (field, value) => {
        let result = { valid: true };
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
        runValidation(field, field === 'email' ? email : password);
    };

    const handleChange = (field, value) => {
        if (field === 'email') setEmail(value);
        if (field === 'password') setPassword(value);

        if (touched[field]) {
            runValidation(field, value);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Final validation check for all fields
        const emailValid = runValidation('email', email);
        const passValid = runValidation('password', password);
        setTouched({ email: true, password: true });

        if (!emailValid || !passValid) return;

        try {
            const loggedInUser = await login(email, password);
            navigate(loggedInUser?.data?.role === 'admin' ? '/admin' : '/dashboard');
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

    return (
        <div className="flex flex-col items-center justify-center min-h-[90vh] p-6 animate-in fade-in duration-700 relative overflow-hidden" style={{ background: 'var(--c-canvas)' }}>
            {/* Decorative background elements */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(var(--c-primary) 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

            <div className="w-full max-w-[420px] p-10 rounded-[2.5rem] relative z-10" style={{ background: 'var(--c-surface)', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--c-border-soft)' }}>
                <div className="text-center mb-10">
                    <h1 className="mb-2 text-4xl font-black font-serif" style={{ color: 'var(--c-text)' }}>Welcome Back</h1>
                    <p className="font-bold" style={{ color: 'var(--c-text-secondary)' }}>Please enter your details to sign in</p>
                </div>

                {displayedGlobalError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-[1rem] mb-6 text-sm font-bold border-2 border-red-100 animate-in slide-in-from-top-2 shadow-sm shadow-red-200/50">
                        {displayedGlobalError}
                    </div>
                )}

                <div className="space-y-3 mb-8">
                    <button
                        onClick={() => handleSocialLogin('google')}
                        disabled={sending}
                        className="btn-secondary w-full gap-3 disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </button>
                    <button
                        onClick={() => handleSocialLogin('github')}
                        disabled={sending}
                        className="btn-secondary w-full gap-3 disabled:opacity-50"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                        </svg>
                        Continue with GitHub
                    </button>
                </div>

                <div className="relative mb-8">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" style={{ borderColor: 'var(--c-border)' }}></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase tracking-widest font-bold" style={{ color: 'var(--c-text-muted)' }}>
                        <span className="px-4" style={{ background: 'var(--c-surface)' }}>Or use email</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: 'var(--c-text-muted)' }}>Email Address</label>
                        <input
                            type="email"
                            className={`input-field ${emailErrorVisible ? '!border-red-400 !ring-4 !ring-red-50' : ''}`}
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            onBlur={() => handleBlur('email')}
                        />
                        {emailErrorVisible && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{fieldErrors.email}</p>}
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: 'var(--c-text-muted)' }}>Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className={`input-field pr-12 ${passwordErrorVisible ? '!border-red-400 !ring-4 !ring-red-50' : ''}`}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                onBlur={() => handleBlur('password')}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-4 flex items-center transition-colors focus:outline-none"
                                style={{ color: 'var(--c-text-muted)' }}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5 hover:text-[var(--c-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 hover:text-[var(--c-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        {passwordErrorVisible && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{fieldErrors.password}</p>}
                    </div>

                    <div className="flex justify-end">
                        <Link to="/forgot-password" virtual-dom-link="true" className="text-sm font-semibold transition-colors hover:underline" style={{ color: 'var(--c-primary)' }}>
                            Forgot your password?
                        </Link>
                    </div>

                    <button type="submit" className="btn-primary w-full mt-2" disabled={sending}>
                        {sending ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 inline-block align-middle"></div>
                                <span className="align-middle">Signing in...</span>
                            </>
                        ) : 'Sign In'}
                    </button>
                </form>

                <p className="text-center mt-8 text-sm font-bold" style={{ color: 'var(--c-text-muted)' }}>
                    New to Cognify? <Link to="/register" className="font-black transition-colors hover:underline underline-offset-4" style={{ color: 'var(--c-primary)' }}>Create an account</Link>
                </p>
            </div>

            <p className="mt-8 text-xs font-black uppercase tracking-[0.2em] text-gray-400 relative z-10 text-center">
                Vibrant Learning &bull; Unlimited Potential
            </p>
        </div>
    );
};

export default Login;
