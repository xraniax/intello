import React, { useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    LayoutDashboard, Target, BarChart2, Trash2, Shield,
    LogOut, FileText, FolderOpen, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubjectStore } from '@/store/useSubjectStore';
import { ACCENTS, accentFor } from '@/pages/dashboard/dashboardUtils';
import Orb from '@/pages/dashboard/Orb';
import AnimatedStat from '@/pages/dashboard/AnimatedStat';
import logo from '@/assets/logo.png';

const NAV_ITEMS = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, accent: ACCENTS[0] },
    { label: 'Goals',     path: '/goals',     icon: Target,          accent: ACCENTS[1] },
    { label: 'Analytics', path: '/analytics', icon: BarChart2,        accent: ACCENTS[2] },
    { label: 'Trash',     path: '/trash',     icon: Trash2,           accent: ACCENTS[5] },
];

const MainLayout = ({ children }) => {
    const user     = useAuthStore(s => s.data.user);
    const logout   = useAuthStore(s => s.actions.logout);
    const subjects = useSubjectStore(s => s.data.subjects);
    const navigate = useNavigate();
    const location = useLocation();
    const sidebarRef = useRef(null);

    const isGuest = !user;
    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '✦';
    const totalMaterials = subjects.reduce((a, s) => a + (s.material_count ?? 0), 0);
    const isActive = (p) => location.pathname === p;

    const handleMouseMove = (e) => {
        if (!sidebarRef.current) return;
        const rect = sidebarRef.current.getBoundingClientRect();
        sidebarRef.current.style.setProperty('--glow-x', `${e.clientX - rect.left}px`);
        sidebarRef.current.style.setProperty('--glow-y', `${e.clientY - rect.top}px`);
        sidebarRef.current.style.setProperty('--glow-opacity', '1');
    };

    const handleMouseLeave = () => {
        if (!sidebarRef.current) return;
        sidebarRef.current.style.setProperty('--glow-opacity', '0');
    };

    return (
        <div className="flex h-full overflow-hidden" style={{ background: 'var(--c-surface)' }}>

            {/* ── Sidebar ── */}
            <aside
                ref={sidebarRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                className="hidden lg:flex flex-col w-80 flex-shrink-0 overflow-hidden pt-4 pb-8 relative group/sidebar glass-panel"
                style={{
                    background: 'rgba(250, 250, 250, 0.4)',
                    borderRight: '1px solid var(--c-border-soft)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                }}
            >
                {/* Ambient orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60 group-hover/sidebar:opacity-100 transition-opacity duration-1000">
                    <Orb style={{ background: 'var(--c-primary)', top: '-2%', left: '-30px' }} size={150} delay={0} opacity={0.1} />
                    <Orb style={{ background: 'var(--grad-candy)', top: '35%', right: '-50px' }} size={180} delay={2} opacity={0.08} />
                    <Orb style={{ background: 'var(--grad-aurora)', bottom: '10%', left: '-20px' }} size={160} delay={4} opacity={0.07} />
                    <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white/40 to-transparent" />
                </div>

                {/* Mouse glow */}
                <div
                    className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                    style={{
                        background: 'radial-gradient(400px circle at var(--glow-x, 0) var(--glow-y, 0), rgba(124, 92, 252, 0.04), transparent 80%)',
                        opacity: 'var(--glow-opacity, 0)',
                    }}
                />

                {/* Brand Header */}
                <div className="px-8 pt-4 pb-2 relative z-10 flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center">
                        <img src={logo} alt="Cognify" className="w-full h-full object-contain" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xl font-black tracking-tight text-[#2d3a74] leading-none">
                            Cogni<span className="text-[#8ce0c9]">fy</span>
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 mt-1">Growth Engine</span>
                    </div>
                </div>

                {/* User card */}
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
                    {NAV_ITEMS.map(item => {
                        const active = isActive(item.path);
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
                                            boxShadow: `0 8px 20px ${item.accent.hex}15`,
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
                                <span className="relative z-10 font-extrabold group-hover/nav:translate-x-1 transition-transform tracking-tight">
                                    {item.label}
                                </span>
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
                                <Shield className="w-5 h-5" />
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
                                        <div
                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 group-hover:scale-[2] transition-all duration-300 relative z-10"
                                            style={{ background: acc.bg, boxShadow: `0 0 12px ${acc.hex}60` }}
                                        />
                                        <span className="truncate group-hover:text-indigo-600 transition-colors relative z-10">{s.name}</span>
                                        <ChevronRight
                                            className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 relative z-10"
                                            style={{ color: acc.hex }}
                                        />
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

            {/* ── Content area ── */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {children}
            </div>
        </div>
    );
};

export default MainLayout;
