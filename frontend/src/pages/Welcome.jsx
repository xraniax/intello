import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Sparkles, Layers, Brain, BookMarked, ArrowRight, Zap, Star, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItemBouncy, heroSlideUp, bounceUp, popIn } from '@/utils/motion';

// ── Feature cards data ──────────────────────────────────────
const FEATURES = [
    {
        icon: Layers,
        label: 'Curated Workspaces',
        body: 'Organize materials by subject. Every quiz, flashcard deck, and summary lives exactly where you expect it.',
        grad: 'var(--grad-ocean)',
        light: 'var(--c-primary-ultra)',
        textColor: 'var(--c-primary)',
        shadow: 'var(--shadow-primary)',
    },
    {
        icon: Brain,
        label: 'Contextual AI Tutor',
        body: 'Ask anything and get answers grounded strictly in your own documents — zero hallucinations from generic training data.',
        grad: 'var(--grad-candy)',
        light: 'var(--c-rose-light)',
        textColor: 'var(--c-rose)',
        shadow: 'var(--shadow-rose)',
    },
    {
        icon: Zap,
        label: 'Active Generation',
        body: 'Turn passive PDFs into quizzes, flashcard decks, and structured summaries in seconds with one click.',
        grad: 'var(--grad-cool)',
        light: 'var(--c-teal-light)',
        textColor: 'var(--c-teal)',
        shadow: 'var(--shadow-teal)',
    },
];

// ── Floating decoration orbs ────────────────────────────────
const Orb = ({ style, delay = 0, size = 80, opacity = 0.12 }) => (
    <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{ width: size, height: size, ...style }}
        animate={{ y: [0, -18, 0], x: [0, 8, 0] }}
        transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
);

