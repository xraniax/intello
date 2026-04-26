import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LayoutDashboard, UserCircle, LogOut, Shield, Sparkles, Zap } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

const Navbar = () => {
    const user     = useAuthStore((s) => s.data.user);
    const logout   = useAuthStore((s) => s.actions.logout);
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = React.useState(false);

    // Scroll-aware elevation
    const { scrollY } = useScroll();
    const backdropBlur  = useTransform(scrollY, [0, 60], [16, 26]);
    const bgOpacity     = useTransform(scrollY, [0, 60], [0.88, 0.97]);
    const shadowOpacity = useTransform(scrollY, [0, 60], [0.04, 0.14]);
    const borderOpacity = useTransform(scrollY, [0, 60], [0.10, 0.18]);

    const handleLogout = () => {
        logout();
        setMobileOpen(false);
        navigate('/login');
    };

    const navLinks = [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ];

    const isActive = (path) => location.pathname === path;

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <motion.header
            className="h-[58px] px-5 flex items-center justify-between sticky top-0 z-50"
            style={{
                background: `rgba(247, 245, 255, ${bgOpacity.get()})`,
                backdropFilter: `blur(${backdropBlur.get()}px)`,
                WebkitBackdropFilter: `blur(${backdropBlur.get()}px)`,
                borderBottom: `1px solid rgba(124, 92, 252, ${borderOpacity.get()})`,
                boxShadow: `0 1px 0 rgba(124,92,252,0.06), 0 4px 20px rgba(124,92,252,${shadowOpacity.get()})`,
            }}
        >
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
                <motion.div
                    whileHover={{ rotate: [0, -12, 12, -6, 0], scale: 1.08 }}
                    transition={{ duration: 0.5, type: 'spring', damping: 8 }}
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center relative overflow-hidden"
                    style={{ background: 'var(--grad-primary)', boxShadow: 'var(--shadow-primary)' }}
                >
                    {/* Ambient inner glow that pulses */}
                    <motion.div
                        className="absolute inset-0 rounded-[10px]"
                        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3), transparent)' }}
                        animate={{ opacity: [0.4, 0.8, 0.4] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                        animate={{ rotate: [0, 8, -8, 0] }}
                        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                    >
                        <Sparkles className="w-4 h-4 text-white relative z-10" />
                    </motion.div>
                </motion.div>
                <span
                    className="text-[15px] font-bold tracking-tight"
                    style={{ color: 'var(--c-text)', letterSpacing: '-0.025em' }}
                >
                    Cogni<span style={{ color: 'var(--c-primary)' }}>fy</span>
                </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
                {user ? (
                    <>
                        {navLinks.map((link) => (
                            <Link
                                key={link.path}
                                to={link.path}
                                className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors duration-150"
                                style={{
                                    color: isActive(link.path) ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                }}
                            >
                                {isActive(link.path) && (
                                    <motion.span
                                        layoutId="nav-pill"
                                        className="absolute inset-0 rounded-xl"
                                        style={{ background: 'var(--c-primary-ultra)', border: '1.5px solid var(--c-primary-light)' }}
                                        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
                                    />
                                )}
                                <link.icon className="w-3.5 h-3.5 relative z-10" />
                                <span className="relative z-10">{link.label}</span>
                            </Link>
                        ))}

                        {user.role === 'admin' && (
                            <Link
                                to="/admin"
                                className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                                style={{
                                    background: isActive('/admin') ? 'var(--grad-candy)' : 'var(--c-rose-light)',
                                    color: isActive('/admin') ? 'white' : 'var(--c-rose)',
                                    boxShadow: isActive('/admin') ? 'var(--shadow-rose)' : 'none',
                                }}
                            >
                                <Shield className="w-3 h-3" />
                                Admin
                            </Link>
                        )}

                        <div className="h-5 w-px mx-2" style={{ background: 'var(--c-border)' }} />

                        <div className="flex items-center gap-1.5">
                            <Link
                                to="/profile"
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[13px] font-semibold transition-all duration-150 group"
                                style={{
                                    color:      isActive('/profile') ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                    background: isActive('/profile') ? 'var(--c-primary-ultra)' : 'transparent',
                                }}
                            >
                                {/* Avatar with pulse ring on active */}
                                <motion.div
                                    className="relative"
                                    whileHover={{ scale: 1.12 }}
                                    transition={{ type: 'spring', damping: 12, stiffness: 260 }}
                                >
                                    <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                                        style={{
                                            background: 'var(--grad-primary)',
                                            boxShadow: isActive('/profile') ? 'var(--shadow-primary)' : 'none',
                                        }}
                                    >
                                        {initials}
                                    </div>
                                    {/* Soft pulse ring when on profile */}
                                    {isActive('/profile') && (
                                        <motion.div
                                            className="absolute -inset-1 rounded-full"
                                            style={{ border: '2px solid var(--c-primary)', opacity: 0.4 }}
                                            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                        />
                                    )}
                                </motion.div>
                                {user.name?.split(' ')[0]}
                            </Link>

                            <motion.button
                                whileTap={{ scale: 0.92 }}
                                onClick={handleLogout}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all duration-150 group"
                                style={{ color: 'var(--c-text-muted)' }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = 'var(--c-danger)';
                                    e.currentTarget.style.background = 'var(--c-danger-light)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = 'var(--c-text-muted)';
                                    e.currentTarget.style.background = 'transparent';
                                }}
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Sign out
                            </motion.button>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-2">
                        <Link
                            to="/login"
                            className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
                            style={{ color: 'var(--c-text-muted)' }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = 'var(--c-text)';
                                e.currentTarget.style.background = 'var(--c-surface-alt)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = 'var(--c-text-muted)';
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            Log in
                        </Link>
                        <Link
                            to="/register"
                            className="btn btn-sm btn-solid flex items-center gap-1.5"
                        >
                            <Zap className="w-3 h-3" />
                            Get started
                        </Link>
                    </div>
                )}
            </nav>

            {/* Mobile hamburger */}
            <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden p-2 rounded-xl transition-colors"
                style={{
                    background: mobileOpen ? 'var(--c-primary-ultra)' : 'transparent',
                    color: mobileOpen ? 'var(--c-primary)' : 'var(--c-text-muted)',
                }}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={mobileOpen ? 'x' : 'menu'}
                        initial={{ rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={{ rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.12 }}
                    >
                        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </motion.div>
                </AnimatePresence>
            </motion.button>

            {/* Mobile menu */}
            <AnimatePresence>
                {mobileOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            onClick={() => setMobileOpen(false)}
                            className="fixed inset-0 z-40 md:hidden"
                            style={{ background: 'rgba(13, 11, 30, 0.4)', backdropFilter: 'blur(6px)' }}
                        />
                        {/* Drawer */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                            className="fixed top-0 right-0 h-full w-72 z-50 md:hidden flex flex-col"
                            style={{
                                background: 'var(--c-surface)',
                                boxShadow: '-8px 0 48px rgba(124,92,252,0.14), var(--shadow-2xl)',
                                borderLeft: '1px solid var(--c-border-soft)',
                            }}
                        >
                            {/* Drawer header */}
                            <div
                                className="flex items-center justify-between px-5 pt-5 pb-5"
                                style={{ background: 'var(--grad-primary)' }}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-[9px] bg-white/20 flex items-center justify-center">
                                        <Sparkles className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <span className="text-sm font-bold text-white tracking-tight">Cognify</span>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.88 }}
                                    onClick={() => setMobileOpen(false)}
                                    className="p-1.5 rounded-lg bg-white/15 text-white"
                                >
                                    <X className="w-4 h-4" />
                                </motion.button>
                            </div>

                            {/* User block */}
                            {user && (
                                <div
                                    className="flex items-center gap-3 px-5 py-4 border-b"
                                    style={{ borderColor: 'var(--c-border-soft)' }}
                                >
                                    <div
                                        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                                        style={{ background: 'var(--grad-primary)', boxShadow: 'var(--shadow-primary)' }}
                                    >
                                        {initials}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>
                                            {user.name}
                                        </p>
                                        <p className="text-xs truncate" style={{ color: 'var(--c-text-muted)' }}>
                                            {user.email}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 flex flex-col gap-1 p-4">
                                {user ? (
                                    <>
                                        {navLinks.map((link, i) => (
                                            <motion.div
                                                key={link.path}
                                                initial={{ opacity: 0, x: 12 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.06 + 0.1, type: 'spring', damping: 20 }}
                                            >
                                                <Link
                                                    to={link.path}
                                                    onClick={() => setMobileOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all"
                                                    style={{
                                                        background: isActive(link.path) ? 'var(--c-primary-ultra)' : 'transparent',
                                                        color:      isActive(link.path) ? 'var(--c-primary)'       : 'var(--c-text)',
                                                        border: isActive(link.path) ? '1.5px solid var(--c-primary-light)' : '1.5px solid transparent',
                                                    }}
                                                >
                                                    <link.icon className="w-4 h-4" />
                                                    {link.label}
                                                </Link>
                                            </motion.div>
                                        ))}
                                        <motion.div
                                            initial={{ opacity: 0, x: 12 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.16, type: 'spring', damping: 20 }}
                                        >
                                            <Link
                                                to="/profile"
                                                onClick={() => setMobileOpen(false)}
                                                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all"
                                                style={{
                                                    background: isActive('/profile') ? 'var(--c-primary-ultra)' : 'transparent',
                                                    color:      isActive('/profile') ? 'var(--c-primary)'       : 'var(--c-text)',
                                                    border: isActive('/profile') ? '1.5px solid var(--c-primary-light)' : '1.5px solid transparent',
                                                }}
                                            >
                                                <UserCircle className="w-4 h-4" />
                                                Profile
                                            </Link>
                                        </motion.div>
                                        {user.role === 'admin' && (
                                            <motion.div
                                                initial={{ opacity: 0, x: 12 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: 0.22, type: 'spring', damping: 20 }}
                                            >
                                                <Link
                                                    to="/admin"
                                                    onClick={() => setMobileOpen(false)}
                                                    className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold"
                                                    style={{
                                                        background: 'var(--c-rose-light)',
                                                        color: 'var(--c-rose)',
                                                        border: '1.5px solid rgba(244,63,94,0.15)',
                                                    }}
                                                >
                                                    <Shield className="w-4 h-4" />
                                                    Admin Console
                                                </Link>
                                            </motion.div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            to="/login"
                                            onClick={() => setMobileOpen(false)}
                                            className="px-4 py-3 rounded-2xl text-sm font-semibold text-center"
                                            style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text)' }}
                                        >
                                            Log in
                                        </Link>
                                        <Link
                                            to="/register"
                                            onClick={() => setMobileOpen(false)}
                                            className="btn btn-md btn-solid text-center"
                                            style={{ borderRadius: 'var(--radius-2xl)' }}
                                        >
                                            Get started
                                        </Link>
                                    </>
                                )}
                            </div>

                            {user && (
                                <div className="p-4 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
                                    <motion.button
                                        whileTap={{ scale: 0.96 }}
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all"
                                        style={{ color: 'var(--c-danger)' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--c-danger-light)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <LogOut className="w-4 h-4" />
                                        Sign out
                                    </motion.button>
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </motion.header>
    );
};

export default Navbar;
