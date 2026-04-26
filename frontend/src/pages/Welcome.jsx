import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { Sparkles, Layers, Brain, BookMarked, ArrowRight, Zap, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, staggerItemBouncy, heroSlideUp, bounceUp, popIn } from '@/utils/motion';

// ── Feature cards data ──────────────────────────────────────
const FEATURES = [
    {
        icon: Layers,
        emoji: '📚',
        label: 'Curated Workspaces',
        body: 'Organize materials by subject. Every quiz, flashcard deck, and summary lives exactly where you expect it.',
        grad: 'var(--grad-ocean)',
        light: 'var(--c-primary-ultra)',
        textColor: 'var(--c-primary)',
        shadow: 'var(--shadow-primary)',
    },
    {
        icon: Brain,
        emoji: '🤖',
        label: 'Contextual AI Tutor',
        body: 'Ask anything and get answers grounded strictly in your own documents — zero hallucinations from generic training data.',
        grad: 'var(--grad-candy)',
        light: 'var(--c-rose-light)',
        textColor: 'var(--c-rose)',
        shadow: 'var(--shadow-rose)',
    },
    {
        icon: BookMarked,
        emoji: '⚡',
        label: 'Active Generation',
        body: 'Turn passive PDFs into quizzes, flashcard decks, and structured summaries in seconds with one click.',
        grad: 'var(--grad-success)',
        light: 'var(--c-mint-light)',
        textColor: 'var(--c-mint)',
        shadow: 'var(--shadow-mint)',
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
            className="min-h-[calc(100vh-58px)] flex flex-col overflow-auto custom-scrollbar"
            style={{ background: 'var(--c-canvas)' }}
        >
            {/* ── Hero ── */}
            <main className="relative flex-1 flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 overflow-hidden">

                {/* Background orbs */}
                <Orb style={{ background: 'var(--grad-primary)', top: '10%', left: '5%' }} size={120} delay={0} />
                <Orb style={{ background: 'var(--grad-candy)', top: '15%', right: '8%' }} size={80} delay={1.5} />
                <Orb style={{ background: 'var(--grad-cool)', bottom: '20%', left: '12%' }} size={60} delay={2.5} />
                <Orb style={{ background: 'var(--grad-warm)', bottom: '25%', right: '6%' }} size={100} delay={1} />

                <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center gap-6">

                    {/* Eyebrow badge */}
                    <motion.div {...popIn} transition={{ delay: 0 }}>
                        <motion.div
                            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider"
                            style={{
                                background: 'var(--grad-primary)',
                                color: 'white',
                                boxShadow: 'var(--shadow-primary)',
                            }}
                            whileHover={{ scale: 1.05 }}
                        >
                            <motion.span
                                animate={{ rotate: [0, 20, -20, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                            </motion.span>
                            AI-powered learning — made delightful
                        </motion.div>
                    </motion.div>

                    {/* Headline */}
                    <motion.div {...heroSlideUp} transition={{ delay: 0.08 }} className="flex flex-col gap-1">
                        <h1
                            className="text-[3rem] sm:text-[4rem] font-black leading-[1.05] tracking-tight"
                            style={{ color: 'var(--c-text)', letterSpacing: '-0.04em' }}
                        >
                            Study smarter.{' '}
                            <span className="text-gradient-hero">
                                Learn faster.
                            </span>
                        </h1>
                        <h2
                            className="text-[3rem] sm:text-[4rem] font-black leading-[1.05] tracking-tight text-display"
                            style={{ color: 'var(--c-primary)', letterSpacing: '-0.04em', WebkitTextFillColor: 'initial', background: 'none' }}
                        >
                            Remember more.
                        </h2>
                    </motion.div>

                    {/* Subheading */}
                    <motion.p
                        {...heroSlideUp}
                        transition={{ delay: 0.14 }}
                        className="text-lg leading-relaxed max-w-xl"
                        style={{ color: 'var(--c-text-secondary)' }}
                    >
                        Upload your notes, lecture slides, and PDFs. Cognify builds personalized
                        quizzes, flashcards, and an AI tutor that knows exactly what you're studying.
                    </motion.p>

                    {/* CTA */}
                    <motion.div
                        {...heroSlideUp}
                        transition={{ delay: 0.20 }}
                        className="flex flex-col sm:flex-row items-center gap-3 pt-2"
                    >
                        <motion.div whileTap={{ scale: 0.94 }}>
                            <Link
                                to="/register"
                                className="btn btn-lg btn-solid flex items-center gap-2.5 group"
                            >
                                <Zap className="w-5 h-5" />
                                Start learning for free
                                <motion.span
                                    className="inline-block"
                                    animate={{ x: [0, 3, 0] }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                >
                                    <ArrowRight className="w-5 h-5" />
                                </motion.span>
                            </Link>
                        </motion.div>
                        <Link
                            to="/login"
                            className="btn btn-lg btn-outline"
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
                style={{ borderTop: '1.5px solid var(--c-border-soft)' }}
            >
                <div className="max-w-5xl mx-auto">
                    {/* Section label */}
                    <motion.div
                        {...bounceUp}
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                        className="text-center mb-10"
                    >
                        <p
                            className="text-[11px] font-bold uppercase tracking-widest mb-3"
                            style={{ color: 'var(--c-primary)' }}
                        >
                            Everything you need
                        </p>
                        <h2
                            className="text-2xl font-black"
                            style={{ color: 'var(--c-text)', letterSpacing: '-0.03em' }}
                        >
                            Built for serious learners
                        </h2>
                    </motion.div>

                    <motion.div
                        variants={staggerContainer}
                        initial="initial"
                        whileInView="animate"
                        viewport={{ once: true, amount: 0.2 }}
                        className="grid grid-cols-1 md:grid-cols-3 gap-5"
                    >
                        {FEATURES.map(({ icon: Icon, emoji, label, body, grad, light, textColor, shadow }) => (
                            <motion.div
                                key={label}
                                variants={staggerItemBouncy}
                                className="flex flex-col gap-4 p-6 rounded-3xl transition-all group"
                                style={{
                                    background: 'var(--c-surface)',
                                    border: '1.5px solid var(--c-border)',
                                    boxShadow: 'var(--shadow-sm)',
                                }}
                                whileHover={{
                                    y: -6, scale: 1.015,
                                    boxShadow: `${shadow}, var(--shadow-lg)`,
                                    transition: { type: 'spring', damping: 18, stiffness: 260 },
                                }}
                            >
                                {/* Icon */}
                                <motion.div
                                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                                    style={{ background: grad, boxShadow: shadow }}
                                    whileHover={{ rotate: [0, -8, 8, 0], scale: 1.08 }}
                                    transition={{ duration: 0.4 }}
                                >
                                    {emoji}
                                </motion.div>

                                <div>
                                    <p
                                        className="text-[15px] font-bold mb-1.5"
                                        style={{ color: 'var(--c-text)', letterSpacing: '-0.02em' }}
                                    >
                                        {label}
                                    </p>
                                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>
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
                className="py-14 px-6"
                style={{ borderTop: '1.5px solid var(--c-border-soft)' }}
            >
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    className="max-w-xl mx-auto relative rounded-3xl overflow-hidden px-8 py-10 text-center"
                    style={{ background: 'var(--grad-primary)', boxShadow: 'var(--shadow-brand-lg)' }}
                >
                    {/* Decorative orbs */}
                    <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10 pointer-events-none" />
                    <div className="absolute -bottom-4 -left-4 w-16 h-16 rounded-full bg-white/8 pointer-events-none" />

                    <div className="relative z-10">
                        <motion.div
                            className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-5 text-2xl"
                            animate={{ rotate: [0, 8, -8, 0] }}
                            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            🎓
                        </motion.div>
                        <h3
                            className="text-2xl font-black text-white mb-2"
                            style={{ letterSpacing: '-0.03em' }}
                        >
                            Ready to level up?
                        </h3>
                        <p className="text-white/70 text-sm mb-6">
                            Join students turning passive study sessions into active learning journeys.
                        </p>
                        <motion.div whileTap={{ scale: 0.94 }}>
                            <Link
                                to="/register"
                                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-[14px] font-bold bg-white text-purple-700 transition-all"
                                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.20)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)'; }}
                            >
                                <Sparkles className="w-4 h-4" />
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
