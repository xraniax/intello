import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Sparkles, ArrowRight, BarChart2, Target, FolderOpen, Clock, UserCircle } from 'lucide-react';

const PAGE_META = {
    '/analytics':  { icon: BarChart2,   label: 'Analytics',        description: 'Track your learning patterns, quiz performance, and knowledge growth over time.' },
    '/goals':      { icon: Target,      label: 'Study Goals',      description: 'Set targets, plan study sessions, and stay on track with AI-powered scheduling.' },
    '/subjects':   { icon: FolderOpen,  label: 'Subject Workspace', description: 'Dive into your subjects — access quizzes, flashcards, summaries, and your AI tutor.' },
    '/history':    { icon: Clock,       label: 'History',          description: 'Review your past study sessions, quiz attempts, and learning milestones.' },
    '/profile':    { icon: UserCircle,  label: 'Profile',          description: 'Manage your account settings, preferences, and learning profile.' },
    '/upload':     { icon: FolderOpen,  label: 'Upload',           description: 'Upload documents to your workspace and let AI generate study materials.' },
    '/trash':      { icon: FolderOpen,  label: 'Trash',            description: 'View and recover recently deleted subjects and materials.' },
};

const GuestGate = () => {
    const location = useLocation();
    
    // Match the current path to metadata (handle dynamic routes like /subjects/:id)
    const pathKey = Object.keys(PAGE_META).find(key => location.pathname.startsWith(key)) || '/analytics';
    const meta = PAGE_META[pathKey] || PAGE_META['/analytics'];
    const Icon = meta.icon;

    return (
        <div className="flex-1 flex items-center justify-center p-6 relative overflow-hidden" style={{ background: 'var(--c-canvas)' }}>
            {/* Ambient blurs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-15%] left-[-5%] w-[40%] h-[40%] bg-indigo-400/15 blur-[100px] rounded-full" />
                <div className="absolute bottom-[-15%] right-[-5%] w-[50%] h-[50%] bg-fuchsia-400/15 blur-[100px] rounded-full" />
                <div className="absolute top-[30%] right-[20%] w-[30%] h-[30%] bg-amber-300/10 blur-[80px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, ease: 'circOut' }}
                className="relative z-10 max-w-md w-full text-center"
            >
                {/* Lock Icon */}
                <motion.div
                    className="w-20 h-20 rounded-3xl mx-auto mb-8 flex items-center justify-center relative"
                    style={{
                        background: 'linear-gradient(135deg, rgba(124,92,252,0.12), rgba(168,85,247,0.08))',
                        border: '2px solid rgba(124,92,252,0.15)',
                        boxShadow: '0 12px 40px rgba(124,92,252,0.12)',
                    }}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                >
                    <Lock className="w-8 h-8" style={{ color: 'var(--c-primary)' }} />
                    <motion.div
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: 'var(--grad-primary)', boxShadow: '0 4px 12px rgba(124,92,252,0.4)' }}
                        animate={{ scale: [1, 1.15, 1], rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Icon className="w-3 h-3 text-white" />
                    </motion.div>
                </motion.div>

                {/* Page-specific info */}
                <h2 className="text-3xl font-black tracking-tight mb-3" style={{ color: 'var(--c-text)', letterSpacing: '-0.03em' }}>
                    Unlock {meta.label}
                </h2>
                <p className="text-[15px] font-medium leading-relaxed mb-8 max-w-sm mx-auto" style={{ color: 'var(--c-text-secondary)' }}>
                    {meta.description}
                </p>

                {/* CTA buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <motion.div whileTap={{ scale: 0.95 }}>
                        <Link
                            to="/register"
                            className="btn btn-md btn-solid flex items-center gap-2 group px-6"
                        >
                            <Sparkles className="w-4 h-4 opacity-90" />
                            Create free account
                            <ArrowRight className="w-4 h-4 opacity-70 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </motion.div>
                    <Link
                        to="/login"
                        className="btn btn-md btn-outline px-6"
                    >
                        Sign in
                    </Link>
                </div>

                {/* Trust */}
                <p className="mt-8 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-placeholder)' }}>
                    Free to start · No credit card
                </p>
            </motion.div>
        </div>
    );
};

export default GuestGate;
