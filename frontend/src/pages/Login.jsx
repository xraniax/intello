import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { validateEmail, validatePassword } from '@/utils/validators';

import { Sparkles, ArrowRight } from 'lucide-react';

const Orb = ({ color, size, top, left, delay, opacity = 0.15, duration = 12 }) => (
    <motion.div
        animate={{
            y: [0, -40, 0],
            x: [0, 30, 0],
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
        }}
        transition={{
            duration: duration,
            repeat: Infinity,
            delay: delay,
            ease: "easeInOut"
        }}
        className="absolute blur-[110px] rounded-full pointer-events-none z-0"
        style={{
            background: color,
            width: size,
            height: size,
            top: top,
            left: left,
            opacity: opacity
        }}
    />
);

const Noise = () => (
    <div className="absolute inset-0 z-1 pointer-events-none opacity-[0.03] mix-blend-overlay"
        style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
    />
);

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

    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    return (
        <div
            onMouseMove={handleMouseMove}
            className="flex flex-col items-center justify-center h-full p-4 animate-in fade-in duration-1000 relative overflow-hidden"
            style={{
                background: 'var(--c-canvas)',
                backgroundImage: `
                    radial-gradient(circle at 15% 15%, rgba(124, 58, 237, 0.2), transparent 50%),
                    radial-gradient(circle at 85% 85%, rgba(244, 63, 94, 0.2), transparent 50%),
                    radial-gradient(circle at 50% 10%, rgba(16, 184, 213, 0.15), transparent 60%)
                `
            }}
        >
            <Noise />

            {/* Bold Ambient Elements */}
            <Orb color="var(--c-primary)" size="600px" top="-20%" left="-15%" delay={0} opacity={0.25} duration={10} />
            <Orb color="var(--c-rose)" size="500px" top="50%" left="75%" delay={2} opacity={0.2} duration={12} />
            <Orb color="var(--c-teal)" size="420px" top="15%" left="55%" delay={4} opacity={0.15} duration={15} />
            <Orb color="var(--c-amber)" size="380px" top="75%" left="5%" delay={6} opacity={0.12} duration={18} />
            <Orb color="var(--c-fuchsia)" size="550px" top="-10%" left="65%" delay={8} opacity={0.15} duration={20} />

            <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: 'radial-gradient(var(--c-primary) 1.5px, transparent 1.5px)', backgroundSize: '48px 48px' }}></div>

            {/* Global Cursor Glow */}
            <motion.div
                className="pointer-events-none absolute inset-0 z-0 opacity-40 transition-opacity duration-1000"
                style={{
                    background: `radial-gradient(1000px circle at ${mousePos.x}px ${mousePos.y}px, var(--c-primary-soft), transparent 50%)`
                }}
            />

            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: "circOut" }}
                className="w-full max-w-[440px] p-8 md:p-9 rounded-[1.5rem] relative z-10 backdrop-blur-[32px] shadow-2xl overflow-hidden group border border-white/30"
                style={{
                    background: 'rgba(255, 255, 255, 0.85)',
                }}
            >
                {/* Rainbow Border Glow Effect */}
                <div className="absolute inset-0 pointer-events-none opacity-20 group-hover:opacity-40 transition-opacity duration-700"
                    style={{
                        padding: '1px',
                        background: 'linear-gradient(45deg, #635bff, #f43f5e, #f59e0b, #10b981, #3baaff, #635bff)',
                        backgroundSize: '400% 400%',
                        WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                        WebkitMaskComposite: 'xor',
                        maskComposite: 'exclude',
                        animation: 'gradient-shift 8s linear infinite'
                    }}
                />
                <div className="text-center mb-6 relative">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent rounded-full blur-md opacity-60" />
                    
                    <div className="relative inline-block mb-3">
                        <motion.div 
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: 0.5, duration: 1, ease: "circOut" }}
                            className="absolute -inset-x-6 -inset-y-2 bg-slate-500/5 rounded-2xl -z-10 skew-x-[-8deg] backdrop-blur-[4px] border border-black/5"
                        />
                        <h1 className="text-4xl font-black tracking-[-0.04em] uppercase leading-none" style={{ color: 'var(--c-text-secondary)' }}>
                            Welcome
                        </h1>
                    </div>
                    
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] opacity-40" style={{ color: 'var(--c-text-muted)' }}>
                        Your study hub is ready
                    </p>
                </div>

                {displayedGlobalError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-[1rem] mb-6 text-sm font-bold border-2 border-red-100 animate-in slide-in-from-top-2 shadow-sm shadow-red-200/50">
                        {displayedGlobalError}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={() => handleSocialLogin('google')}
                        disabled={sending}
                        className="btn-secondary h-14 w-full gap-3 disabled:opacity-50 !rounded-xl !border-[1.5px] !border-black/5 bg-white hover:bg-black/5 hover:border-black/10 transition-all text-base font-bold"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Google
                    </button>
                    <button
                        onClick={() => handleSocialLogin('github')}
                        disabled={sending}
                        className="btn-secondary h-14 w-full gap-3 disabled:opacity-50 !rounded-xl !border-[1.5px] !border-black/5 bg-white hover:bg-black/5 hover:border-black/10 transition-all text-base font-bold"
                    >
                        <svg className="w-6 h-6" viewBox="0 0 24 24">
                            <path fill="currentColor" d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                        </svg>
                        GitHub
                    </button>
                </div>

                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] font-black" style={{ color: 'var(--c-text-muted)' }}>
                        <span className="px-6 rounded-full bg-white/50 backdrop-blur-md">Or use your email</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] mb-3 ml-1 opacity-50" style={{ color: 'var(--c-text-muted)' }}>Email Address</label>
                        <input
                            type="email"
                            className={`input-field h-14 !rounded-xl !bg-white !border-[1.5px] !border-black/5 focus:!border-primary focus:!ring-8 focus:!ring-primary/10 transition-all text-base font-medium ${emailErrorVisible ? '!border-red-500 !ring-4 !ring-red-50' : ''}`}
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            onBlur={() => handleBlur('email')}
                        />
                        {emailErrorVisible && <p className="text-xs text-red-600 mt-2 ml-1 font-bold">{fieldErrors.email}</p>}
                    </div>

                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-[0.2em] mb-3 ml-1 opacity-50" style={{ color: 'var(--c-text-muted)' }}>Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className={`input-field h-14 pr-14 !rounded-xl !bg-white !border-[1.5px] !border-black/5 focus:!border-primary focus:!ring-8 focus:!ring-primary/10 transition-all text-base font-medium ${passwordErrorVisible ? '!border-red-500 !ring-4 !ring-red-50' : ''}`}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                onBlur={() => handleBlur('password')}
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-5 flex items-center transition-colors focus:outline-none"
                                style={{ color: 'var(--c-text-muted)' }}
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? (
                                    <svg className="w-6 h-6 hover:text-[var(--c-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                ) : (
                                    <svg className="w-6 h-6 hover:text-[var(--c-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                    </svg>
                                )}
                            </button>
                        </div>
                        {passwordErrorVisible && <p className="text-xs text-red-500 mt-2 ml-2 font-semibold">{fieldErrors.password}</p>}
                    </div>

                    <div className="flex justify-end pt-0">
                        <Link to="/forgot-password" virtual-dom-link="true" className="text-xs font-black transition-all hover:scale-105 active:scale-95" style={{ color: 'var(--c-primary)' }}>
                            Recovery Options
                        </Link>
                    </div>

                    <button type="submit" className="btn-solid w-full h-14 mt-2 !rounded-xl !text-lg !font-black shadow-lg hover:shadow-2xl hover:brightness-110 active:scale-[0.98] transition-all bg-primary border-none" disabled={sending}>
                        {sending ? (
                            <>
                                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mr-3 inline-block align-middle"></div>
                                <span className="align-middle">Connecting...</span>
                            </>
                        ) : 'Sign In Now'}
                    </button>
                </form>

                <p className="text-center mt-6 text-sm font-bold opacity-60" style={{ color: 'var(--c-text-muted)' }}>
                    Don't have an account? <Link to="/register" className="font-black text-teal-600 hover:text-teal-700 underline underline-offset-8 transition-all px-2 py-1 rounded-md hover:bg-teal-500/5 active:scale-95 inline-block">Register here</Link>
                </p>
            </motion.div>

            <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                transition={{ delay: 1, duration: 0.8 }}
                className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 relative z-10 text-center"
            >
                MANIFESTING YOUR ACADEMIC COMEBACK &bull; BUILT DIFFERENT
            </motion.p>
        </div>
    );
};

export default Login;