const Welcome = () => {
    const user = useAuthStore((state) => state.data.user);
    if (user) return <Navigate to="/dashboard" replace />;

    return (
        <div
            className="flex flex-col"
            style={{ background: 'var(--c-canvas)' }}
        >
            {/* ── Hero ── */}
            <main className="relative flex flex-col items-center text-center px-6 pt-20 md:pt-28 pb-16 min-h-[calc(100vh-58px)]">

                {/* Background orbs — contained so they don't scroll-overflow */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <Orb style={{ background: 'var(--grad-primary)', top: '10%', left: '5%' }} size={120} delay={0} />
                    <Orb style={{ background: 'var(--grad-candy)', top: '15%', right: '8%' }} size={80} delay={1.5} />
                    <Orb style={{ background: 'var(--grad-cool)', bottom: '20%', left: '12%' }} size={60} delay={2.5} />
                    <Orb style={{ background: 'var(--grad-warm)', bottom: '25%', right: '6%' }} size={100} delay={1} />
                </div>

                <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center gap-6">

                    {/* Eyebrow badge */}
                    <motion.div {...popIn} transition={{ delay: 0 }}>
                        <motion.div
                            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[12px] font-bold tracking-wider"
                            style={{
                                background: 'white',
                                color: 'var(--c-primary)',
                                border: '1px solid var(--c-border-strong)',
                                boxShadow: 'var(--shadow-xs)',
                            }}
                            whileHover={{ scale: 1.02 }}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            AI-powered learning — made delightful
                        </motion.div>
                    </motion.div>

                    {/* Headline */}
                    <motion.div {...heroSlideUp} transition={{ delay: 0.08 }} className="flex flex-col gap-2">
                        <h1
                            className="text-[3.5rem] sm:text-[4.5rem] font-black leading-[1.02] tracking-tight"
                            style={{ color: 'var(--c-text)', letterSpacing: '-0.04em' }}
                        >
                            Study smarter.{' '}
                            <span className="text-gradient-hero">
                                Learn faster.
                            </span>
                        </h1>
                        <h2
                            className="text-[3.5rem] sm:text-[4.5rem] font-black leading-[1.02] tracking-tight text-display"
                            style={{ color: 'var(--c-primary)', letterSpacing: '-0.04em', WebkitTextFillColor: 'initial', background: 'none' }}
                        >
                            Remember more.
                        </h2>
                    </motion.div>

                    {/* Subheading */}
                    <motion.p
                        {...heroSlideUp}
                        transition={{ delay: 0.14 }}
                        className="text-lg leading-relaxed max-w-xl font-medium"
                        style={{ color: 'var(--c-text-secondary)' }}
                    >
                        Upload your notes, lecture slides, and PDFs. Cognify builds personalized
                        quizzes, flashcards, and an AI tutor that knows exactly what you're studying.
                    </motion.p>

                    {/* CTA */}
                    <motion.div
                        {...heroSlideUp}
                        transition={{ delay: 0.20 }}
                        className="flex flex-col sm:flex-row items-center gap-4 pt-4"
                    >
                        <motion.div whileTap={{ scale: 0.94 }}>
                            <Link
                                to="/register"
                                className="btn btn-lg btn-solid flex items-center gap-2.5 group"
                                style={{ padding: '0 32px' }}
                            >
                                <Zap className="w-5 h-5 opacity-90" />
                                Start learning for free
                                <motion.span
                                    className="inline-block"
                                    animate={{ x: [0, 3, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                    <ArrowRight className="w-5 h-5 opacity-90" />
                                </motion.span>
                            </Link>
                        </motion.div>
                        <Link
                            to="/login"
                            className="btn btn-lg btn-outline"
                            style={{ padding: '0 32px' }}
                        >
                            Log in
                        </Link>
                    </motion.div>

                    {/* Trust line */}
                    <motion.div
                        {...heroSlideUp}
                        transition={{ delay: 0.26 }}
                        className="flex items-center gap-2 text-[12px]"
                        style={{ color: 'var(--c-text-placeholder)' }}
                    >
                        <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(i => (
                                <Star key={i} className="w-3 h-3 fill-current" style={{ color: 'var(--c-amber)' }} />
                            ))}
                        </div>
                        <span>Free to start · No credit card needed</span>
                    </motion.div>
                </div>
            </main>

            {/* ── Feature cards ── */}
            <section
                className="py-16 px-6"
                style={{ borderTop: '1px solid var(--c-border-soft)', background: 'var(--c-surface)' }}
            >
                <div className="max-w-5xl mx-auto">
                    {/* Section label */}
                    <motion.div
                        {...bounceUp}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                        className="text-center mb-12"
                    >
                        <p
                            className="text-[12px] font-bold tracking-widest uppercase mb-3"
                            style={{ color: 'var(--c-primary)' }}
                        >
                            Everything you need
                        </p>
                        <h2
                            className="text-3xl font-black font-serif"
                            style={{ color: 'var(--c-text)', letterSpacing: '-0.02em' }}
                        >
                            Built for serious learners
                        </h2>
                    </motion.div>

                    <motion.div
                        variants={staggerContainer}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true, amount: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-6"
                    >
                        {FEATURES.map(({ icon: Icon, label, body, grad, light, textColor, shadow }) => (
                            <motion.div
                                key={label}
                                variants={staggerItemBouncy}
                                className="flex flex-col gap-5 p-8 rounded-[32px] transition-all group bg-white"
                                style={{
                                    border: '1px solid var(--c-border-strong)',
                                    boxShadow: 'var(--shadow-xs)',
                                }}
                                whileHover={{
                                    scale: 1.03,
                                    y: -8,
                                    boxShadow: `0 24px 40px rgba(0,0,0,0.08)`,
                                    borderColor: 'rgba(0,0,0,0.12)',
                                    transition: { type: 'spring', damping: 20, stiffness: 300 }
                                }}
                            >
                                {/* Icon */}
                                <motion.div
                                    className="w-16 h-16 rounded-[20px] flex items-center justify-center relative overflow-hidden"
                                    style={{ background: light, color: textColor }}
                                    whileHover={{ scale: 1.15, rotate: [0, -10, 10, -5, 0] }}
                                    transition={{ duration: 0.5, type: 'spring' }}
                                >
                                    <div className="absolute inset-0 opacity-10" style={{ background: grad }} />
                                    <Icon className="w-8 h-8 relative z-10" strokeWidth={2.5} />
                                </motion.div>

                                <div>
                                    <p
                                        className="text-[18px] font-bold mb-2 tracking-tight"
                                        style={{ color: 'var(--c-text)' }}
                                    >
                                        {label}
                                    </p>
                                    <p className="text-[14px] leading-relaxed font-medium" style={{ color: 'var(--c-text-secondary)' }}>
                                        {body}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ── Bottom CTA ── */}
            <section
                className="py-20 px-6"
                style={{ borderTop: '1px solid var(--c-border-strong)', background: 'var(--c-canvas)' }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    className="max-w-3xl mx-auto relative rounded-[32px] overflow-hidden px-10 py-12 text-center bg-white hover-lift"
                    style={{ border: '1px solid var(--c-border-strong)', boxShadow: 'var(--shadow-sm)' }}
                >
                    {/* Decorative orbs */}
                    <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full pointer-events-none" style={{ background: 'var(--c-primary-light)', opacity: 0.5 }} />
                    <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full pointer-events-none" style={{ background: 'var(--c-coral-light)', opacity: 0.5 }} />

                    <div className="relative z-10">
                        <motion.div
                            className="w-16 h-16 rounded-[20px] flex items-center justify-center mx-auto mb-6"
                            style={{ background: 'var(--c-surface-alt)', border: '1px solid var(--c-border-soft)' }}
                            animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.05, 1.05, 1] }}
                            whileHover={{ scale: 1.15, rotate: 360, transition: { duration: 0.6 } }}
                            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <GraduationCap className="w-8 h-8" style={{ color: 'var(--c-primary)' }} />
                        </motion.div>
                        <h3
                            className="text-[32px] font-black mb-3 font-serif"
                            style={{ color: 'var(--c-text)', letterSpacing: '-0.02em' }}
                        >
                            Ready to level up?
                        </h3>
                        <p className="text-[15px] font-medium mb-8 max-w-md mx-auto" style={{ color: 'var(--c-text-secondary)' }}>
                            Join students turning passive study sessions into active learning journeys.
                        </p>
                        <motion.div whileTap={{ scale: 0.94 }} className="inline-block">
                            <Link
                                to="/register"
                                className="btn btn-lg btn-solid flex items-center gap-2.5 px-8"
                            >
                                <Sparkles className="w-4 h-4 opacity-90" />
                                Create free account
                            </Link>
                        </motion.div>
                    </div>
                </motion.div>
            </section>
        </div>
    );
};

export default Welcome;
