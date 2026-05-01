import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
    Plus, Search, BookOpen, Trash2, Edit3, MoreHorizontal,
    Sparkles, LayoutDashboard, LogOut, Layers, Brain, Zap,
    Clock, ChevronRight, BookMarked, X, Shield,
    FileText, FolderOpen, BarChart2,
} from 'lucide-react';
import { useSubjectStore } from '@/store/useSubjectStore';
import { useUIStore } from '@/store/useUIStore';
import { useAuthStore } from '@/store/useAuthStore';
import { subjectService } from '@/features/subjects/services/SubjectService';
import { staggerContainer, staggerItemBouncy, slideDown, bounceUp, popIn,
         textRevealContainer, textRevealWord } from '@/utils/motion';
import { useCountUp } from '@/hooks/useCountUp';
import { useTilt } from '@/hooks/useTilt';

// ── Accent palette ─────────────────────────────────────────
const ACCENTS = [
    { bg: 'var(--grad-primary)',  light: 'var(--c-primary-ultra)', text: 'var(--c-primary)', shadow: 'var(--shadow-primary)', hex: '#7C5CFC' },
    { bg: 'var(--grad-warm)',     light: 'var(--c-coral-light)',   text: 'var(--c-coral)',   shadow: 'var(--shadow-coral)',   hex: '#FF6B6B' },
    { bg: 'var(--grad-cool)',     light: 'var(--c-teal-light)',    text: 'var(--c-teal)',    shadow: 'var(--shadow-teal)',    hex: '#0EB8D5' },
    { bg: 'var(--grad-success)',  light: 'var(--c-mint-light)',    text: 'var(--c-mint)',    shadow: 'var(--shadow-mint)',    hex: '#00C896' },
    { bg: 'var(--grad-sunset)',   light: 'var(--c-amber-light)',   text: 'var(--c-amber)',   shadow: 'var(--shadow-amber)',   hex: '#FFB020' },
    { bg: 'var(--grad-candy)',    light: 'var(--c-rose-light)',    text: 'var(--c-rose)',    shadow: 'var(--shadow-rose)',    hex: '#F43F5E' },
    { bg: 'var(--grad-ocean)',    light: 'var(--c-sky-light)',     text: 'var(--c-sky)',     shadow: 'var(--shadow-sky)',     hex: '#3BAAFF' },
    { bg: 'var(--grad-peach)',    light: 'var(--c-fuchsia-light)', text: 'var(--c-fuchsia)', shadow: 'var(--shadow-fuchsia)', hex: '#D946EF' },
];
const accentFor  = (id = '') => ACCENTS[(id.charCodeAt(0) || 0) % ACCENTS.length];
const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
};
// ── Floating decoration orbs ────────────────────────────────
const Orb = ({ style, delay = 0, size = 80, opacity = 0.12 }) => (
    <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{ width: size, height: size, ...style, opacity }}
        animate={{ y: [0, -18, 0], x: [0, 8, 0] }}
        transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
);

const timeSince = (dateStr) => {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d > 0) return `${d}d ago`;
    if (h > 0) return `${h}h ago`;
    if (m > 0) return `${m}m ago`;
    return 'Just now';
};

