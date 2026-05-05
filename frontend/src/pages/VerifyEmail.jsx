import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ArrowRight, RefreshCw, KeyRound, Sparkles, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import toast from 'react-hot-toast';

const VerifyEmail = () => {
    const navigate = useNavigate();
    const [otp, setOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [isResending, setIsResending] = useState(false);

    const { verifyEmail, resendVerification, data: { user } } = useAuthStore(state => ({
        verifyEmail: state.actions.verifyEmail,
        resendVerification: state.actions.resendVerification,
        data: state.data
    }));

    useEffect(() => {
        // If they are not unverified, send them away
        if (!user) {
            navigate('/login');
        } else if (user.status !== 'UNVERIFIED') {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    useEffect(() => {
        let timer;
        if (resendCooldown > 0) {
            timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    const handleVerify = async (e) => {
        e.preventDefault();
        if (otp.length !== 6) {
            toast.error('Please enter a valid 6-digit code');
            return;
        }

        setIsSubmitting(true);
        try {
            await verifyEmail(otp);
            navigate('/dashboard');
        } catch (error) {
            // Error is handled by store/toast
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResend = async () => {
        if (resendCooldown > 0 || isResending) return;
        
        setIsResending(true);
        try {
            await resendVerification();
            setResendCooldown(60); // 60 second cooldown
        } catch (error) {
            // handled
        } finally {
            setIsResending(false);
        }
    };

    const handleOtpChange = (e) => {
        const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
        setOtp(value);
    };

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-white relative">
            {/* Ambient Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/20 blur-[120px] rounded-full mix-blend-multiply" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-fuchsia-500/20 blur-[120px] rounded-full mix-blend-multiply" />
            </div>

            {/* Left Panel - Verification Form */}
            <div className="flex flex-col justify-center px-8 sm:px-16 lg:px-24 xl:px-32 relative z-10 w-full max-w-2xl mx-auto">
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 fill-mode-both">
                    {/* Brand */}
                    <div className="flex items-center gap-3 mb-16">
                        <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center transform hover:scale-105 hover:rotate-3 transition-all duration-300 shadow-xl shadow-gray-200">
                            <Sparkles className="text-white w-6 h-6" />
                        </div>
                        <span className="text-2xl font-black tracking-tighter text-gray-900">
                            Cognify.
                        </span>
                    </div>

                    <div className="mb-12">
                        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 shadow-inner">
                            <Mail className="w-8 h-8" />
                        </div>
                        <h1 className="text-5xl font-black tracking-tighter text-gray-900 mb-4 leading-tight">
                            Verify your<br />email space.
                        </h1>
                        <p className="text-lg font-medium text-gray-500 max-w-md">
                            We've sent a 6-digit code to <span className="font-bold text-gray-900">{user?.email}</span>. Please enter it below to activate your account.
                        </p>
                    </div>

                    <form onSubmit={handleVerify} className="space-y-6">
                        <div className="space-y-4">
                            <div className="relative group">
                                <KeyRound className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                                <input
                                    type="text" // using text to prevent browser default up/down arrows easily while controlling length
                                    inputMode="numeric"
                                    value={otp}
                                    onChange={handleOtpChange}
                                    className="w-full pl-14 pr-6 py-5 bg-white border-2 border-gray-100 rounded-2xl text-2xl font-black tracking-[0.5em] text-center text-gray-900 placeholder:text-gray-300 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all shadow-sm hover:border-gray-200"
                                    placeholder="••••••"
                                    maxLength={6}
                                    required
                                />
                                <div className="absolute inset-0 rounded-2xl ring-4 ring-indigo-500/10 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || otp.length !== 6}
                            className="w-full flex items-center justify-center gap-2 px-8 py-5 bg-gray-900 text-white rounded-2xl text-lg font-bold shadow-xl shadow-gray-900/20 hover:scale-[1.02] hover:shadow-2xl hover:shadow-gray-900/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 overflow-hidden relative group"
                        >
                            <span className="relative z-10">{isSubmitting ? 'Verifying...' : 'Verify Email'}</span>
                            {!isSubmitting && <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />}
                        </button>
                        
                        <div className="flex justify-center pt-4">
                            <button
                                type="button"
                                onClick={handleResend}
                                disabled={resendCooldown > 0 || isResending}
                                className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:hover:text-gray-500"
                            >
                                <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
                                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend verification code'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Right Panel - Hero Image */}
            <div className="hidden lg:flex flex-col justify-center px-12 py-12 relative z-10">
                <div className="w-full h-full bg-gray-900 rounded-[3rem] overflow-hidden relative shadow-2xl animate-in fade-in zoom-in duration-1000 delay-300 fill-mode-both border-8 border-white">
                    <img 
                        src="https://images.unsplash.com/photo-1555421689-491a97ff2040?auto=format&fit=crop&q=80" 
                        alt="Workspace" 
                        className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/40 via-purple-500/40 to-fuchsia-500/40" />
                    
                    <div className="absolute inset-x-12 bottom-12 p-8 glass-card border-none bg-white/10 rounded-3xl backdrop-blur-md">
                        <p className="text-2xl font-medium text-white/90 leading-relaxed mb-6">
                            "A secure platform ensures your progress is safely protected. Verify your space to unlock all learning utilities."
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                <ShieldCheck className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <div className="text-white font-bold">Secure Access</div>
                                <div className="text-white/60 text-sm font-medium">Platform Security</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifyEmail;
