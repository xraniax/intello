import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Search, Sparkles, LayoutDashboard, LogOut,
    Zap, X, Shield, FileText, FolderOpen, BarChart2, Brain, ChevronRight, BookMarked, Trash2, Target
} from 'lucide-react';
import { useSubjectStore } from '@/store/useSubjectStore';
import { useUIStore } from '@/store/useUIStore';
import { useAuthStore } from '@/store/useAuthStore';
import { subjectService } from '@/features/subjects/services/SubjectService';
import { staggerContainer, staggerItemBouncy, slideDown, bounceUp } from '@/utils/motion';
import { ACCENTS, accentFor, getGreeting } from './dashboard/dashboardUtils';
import Orb from './dashboard/Orb';
import SubjectCard from './dashboard/SubjectCard';
import AddCard from './dashboard/AddCard';
import AnimatedGreeting from './dashboard/AnimatedGreeting';
import AnimatedStat from './dashboard/AnimatedStat';
import RenameModal from './dashboard/RenameModal';

const Dashboard = () => {
    const navigate       = useNavigate();
    const user           = useAuthStore(s => s.data.user);
    const logout         = useAuthStore(s => s.actions.logout);
    const subjects       = useSubjectStore(s => s.data.subjects);
    const storeError     = useSubjectStore(s => s.error);
    const fetchSubjects  = useSubjectStore(s => s.actions.fetchSubjects);
    const createSubject  = useSubjectStore(s => s.actions.createSubject);
    const updateSubject  = useSubjectStore(s => s.actions.updateSubject);
    const loadingState   = useUIStore(s => s.data.loadingStates['subjects']);
    const loading        = loadingState?.loading ?? false;
    const setModal       = useUIStore(s => s.actions.setModal);

    const isGuest = !user;

    const [search, setSearch]            = useState('');
    const [showAdd, setShowAdd]          = useState(false);
    const [newName, setNewName]          = useState('');
    const [newDesc, setNewDesc]          = useState('');
    const [creating, setCreating]        = useState(false);
    const [renameTarget, setRenameTarget]= useState(null);
    const [deleteError, setDeleteError]  = useState(null);
    const addInputRef                    = useRef(null);
    const sidebarRef                     = useRef(null);

    useEffect(() => { if (!isGuest) fetchSubjects(); }, [fetchSubjects, isGuest]);
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

    const error = storeError || deleteError;

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '✦';

    const requireAuth = (action) => {
        if (isGuest) {
            setModal('authPrompt');
            return true;
        }
        return false;
    };

    const isActivePath = (p) => window.location.pathname === p;
    const totalMaterials = subjects.reduce((a, s) => a + (s.material_count ?? 0), 0);

    const handleSidebarMouseMove = (e) => {
        if (!sidebarRef.current) return;
        const rect = sidebarRef.current.getBoundingClientRect();
        sidebarRef.current.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
        sidebarRef.current.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
        sidebarRef.current.style.setProperty('--glow-opacity', '1');
    };

    const handleSidebarMouseLeave = () => {
        if (!sidebarRef.current) return;
        sidebarRef.current.style.setProperty('--glow-opacity', '0');
    };

    return (
        <div className="flex h-[calc(100vh-58px)] overflow-hidden" style={{ background: 'var(--c-surface)' }}>

            {/* ── Sidebar ── */}
            <aside
                ref={sidebarRef}
                onMouseMove={handleSidebarMouseMove}
                onMouseLeave={handleSidebarMouseLeave}
                className="hidden lg:flex flex-col w-80 flex-shrink-0 overflow-hidden pt-4 pb-8 relative group/sidebar glass-panel"
                style={{
                    background: 'rgba(250, 250, 250, 0.4)',
                    borderRight: '1px solid var(--c-border-soft)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                }}
            >
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60 group-hover/sidebar:opacity-100 transition-opacity duration-1000">
                    <Orb style={{ background: 'var(--c-primary)', top: '-2%', left: '-30px' }} size={150} delay={0} opacity={0.1} />
                    <Orb style={{ background: 'var(--grad-candy)', top: '35%', right: '-50px' }} size={180} delay={2} opacity={0.08} />
                    <Orb style={{ background: 'var(--grad-aurora)', bottom: '10%', left: '-20px' }} size={160} delay={4} opacity={0.07} />
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white/40 to-transparent" />
                </div>

                <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                    style={{
                        background: 'radial-gradient(400px circle at var(--glow-x, 0) var(--glow-y, 0), rgba(124, 92, 252, 0.04), transparent 80%)',
                        opacity: 'var(--glow-opacity, 0)'
                    }}
                />

                {/* User Card */}
                <div className="p-4 relative z-10">
                    <Link to="/profile">
                        <motion.div
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            className="flex items-center gap-3 p-4 rounded-3xl transition-all cursor-pointer border border-white/60 shadow-lg hover:shadow-2xl hover:shadow-indigo-100/50 group/user"
                            style={{ background: 'rgba(255, 255, 255, 0.65)', backdropFilter: 'blur(12px)' }}
                        >
                            <motion.div
                                className="w-11 h-11 rounded-2xl flex items-center justify-center text-[15px] font-black text-white flex-shrink-0"
                                style={{ background: 'var(--grad-primary)', boxShadow: '0 8px 16px rgba(124, 92, 252, 0.25)' }}
                                whileHover={{ rotate: [0, 10, -10, 0], scale: 1.1 }}
                                transition={{ type: 'spring', damping: 12, stiffness: 260 }}
                            >
                                {initials}
                            </motion.div>
                            <div className="min-w-0">
                                <p className="text-[16px] font-extrabold truncate leading-tight group-hover/user:text-indigo-600 transition-colors" style={{ color: 'var(--c-text)' }}>
                                    {user?.name || 'Guest Explorer'}
                                </p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className={`w-1.5 h-1.5 rounded-full ${isGuest ? 'bg-amber-400' : 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`} />
                                    <p className="text-[10px] font-black uppercase tracking-wider opacity-60" style={{ color: 'var(--c-text-muted)' }}>
                                        {isGuest ? 'Guest' : 'Online'}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </Link>
                </div>

                {/* Nav */}
                <nav className="px-3 mt-2 flex flex-col gap-1 relative z-10">
                    {[
                        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, accent: ACCENTS[0] },
                        { label: 'Goals', path: '/goals', icon: Target, accent: ACCENTS[1] },
                        { label: 'Analytics', path: '/analytics',  icon: BarChart2, accent: ACCENTS[2] },
                        { label: 'Trash', path: '/trash', icon: Trash2, accent: ACCENTS[5] },
                    ].map(item => {
                        const active = isActivePath(item.path);
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className="relative flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[15px] font-bold transition-all group/nav"
                                style={{ color: active ? item.accent.text : 'var(--c-text-muted)' }}
                            >
                                {active && (
                                    <motion.span
                                        layoutId="sidebar-pill"
                                        className="absolute inset-0 rounded-2xl"
                                        style={{
                                            background: `linear-gradient(135deg, ${item.accent.light}, #ffffff)`,
                                            border: '1.5px solid white',
                                            boxShadow: `0 8px 20px ${item.accent.hex}15`
                                        }}
                                        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                                    />
                                )}
                                <motion.div
                                    whileHover={{ rotate: [0, -15, 15, 0], scale: 1.25 }}
                                    transition={{ duration: 0.4, type: 'spring' }}
                                    className="relative z-10"
                                    style={{ color: active ? item.accent.text : 'inherit' }}
                                >
                                    <item.icon className="w-5 h-5 transition-transform group-hover/nav:scale-110" />
                                </motion.div>
                                <span className="relative z-10 font-extrabold group-hover/nav:translate-x-1 transition-transform tracking-tight">{item.label}</span>
                                {active && (
                                    <motion.div
                                        layoutId="active-dot"
                                        className="ml-auto w-1.5 h-1.5 rounded-full relative z-10"
                                        style={{ background: item.accent.bg }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                    {user?.role === 'admin' && (
                        <Link
                            to="/admin"
                            className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[14px] font-bold transition-all hover:bg-rose-50 hover:text-rose-600 group/admin"
                            style={{ color: 'var(--c-text-muted)' }}
                        >
                            <motion.div whileHover={{ rotate: 180, scale: 1.2 }} transition={{ type: 'spring' }}>
                                <Shield className="w-5 h-5 group-hover:text-rose-500" />
                            </motion.div>
                            <span className="font-extrabold tracking-tight">Admin Center</span>
                        </Link>
                    )}
                </nav>

                <div className="mx-6 my-4 h-[2px] opacity-20" style={{ background: 'var(--c-border-soft)' }} />

                {/* Stats */}
                <div className="px-4 grid grid-cols-2 gap-3 relative z-10">
                    <AnimatedStat value={subjects.length} label="Grown" icon={FolderOpen} color="var(--c-primary)" bg="var(--c-primary-ultra)" />
                    <AnimatedStat value={totalMaterials} label="Seeds" icon={FileText} color="var(--c-teal)" bg="var(--c-teal-light)" />
                </div>

                {/* Recent subjects */}
                {subjects.length > 0 && (
                    <div className="px-4 mt-6 flex-1 overflow-hidden relative z-10">
                        <div className="flex items-center justify-between mb-3 px-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50" style={{ color: 'var(--c-text-secondary)' }}>
                                Recent Garden
                            </p>
                            <div className="w-4 h-[1px] bg-indigo-100" />
                        </div>
                        <div className="flex flex-col gap-2">
                            {subjects.slice(0, 4).map((s, i) => {
                                const acc = accentFor(s.id);
                                return (
                                    <motion.button
                                        key={s.id}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.08, type: 'spring', damping: 20, stiffness: 260 }}
                                        onClick={() => navigate(`/subjects/${s.id}`)}
                                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-[13px] font-bold text-left transition-all w-full border border-transparent hover:border-white hover:bg-white hover:shadow-xl hover:shadow-indigo-50/50 group/recent relative overflow-hidden"
                                        style={{ color: 'var(--c-text-secondary)' }}
                                        whileHover={{ x: 5 }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/0 group-hover:to-white/100 pointer-events-none transition-all" />
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-[2] transition-all duration-300 relative z-10"
                                             style={{ background: acc.bg, boxShadow: `0 0 12px ${acc.hex}60` }} />
                                        <span className="truncate group-hover:text-indigo-600 transition-colors relative z-10">{s.name}</span>
                                        <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 relative z-10" style={{ color: acc.hex }} />
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex-1" />

                {/* Sign out */}
                <div className="p-4 relative z-10">
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => { logout(); navigate('/login'); }}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-2xl text-[12px] font-black uppercase tracking-widest transition-all text-gray-400 hover:text-rose-500 hover:bg-rose-50 border-2 border-transparent hover:border-rose-100"
                    >
                        <LogOut className="w-4 h-4" />
                        Disconnect
                    </motion.button>
                </div>
            </aside>

            {/* ── Main ── */}
            <main className="relative flex-1 overflow-y-auto custom-scrollbar" style={{ background: 'var(--c-surface)', borderTopLeftRadius: '32px', fontSize: '20px', zoom: 1.1, boxShadow: '-4px 0 32px rgba(0,0,0,0.03)' }}>

                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <Orb style={{ background: 'var(--grad-primary)', top: '15%', left: '5%' }} size={160} delay={0} opacity={0.07} />
                    <Orb style={{ background: 'var(--grad-candy)', top: '10%', right: '8%' }} size={120} delay={1.5} opacity={0.06} />
                    <Orb style={{ background: 'var(--grad-cool)', bottom: '25%', left: '12%' }} size={90} delay={2.5} opacity={0.05} />
                    <Orb style={{ background: 'var(--grad-warm)', bottom: '15%', right: '6%' }} size={140} delay={1} opacity={0.07} />
                    <Orb style={{ background: 'var(--grad-ocean)', top: '50%', left: '45%' }} size={200} delay={2} opacity={0.04} />
                </div>

                <div className="relative z-10 max-w-[1440px] mx-auto px-10 py-10">

                    {/* Hero greeting banner */}
                    <motion.div
                        {...slideDown}
                        className="relative rounded-[32px] overflow-hidden mb-12 px-12 py-14 flex flex-col md:flex-row md:items-center justify-between gap-8 group"
                        style={{
                            background: 'linear-gradient(135deg, rgba(124,92,252,0.08) 0%, rgba(168,85,247,0.06) 50%, rgba(59,130,246,0.08) 100%)',
                            border: '1.5px solid rgba(124,92,252,0.2)',
                            boxShadow: '0 8px 32px rgba(124,92,252,0.1), inset 0 1px 0 rgba(255,255,255,0.4)',
                            backdropFilter: 'blur(12px)',
                        }}
                    >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                            <div className="absolute inset-[-1px] rounded-[32px] border border-transparent"
                                 style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7, #3b82f6)', mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'exclude', padding: '1px' }} />
                        </div>
                        <div className="ambient-orb ambient-orb-md ambient-orb-1" style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', top: '-40px', right: '0px', opacity: 0.2 }} />
                        <div className="ambient-orb ambient-orb-sm ambient-orb-2" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', bottom: '-20px', left: '10%', opacity: 0.15 }} />

                        <div className="relative z-10">
                            <AnimatedGreeting greeting={getGreeting()} isDark={false} />
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.35 }}
                                className="text-sm font-medium mt-1"
                                style={{ color: 'var(--c-text-secondary)' }}
                            >
                                {isGuest
                                    ? 'Sign up to create subjects, upload materials, and unlock AI-powered learning.'
                                    : subjects.length > 0
                                        ? `You have ${subjects.length} subject${subjects.length !== 1 ? 's' : ''} in your workspace.`
                                        : 'Create your first subject to begin building your workspace.'}
                            </motion.p>
                        </div>

                        <motion.div
                            className="relative z-10 w-16 h-16 rounded-[20px] hidden md:flex items-center justify-center flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', border: '1px solid rgba(124,92,252,0.3)', boxShadow: '0 8px 24px rgba(124,92,252,0.3)' }}
                            animate={{ rotate: [0, 8, -8, 0], y: [0, -6, 0], scale: [1, 1.05, 1] }}
                            transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <Brain className="w-8 h-8 text-white" />
                        </motion.div>
                    </motion.div>

                    {/* Toolbar */}
                    <motion.div {...slideDown} transition={{ delay: 0.05 }} className="flex items-center gap-3 mb-6">
                        <div className="relative flex-1 max-w-xs group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors group-focus-within:text-indigo-500" style={{ color: 'var(--c-text-placeholder)' }} />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search subjects…"
                                className="input-field pl-9 h-9 text-[13px] transition-all group-focus-within:ring-2 group-focus-within:ring-indigo-400"
                            />
                        </div>
                        <div className="flex-1" />
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => { if (!requireAuth()) setShowAdd(v => !v); }}
                            className="btn btn-md btn-solid flex items-center gap-2 relative overflow-hidden group"
                            style={{ background: 'linear-gradient(135deg, #7c5cfc 0%, #a855f7 100%)', boxShadow: '0 4px 15px rgba(124,92,252,0.3)' }}
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                                    className="rounded-3xl p-5 relative overflow-hidden"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(124,92,252,0.08) 0%, rgba(168,85,247,0.06) 100%)',
                                        border: '2px solid rgba(124,92,252,0.3)',
                                        boxShadow: '0 8px 32px rgba(124,92,252,0.15)',
                                        backdropFilter: 'blur(8px)',
                                    }}
                                >
                                    <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-purple-400/20 to-transparent rounded-full blur-3xl pointer-events-none" />
                                    <div className="flex items-center justify-between mb-4 relative z-10">
                                        <div className="flex items-center gap-2">
                                            <motion.div
                                                className="w-8 h-8 rounded-xl flex items-center justify-center"
                                                style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', boxShadow: '0 4px 12px rgba(124,92,252,0.4)' }}
                                                animate={{ rotate: [0, 360] }}
                                                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                                            >
                                                <Sparkles className="w-4 h-4 text-white" />
                                            </motion.div>
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
                                    <div className="flex gap-3 relative z-10">
                                        <input
                                            ref={addInputRef}
                                            value={newName}
                                            onChange={e => setNewName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                            placeholder="Subject name (e.g. Organic Chemistry)"
                                            className="input-field flex-1 focus:ring-indigo-400"
                                        />
                                        <input
                                            value={newDesc}
                                            onChange={e => setNewDesc(e.target.value)}
                                            placeholder="Short description (optional)"
                                            className="input-field flex-1 focus:ring-indigo-400"
                                        />
                                        <motion.button
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.93 }}
                                            onClick={handleCreate}
                                            disabled={!newName.trim() || creating}
                                            className="btn btn-md btn-solid flex-shrink-0 flex items-center gap-2 relative overflow-hidden group"
                                            style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', boxShadow: '0 4px 15px rgba(124,92,252,0.3)' }}
                                        >
                                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
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

                    {/* Loading skeletons */}
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

                    {/* Subject grid */}
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
                                    onRename={s => setRenameTarget(s)}
                                />
                            ))}
                            {!search && <AddCard onClick={() => { if (!requireAuth()) setShowAdd(true); }} />}
                        </motion.div>
                    )}

                    {/* Empty state */}
                    {!loading && subjects.length === 0 && (
                        <motion.div {...bounceUp} className="flex flex-col items-center justify-center text-center py-20">
                            <motion.div
                                className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6 relative group overflow-hidden"
                                style={{ background: 'linear-gradient(135deg, rgba(124,92,252,0.1), rgba(168,85,247,0.1))', border: '1.5px solid rgba(124,92,252,0.2)', boxShadow: '0 8px 32px rgba(124,92,252,0.1)' }}
                                animate={{ y: [0, -8, 0], scale: [1, 1.02, 1] }}
                                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 via-transparent to-indigo-400/20" />
                                <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
                                    <BookMarked className="w-10 h-10" style={{ color: 'var(--c-primary)' }} />
                                </motion.div>
                            </motion.div>
                            <h2 className="text-[26px] font-black mb-2 font-serif bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent" style={{ letterSpacing: '-0.02em' }}>
                                Your learning space awaits
                            </h2>
                            <p className="text-sm mb-8 max-w-sm leading-relaxed" style={{ color: 'var(--c-text-secondary)' }}>
                                Create your first subject to start uploading materials and generating AI-powered study tools.
                            </p>
                            <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.96 }}
                                onClick={() => setShowAdd(true)}
                                className="btn btn-lg btn-solid flex items-center gap-2 relative overflow-hidden group"
                                style={{ background: 'linear-gradient(135deg, #7c5cfc, #a855f7)', boxShadow: '0 8px 24px rgba(124,92,252,0.3)' }}
                            >
                                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <motion.span animate={{ rotate: [0, 360] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
                                    <Sparkles className="w-4 h-4" />
                                </motion.span>
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
            <RenameModal
                target={renameTarget}
                onClose={() => setRenameTarget(null)}
                onSave={async (name, desc) => {
                    await updateSubject(renameTarget.id, name, desc);
                    setRenameTarget(null);
                }}
            />
        </div>
    );
};

export default Dashboard;