// ── SubjectCard — with 3D tilt + glow halo ─────────────────
const SubjectCard = React.memo(({ subject, onDelete, onRename }) => {
    const navigate  = useNavigate();
    const accent    = accentFor(subject.id);
    const [menu, setMenu] = useState(false);
    const menuRef   = useRef(null);
    const since     = timeSince(subject.last_activity_at || subject.updated_at);
    const { ref: tiltRef, onMouseMove, onMouseLeave } = useTilt(7, 200);

    useEffect(() => {
        if (!menu) return;
        const h = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [menu]);

    return (
        <motion.div
            ref={tiltRef}
            variants={staggerItemBouncy}
            layout
            className="group relative flex flex-col rounded-[24px] overflow-hidden cursor-pointer transition-all duration-300"
            style={{
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border-strong)',
                boxShadow: 'var(--shadow-xs)',
                transformStyle: 'preserve-3d',
                willChange: 'transform',
            }}
            onMouseMove={onMouseMove}
            onMouseLeave={(e) => {
                onMouseLeave(e);
                e.currentTarget.style.boxShadow = 'var(--shadow-xs)';
                e.currentTarget.style.borderColor = 'var(--c-border-strong)';
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 12px 30px ${accent.hex}15, var(--shadow-md)`;
                e.currentTarget.style.borderColor = accent.hex + '40';
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/subjects/${subject.id}`)}
        >
            {/* Cursor-tracking glow overlay */}
            <div className="glow-overlay" />

            {/* Gradient top band - thinner, elegant */}
            <div className="h-[4px] w-full flex-shrink-0" style={{ background: accent.bg }} />

            {/* Body */}
            <div className="flex flex-col flex-1 p-5 gap-4">
                <div className="flex items-start justify-between gap-2">
                    <motion.div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: accent.light }}
                        whileHover={{
                            rotate: [0, -8, 8, -4, 0],
                            scale: 1.15,
                            transition: { duration: 0.5, type: 'spring', damping: 10 }
                        }}
                    >
                        <BookOpen className="w-6 h-6" style={{ color: accent.text }} />
                    </motion.div>

                    {/* Context menu */}
                    <div ref={menuRef} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <motion.button
                            whileTap={{ scale: 0.88 }}
                            onClick={() => setMenu(v => !v)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                            style={{ color: 'var(--c-text-muted)', background: 'var(--c-surface-alt)' }}
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </motion.button>
                        <AnimatePresence>
                            {menu && (
                                <motion.div
                                    {...popIn}
                                    className="absolute right-0 top-9 z-20 w-40 rounded-2xl overflow-hidden py-1"
                                    style={{
                                        background: 'var(--c-surface)',
                                        border: '1.5px solid var(--c-border)',
                                        boxShadow: 'var(--shadow-xl)',
                                    }}
                                >
                                    <button
                                        onClick={() => { onRename(subject); setMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-left transition-colors"
                                        style={{ color: 'var(--c-text)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-alt)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                        Rename
                                    </button>
                                    <button
                                        onClick={() => { onDelete(subject.id); setMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-left transition-colors"
                                        style={{ color: 'var(--c-danger)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-danger-light)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <h3
                        className="font-bold text-[18px] leading-tight mb-2 truncate tracking-tight"
                        style={{ color: 'var(--c-text)' }}
                    >
                        {subject.name}
                    </h3>
                    {subject.description && (
                        <p className="text-[13px] line-clamp-2 leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>
                            {subject.description}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <div
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ background: accent.light, color: accent.text }}
                    >
                        <Layers className="w-3 h-3" />
                        {subject.material_count ?? 0} items
                    </div>
                    {since && (
                        <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--c-text-placeholder)' }}>
                            <Clock className="w-3 h-3" />
                            {since}
                        </div>
                    )}
                </div>
            </div>

            {/* Hover CTA arrow */}
            <motion.div
                className="absolute bottom-4 right-4 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: accent.bg, boxShadow: `0 4px 12px ${accent.hex}50` }}
            >
                <ChevronRight className="w-3.5 h-3.5 text-white" />
            </motion.div>
        </motion.div>
    );
});
SubjectCard.displayName = 'SubjectCard';

// ── Add card — magnetic pull ────────────────────────────────
const AddCard = ({ onClick }) => {
    const cardRef = useRef(null);
    const iconRef = useRef(null);
    const prefersReduced = useReducedMotion();

    const handleMouseMove = useCallback((e) => {
        if (prefersReduced || !cardRef.current || !iconRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const dy = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
        iconRef.current.style.transform = `translate(${dx * 6}px, ${dy * 6}px)`;
        iconRef.current.style.transition = 'transform 0.1s linear';
    }, [prefersReduced]);

    const handleMouseLeave = useCallback(() => {
        if (!iconRef.current) return;
        iconRef.current.style.transform = 'translate(0, 0)';
        iconRef.current.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
    }, []);

    return (
        <motion.button
            ref={cardRef}
            variants={staggerItemBouncy}
            layout
            whileHover={{ y: -2, transition: { type: 'spring', damping: 18, stiffness: 260 } }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="flex flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed transition-all group min-h-[180px]"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-canvas)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-primary)'; e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--c-primary)'; e.currentTarget.style.background = 'var(--c-surface)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--c-border-strong)'; e.currentTarget.style.background = 'var(--c-canvas)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
            <motion.div
                ref={iconRef}
                className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                style={{ background: 'var(--c-surface)', color: 'var(--c-text-muted)', border: '1px solid var(--c-border-soft)', boxShadow: 'var(--shadow-xs)' }}
                whileHover={{ rotate: 90, scale: 1.05 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200 }}
            >
                <Plus className="w-5 h-5" />
            </motion.div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--c-text-secondary)' }}>Create new subject</span>
        </motion.button>
    );
};

// ── Animated greeting — word-by-word stagger ───────────────
const AnimatedGreeting = ({ greeting, isDark = false }) => {
    const words = `${greeting}`.split(' ');
    const textColor = isDark ? 'white' : 'var(--c-text)';
    return (
        <motion.h1
            variants={textRevealContainer}
            initial="initial"
            animate="animate"
            className="text-[1.75rem] sm:text-[2.25rem] font-extrabold mb-2 flex flex-wrap gap-x-[0.3em]"
            style={{ color: textColor, letterSpacing: '-0.02em', perspective: '400px', fontWeight: 800 }}
        >
            {words.map((word, i) => (
                <motion.span 
                    key={i} 
                    variants={textRevealWord} 
                    style={{ display: 'inline-block' }}
                    className={i === words.length - 1 ? 'text-gradient-hero' : ''}
                >
                    {word}
                </motion.span>
            ))}
        </motion.h1>
    );
};

// ── Animated stat — magazine/editorial style ────────────────
const AnimatedStat = ({ value, label, icon: Icon, color, bg }) => {
    const displayed = useCountUp(value, 800);
    return (
        <div className="flex flex-col gap-3 p-4 rounded-2xl relative overflow-hidden group hover-lift" style={{ background: 'var(--c-surface)', border: `1px solid ${bg}`, boxShadow: 'var(--shadow-xs)' }}>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 rounded-full opacity-0 group-hover:opacity-20 pointer-events-none transition-opacity duration-500" style={{ background: bg }} />
            <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold uppercase tracking-wider relative z-10" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
                <div className="p-1.5 rounded-[10px] relative z-10" style={{ background: bg }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
            </div>
            <motion.span
                key={value}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 18, stiffness: 220 }}
                className="text-[28px] font-black leading-none font-serif tracking-tight relative z-10"
                style={{ color: 'var(--c-text)' }}
            >
                {displayed}
            </motion.span>
        </div>
    );
};

// ── Dashboard ──────────────────────────────────────────────
const Dashboard = () => {
    const navigate       = useNavigate();
    const user           = useAuthStore(s => s.data.user);
    const logout         = useAuthStore(s => s.actions.logout);
    const subjects       = useSubjectStore(s => s.data.subjects);
    const storeError     = useSubjectStore(s => s.error);
    const fetchSubjects  = useSubjectStore(s => s.actions.fetchSubjects);
    const createSubject  = useSubjectStore(s => s.actions.createSubject);
    const loadingState   = useUIStore(s => s.data.loadingStates['subjects']);
    const loading        = loadingState?.loading ?? false;

    const [search, setSearch]            = useState('');
    const [showAdd, setShowAdd]          = useState(false);
    const [newName, setNewName]          = useState('');
    const [newDesc, setNewDesc]          = useState('');
    const [creating, setCreating]        = useState(false);
    const [renameTarget, setRenameTarget]= useState(null);
    const [renameName, setRenameName]    = useState('');
    const [renaming, setRenaming]        = useState(false);
    const [deleteError, setDeleteError]  = useState(null);
    const addInputRef                    = useRef(null);

    useEffect(() => { fetchSubjects(); }, [fetchSubjects]);
    useEffect(() => { if (showAdd) setTimeout(() => addInputRef.current?.focus(), 80); }, [showAdd]);

    const filtered = subjects.filter(s =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.description?.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            await createSubject(newName.trim(), newDesc.trim());
            setNewName(''); setNewDesc(''); setShowAdd(false);
        } finally { setCreating(false); }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this subject? This cannot be undone.')) return;
        try {
            await subjectService.delete(id);
            await fetchSubjects();
        } catch (e) {
            setDeleteError(e.message || 'Failed to delete subject');
        }
    };

    const handleRename = async () => {
        if (!renameName.trim() || !renameTarget) return;
        setRenaming(true);
        try {
            await subjectService.rename(renameTarget.id, renameName.trim());
            await fetchSubjects();
            setRenameTarget(null); setRenameName('');
        } finally { setRenaming(false); }
    };

    const error = storeError || deleteError;

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    const isActivePath = (p) => window.location.pathname === p;

    const totalMaterials = subjects.reduce((a, s) => a + (s.material_count ?? 0), 0);

    return (
        <div className="flex h-[calc(100vh-58px)] overflow-hidden" style={{ background: 'var(--c-surface)' }}>

            {/* ── Sidebar ── */}
            <aside
                className="hidden lg:flex flex-col w-80 flex-shrink-0 overflow-hidden pt-4 pb-8"
                style={{ background: 'var(--c-canvas)', borderRight: '1px solid var(--c-border-soft)' }}
            >
                {/* User */}
                <div className="p-4">
                    <Link to="/profile">
                        <motion.div
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center gap-3 p-3 rounded-2xl transition-colors cursor-pointer"
                            style={{ background: 'var(--c-canvas)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-primary-ultra)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'var(--c-canvas)'}
                        >
                            <motion.div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-black text-white flex-shrink-0"
                                style={{ background: 'var(--grad-primary)', boxShadow: 'var(--shadow-primary)' }}
                                whileHover={{ scale: 1.1, rotate: 5 }}
                                transition={{ type: 'spring', damping: 12, stiffness: 260 }}
                            >
                                {initials}
                            </motion.div>
                            <div className="min-w-0">
                                <p className="text-[15px] font-bold truncate" style={{ color: 'var(--c-text)' }}>
                                    {user?.name || 'Student'}
                                </p>
                                <p className="text-[12px] truncate" style={{ color: 'var(--c-text-muted)' }}>
                                    {user?.email || ''}
                                </p>
                            </div>
                        </motion.div>
                    </Link>
                </div>

                {/* Nav — with layoutId animated pill */}
                <nav className="px-3 flex flex-col gap-0.5 relative">
                    {[
                        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
                        { label: 'Analytics', path: '/analytics',  icon: BarChart2 },
                    ].map(item => {
                        const active = isActivePath(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className="relative flex items-center gap-3 px-4 py-3 rounded-xl text-[15px] font-bold transition-all"
                                style={{
                                    color: active ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                    border: '1.5px solid transparent',
                                }}
                            >
                                {active && (
                                    <motion.span
                                        layoutId="sidebar-pill"
                                        className="absolute inset-0 rounded-xl"
                                        style={{ background: 'var(--c-primary-ultra)', border: '1.5px solid var(--c-primary-light)' }}
                                        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                                    />
                                )}
                                <item.icon className="w-4 h-4 relative z-10" />
                                <span className="relative z-10">{item.label}</span>
                            </Link>
                        );
                    })}
                    {user?.role === 'admin' && (
                        <Link
                            to="/admin"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                            style={{ color: 'var(--c-text-muted)', border: '1.5px solid transparent' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-rose-light)'; e.currentTarget.style.color = 'var(--c-rose)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-muted)'; }}
                        >
                            <Shield className="w-4 h-4" />
                            Admin
                        </Link>
                    )}
                </nav>

                <div className="mx-4 my-3 h-px" style={{ background: 'var(--c-border-soft)' }} />

                {/* Animated Stats */}
                <div className="px-4 grid grid-cols-2 gap-2">
                    <AnimatedStat
                        value={subjects.length}
                        label="Subjects"
                        icon={FolderOpen}
                        color="var(--c-primary)"
                        bg="var(--c-primary-ultra)"
                    />
                    <AnimatedStat
                        value={totalMaterials}
                        label="Materials"
                        icon={FileText}
                        color="var(--c-teal)"
                        bg="var(--c-teal-light)"
                    />
                </div>

                {/* Recent */}
                {subjects.length > 0 && (
                    <div className="px-4 mt-3 flex-1 overflow-hidden">
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--c-text-placeholder)' }}>
                            Recent
                        </p>
                        <div className="flex flex-col gap-0.5">
                            {subjects.slice(0, 5).map((s, i) => {
                                const acc = accentFor(s.id);
                                return (
                                    <motion.button
                                        key={s.id}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05, type: 'spring', damping: 20, stiffness: 260 }}
                                        onClick={() => navigate(`/subjects/${s.id}`)}
                                        className="flex items-center gap-2.5 px-2 py-2 rounded-xl text-[12px] font-medium text-left transition-all w-full"
                                        style={{ color: 'var(--c-text-secondary)' }}
                                        whileHover={{ x: 3 }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-surface-alt)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-secondary)'; }}
                                    >
                                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: acc.bg }} />
                                        <span className="truncate">{s.name}</span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex-1" />

                {/* Sign out */}
                <div className="p-3 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
                    <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { logout(); navigate('/login'); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all"
                        style={{ color: 'var(--c-text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-danger-light)'; e.currentTarget.style.color = 'var(--c-danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text-muted)'; }}
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign out
                    </motion.button>
                </div>
            </aside>

            {/* ── Main ── */}
            <main className="relative flex-1 overflow-y-auto custom-scrollbar" style={{ background: 'var(--c-surface)', borderTopLeftRadius: '32px', fontSize: '20px', zoom: 1.1, boxShadow: '-4px 0 32px rgba(0,0,0,0.03)' }}>
                
                {/* Background decoration orbs — fixed in the viewport of the main element */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <Orb style={{ background: 'var(--grad-primary)', top: '15%', left: '5%' }} size={160} delay={0} opacity={0.07} />
                    <Orb style={{ background: 'var(--grad-candy)', top: '10%', right: '8%' }} size={120} delay={1.5} opacity={0.06} />
                    <Orb style={{ background: 'var(--grad-cool)', bottom: '25%', left: '12%' }} size={90} delay={2.5} opacity={0.05} />
                    <Orb style={{ background: 'var(--grad-warm)', bottom: '15%', right: '6%' }} size={140} delay={1} opacity={0.07} />
                    <Orb style={{ background: 'var(--grad-ocean)', top: '50%', left: '45%' }} size={200} delay={2} opacity={0.04} />
                </div>

                <div className="relative z-10 max-w-[1440px] mx-auto px-10 py-10">

                    {/* Hero greeting banner — Soft, welcoming, editorial */}
                    <motion.div
                        {...slideDown}
                        className="relative rounded-[32px] overflow-hidden mb-12 px-12 py-14 flex flex-col md:flex-row md:items-center justify-between gap-8 bg-white group"
                        style={{ 
                            border: '1px solid var(--c-border-strong)',
                            boxShadow: 'var(--shadow-sm)',
                        }}
                    >
                        {/* Interactive border glow — the "pop of color" */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                            <div className="absolute inset-[-1px] rounded-[32px] border border-transparent" 
                                 style={{ background: 'var(--grad-primary)', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'exclude', padding: '1px' }} />
                        </div>
                        {/* Ambient orb layer — very subtle */}
                        <div
                            className="ambient-orb ambient-orb-md ambient-orb-1"
                            style={{ background: 'var(--c-primary)', top: '-40px', right: '0px', opacity: 0.15 }}
                        />
                        <div
                            className="ambient-orb ambient-orb-sm ambient-orb-2"
                            style={{ background: 'var(--c-coral)', bottom: '-20px', left: '10%', opacity: 0.12 }}
                        />

                        <div className="relative z-10">
                            <AnimatedGreeting
                                greeting={getGreeting()}
                                isDark={false}
                            />

                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.35 }}
                                className="text-sm font-medium mt-1"
                                style={{ color: 'var(--c-text-secondary)' }}
                            >
                                {subjects.length > 0
                                    ? `You have ${subjects.length} subject${subjects.length !== 1 ? 's' : ''} in your workspace.`
                                    : 'Create your first subject to begin building your workspace.'}
                            </motion.p>
                        </div>
                        
                        <motion.div
                            className="relative z-10 w-16 h-16 rounded-[20px] hidden md:flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border-strong)', boxShadow: 'var(--shadow-sm)' }}
                            animate={{ rotate: [0, 5, -5, 0], y: [0, -4, 0] }}
                            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <Brain className="w-8 h-8" style={{ color: 'var(--c-primary)' }} />
                        </motion.div>
                    </motion.div>

                    {/* Toolbar */}
                    <motion.div {...slideDown} transition={{ delay: 0.05 }} className="flex items-center gap-3 mb-6">
                        <div className="relative flex-1 max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--c-text-placeholder)' }} />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search subjects…"
                                className="input-field pl-9 h-9 text-[13px]"
                            />
                        </div>
                        <div className="flex-1" />
                        <motion.button
                            whileTap={{ scale: 0.94 }}
                            onClick={() => setShowAdd(v => !v)}
                            className="btn btn-md btn-solid flex items-center gap-2"
                        >
                            <motion.span animate={{ rotate: showAdd ? 45 : 0 }} transition={{ type: 'spring', damping: 14, stiffness: 220 }}>
                                <Plus className="w-4 h-4" />
                            </motion.span>
                            New Subject
                        </motion.button>
                    </motion.div>

                    {/* Add form */}
                    <AnimatePresence>
                        {showAdd && (
                            <motion.div
                                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                                className="overflow-hidden"
                            >
                                <div
                                    className="rounded-3xl p-5"
                                    style={{
                                        background: 'var(--c-surface)',
                                        border: '2px solid var(--c-primary-light)',
                                        boxShadow: 'var(--shadow-brand)',
                                    }}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--grad-primary)', boxShadow: 'var(--shadow-primary)' }}>
                                                <Sparkles className="w-4 h-4 text-white" />
                                            </div>
                                            <span className="text-[14px] font-bold" style={{ color: 'var(--c-text)' }}>Create Subject</span>
                                        </div>
                                        <button
                                            onClick={() => setShowAdd(false)}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                                            style={{ color: 'var(--c-text-muted)' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-alt)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="flex gap-3">
                                        <input
                                            ref={addInputRef}
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                            placeholder="Subject name (e.g. Organic Chemistry)"
                                            className="input-field flex-1"
                                        />
                                        <input
                                            value={newDesc}
                                            onChange={e => setNewDesc(e.target.value)}
                                            placeholder="Short description (optional)"
                                            className="input-field flex-1 hidden sm:block"
                                        />
                                        <motion.button
                                            whileTap={{ scale: 0.93 }}
                                            onClick={handleCreate}
                                            disabled={!newName.trim() || creating}
                                            className="btn btn-md btn-solid flex-shrink-0 flex items-center gap-2"
                                        >
                                            {creating ? (
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                                                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                                                />
                                            ) : (<><Zap className="w-4 h-4" />Create</>)}
                                        </motion.button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 px-4 py-3 rounded-2xl text-sm font-medium" style={{ background: 'var(--c-danger-light)', color: 'var(--c-danger)', border: '1px solid rgba(239,68,68,0.15)' }}>
                            {error}
                        </div>
                    )}

                    {/* Loading skeletons — staggered */}
                    {loading && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {[1,2,3,4,5,6].map((i) => (
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.06, type: 'spring', damping: 20 }}
                                    className="rounded-3xl overflow-hidden"
                                    style={{ height: 190, background: 'var(--c-surface)', border: '1.5px solid var(--c-border)', boxShadow: 'var(--shadow-xs)' }}
                                >
                                    <div className="h-[6px] anim-skeleton" />
                                    <div className="p-5 flex flex-col gap-3">
                                        <div className="w-12 h-12 rounded-2xl anim-skeleton" />
                                        <div className="h-4 rounded-lg anim-skeleton w-3/4" />
                                        <div className="h-3 rounded-lg anim-skeleton w-1/2" />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Grid */}
                    {!loading && (
                        <motion.div
                            variants={staggerContainer}
                            initial="initial"
                            animate="animate"
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                        >
                            {filtered.map(subject => (
                                <SubjectCard
                                    key={subject.id}
                                    subject={subject}
                                    onDelete={handleDelete}
                                    onRename={s => { setRenameTarget(s); setRenameName(s.name); }}
                                />
                            ))}
                            {!search && <AddCard onClick={() => setShowAdd(true)} />}
                        </motion.div>
                    )}

                    {/* Empty state */}
                    {!loading && subjects.length === 0 && (
                        <motion.div {...bounceUp} className="flex flex-col items-center justify-center text-center py-20">
                            <motion.div
                                className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 relative group"
                                style={{ background: 'var(--c-canvas)', border: '1px solid var(--c-border-strong)' }}
                                animate={{ y: [0, -6, 0] }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <BookMarked className="w-10 h-10" style={{ color: 'var(--c-text-muted)' }} />
                            </motion.div>
                            <h2 className="text-[26px] font-black mb-2 font-serif" style={{ color: 'var(--c-text)', letterSpacing: '-0.02em' }}>
                                Your learning space awaits
                            </h2>
                            <p className="text-sm mb-8 max-w-sm leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>
                                Create your first subject to start uploading materials and generating AI-powered study tools.
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setShowAdd(true)}
                                className="btn btn-lg btn-solid flex items-center gap-2"
                            >
                                <Sparkles className="w-4 h-4" />
                                Create your first subject
                            </motion.button>
                        </motion.div>
                    )}

                    {!loading && subjects.length > 0 && filtered.length === 0 && search && (
                        <motion.div {...bounceUp} className="flex flex-col items-center py-20 text-center">
                            <Search className="w-12 h-12 mb-4 opacity-20" style={{ color: 'var(--c-text-muted)' }} />
                            <p className="text-base font-semibold" style={{ color: 'var(--c-text-muted)' }}>
                                No subjects match "{search}"
                            </p>
                        </motion.div>
                    )}
                </div>
            </main>

            {/* ── Rename modal ── */}
            <AnimatePresence>
                {renameTarget && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => setRenameTarget(null)}
                            className="fixed inset-0 z-50"
                            style={{ background: 'rgba(13,11,30,0.5)', backdropFilter: 'blur(8px)' }}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div
                                className="bg-white rounded-3xl p-6 w-full max-w-sm pointer-events-auto"
                                style={{ boxShadow: 'var(--shadow-2xl)' }}
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="flex items-center gap-2 mb-5">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--c-primary-ultra)', color: 'var(--c-primary)' }}>
                                        <Edit3 className="w-4 h-4" />
                                    </div>
                                    <span className="font-bold text-[15px]" style={{ color: 'var(--c-text)' }}>Rename Subject</span>
                                </div>
                                <input
                                    autoFocus
                                    value={renameName}
                                    onChange={e => setRenameName(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameTarget(null); }}
                                    className="input-field w-full mb-4"
                                    placeholder="New name…"
                                />
                                <div className="flex gap-2 justify-end">
                                    <button onClick={() => setRenameTarget(null)} className="btn btn-sm btn-outline">Cancel</button>
                                    <motion.button
                                        whileTap={{ scale: 0.93 }}
                                        onClick={handleRename}
                                        disabled={!renameName.trim() || renaming}
                                        className="btn btn-sm btn-solid"
                                    >
                                        {renaming ? 'Saving…' : 'Save'}
                                    </motion.button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default Dashboard;
