import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/store/useAuthStore';
import { useUIStore } from '@/store/useUIStore';
import { validateEmail, validatePassword, validateName } from '@/utils/validators';

const Orb = ({ color, size, top, left, delay, opacity = 0.15 }) => (
    <motion.div
        animate={{
            y: [0, -30, 0],
            x: [0, 20, 0],
            scale: [1, 1.1, 1],
            rotate: [0, 45, 0],
        }}
        transition={{
            duration: 12,
            repeat: Infinity,
            delay: delay,
            ease: "easeInOut"
        }}
        className="absolute blur-[80px] rounded-full pointer-events-none z-0"
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

const Register = () => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [touched, setTouched] = useState({ name: false, email: false, password: false });
    const [fieldErrors, setFieldErrors] = useState({ name: '', email: '', password: '' });
    const [showPassword, setShowPassword] = useState(false);

    const registerAction = useAuthStore(state => state.actions.register);
    const uiError = useUIStore(state => state.data.errors['auth']);
    const clearUIError = useUIStore(state => state.actions.clearError);
    const sending = useUIStore(state => state.data.loadingStates['auth']?.loading || false);
    const navigate = useNavigate();

    // Clear global error when user types
    useEffect(() => {
        if (uiError) clearUIError('auth');
    }, [formData]);

    const runValidation = (field, value) => {
        let result = { valid: true };
        if (field === 'name') result = validateName(value);
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

        // Final validation check for all fields
        const nameValid = runValidation('name', formData.name);
        const emailValid = runValidation('email', formData.email);
        const passValid = runValidation('password', formData.password);
        setTouched({ name: true, email: true, password: true });

        if (!nameValid || !emailValid || !passValid) return;

        try {
            await registerAction(formData);
            navigate('/verify-email');
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
            className="flex flex-col items-center justify-center h-full p-4 animate-in fade-in duration-700 relative overflow-hidden" 
            style={{ 
                background: 'var(--c-canvas)',
                backgroundImage: `
                    radial-gradient(circle at 10% 20%, rgba(99, 91, 255, 0.2), transparent 50%),
                    radial-gradient(circle at 90% 80%, rgba(244, 63, 94, 0.2), transparent 50%),
                    radial-gradient(circle at 50% 50%, rgba(16, 184, 213, 0.15), transparent 60%),
                    radial-gradient(circle at 80% 10%, rgba(245, 166, 35, 0.15), transparent 50%)
                ` 
            }}
        >
            {/* High-Vibrancy Ambient Elements */}
            <Orb color="var(--c-primary)" size="500px" top="-15%" left="-10%" delay={0} opacity={0.25} />
            <Orb color="var(--c-rose)" size="400px" top="60%" left="75%" delay={2} opacity={0.2} />
            <Orb color="var(--c-teal)" size="350px" top="20%" left="60%" delay={4} opacity={0.18} />
            <Orb color="var(--c-amber)" size="300px" top="70%" left="10%" delay={6} opacity={0.15} />
            <Orb color="var(--c-fuchsia)" size="450px" top="-5%" left="50%" delay={8} opacity={0.2} />
            
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(var(--c-primary) 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

            {/* Global Cursor Glow */}
            <motion.div
                className="pointer-events-none absolute inset-0 z-0 opacity-50 transition-opacity duration-500"
                style={{
                    background: `radial-gradient(800px circle at ${mousePos.x}px ${mousePos.y}px, var(--c-primary-soft), transparent 45%)`
                }}
            />

            <motion.div 
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} // Custom sharp ease
                className="w-full max-w-[400px] p-6 md:p-8 rounded-[1.5rem] relative z-10 backdrop-blur-[32px] shadow-2xl overflow-hidden group" 
                style={{ 
                    background: 'rgba(255, 255, 255, 0.85)', 
                    border: '1.5px solid rgba(255, 255, 255, 0.6)', 
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
                        <h1 className="text-3xl font-black tracking-[-0.04em] uppercase leading-none" style={{ color: 'var(--c-text-secondary)' }}>
                            Create Account
                        </h1>
                    </div>
                    
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] opacity-40" style={{ color: 'var(--c-text-muted)' }}>
                        Join the collective
                    </p>
                </div>

                {uiError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-[1rem] mb-6 text-sm font-bold border-2 border-red-100 animate-in slide-in-from-top-2 shadow-sm shadow-red-200/50">
                        {uiError}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-4">
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

                <div className="relative mb-4">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t" style={{ borderColor: 'rgba(0,0,0,0.08)' }}></div>
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase tracking-[0.3em] font-black" style={{ color: 'var(--c-text-muted)' }}>
                        <span className="px-6 rounded-full bg-white/50 backdrop-blur-md">Or use your email</span>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-2.5">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-50" style={{ color: 'var(--c-text-muted)' }}>Full Name</label>
                        <input
                            type="text"
                            className={`input-field !h-10 !text-sm !rounded-lg ${touched.name && fieldErrors.name ? '!border-red-400 !ring-4 !ring-red-50' : ''}`}
                            placeholder="Enter your name"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            onBlur={() => handleBlur('name')}
                        />
                        {touched.name && fieldErrors.name && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{fieldErrors.name}</p>}
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-50" style={{ color: 'var(--c-text-muted)' }}>Email Address</label>
                        <input
                            type="email"
                            className={`input-field !h-10 !text-sm !rounded-lg ${touched.email && fieldErrors.email ? '!border-red-400 !ring-4 !ring-red-50' : ''}`}
                            placeholder="name@example.com"
                            value={formData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                            onBlur={() => handleBlur('email')}
                        />
                        {touched.email && fieldErrors.email && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{fieldErrors.email}</p>}
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5 ml-1 opacity-50" style={{ color: 'var(--c-text-muted)' }}>Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className={`input-field !h-10 !text-sm pr-12 !rounded-lg ${touched.password && fieldErrors.password ? '!border-red-400 !ring-4 !ring-red-50' : ''}`}
                                placeholder="••••••••"
                                value={formData.password}
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
                        {touched.password && fieldErrors.password && <p className="text-xs text-red-500 mt-1.5 ml-1 font-medium">{fieldErrors.password}</p>}
                        {!fieldErrors.password && <p className="text-xs mt-1.5 ml-1" style={{ color: 'var(--c-text-muted)' }}>Minimum 8 characters</p>}
                    </div>

                    <button type="submit" className="btn-solid w-full mt-1.5 !rounded-lg !h-11 !font-black !text-base shadow-lg shadow-primary/20" disabled={sending} style={{ background: 'var(--c-primary)', color: 'white' }}>
                        {sending ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2 inline-block align-middle"></div>
                                <span className="align-middle">Creating account...</span>
                            </>
                        ) : 'Sign Up'}
                    </button>
                </form>

                <p className="text-center mt-4 text-xs font-bold opacity-60" style={{ color: 'var(--c-text-muted)' }}>
                    Already have an account? <Link to="/login" className="font-black text-teal-600 hover:text-teal-700 underline underline-offset-8 transition-all px-2 py-1 rounded-md hover:bg-teal-500/5 active:scale-95 inline-block">Sign in</Link>
                </p>
            </motion.div>

            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 relative z-10 text-center">
                STUDY BETTER &bull; BUILT DIFFERENT
            </p>
        </div>
    );
};

export default Register;
