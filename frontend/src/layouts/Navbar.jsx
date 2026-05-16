import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, LayoutDashboard, UserCircle, LogOut, Shield, Sparkles, Zap, Trash2, Target, Calendar } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';

const Navbar = () => {
    const user     = useAuthStore((s) => s.data.user);
    const logout   = useAuthStore((s) => s.actions.logout);
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = React.useState(false);
    const toggleGoals = useUIStore((s) => s.actions.toggleGoalsDrawer);
    const goalsOpen = useUIStore((s) => s.data.goalsDrawerOpen);

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
        { label: 'Planner', path: '/planner', icon: Calendar },
        { label: 'Goals', path: '/goals', icon: Target },
        { label: 'Trash', path: '/trash', icon: Trash2 },
    ];

    const isActive = (path) => location.pathname === path;

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <motion.header
            className="h-[60px] px-6 flex items-center justify-between sticky top-0 z-50 transition-all border-b"
            style={{
                background: `rgba(255, 255, 255, ${bgOpacity.get() > 0.9 ? 0.9 : bgOpacity.get()})`,
                backdropFilter: `blur(${backdropBlur.get()}px)`,
                WebkitBackdropFilter: `blur(${backdropBlur.get()}px)`,
                borderColor: `rgba(0, 0, 0, ${borderOpacity.get() * 0.5})`,
                boxShadow: `0 1px 2px rgba(0,0,0,${shadowOpacity.get() * 0.2}), 0 8px 30px rgba(0,0,0,${shadowOpacity.get() * 0.1})`,
            }}
        >
            {/* Logo: Artistic Monolith C */}
            <Link to="/" className="flex items-center gap-4 group">
                <div className="relative w-10 h-10 flex items-center justify-center">
                    {/* The "Monoliths" - Custom Geometric Brand Mark */}
                    <motion.div
                        className="flex items-end gap-1"
                        initial="initial"
                        animate="animate"
                        variants={{
                            animate: { transition: { staggerChildren: 0.1 } }
                        }}
                    >
                        {/* Shard 1: Deep Base (Left) */}
                        <motion.div
                            variants={{
                                initial: { y: 10, opacity: 0 },
                                animate: { y: 0, opacity: 1 }
                            }}
                            className="w-2 h-7 rounded-sm"
                            style={{ background: 'var(--c-text)', opacity: 0.8 }}
                        />
                        {/* Shard 2: Primary Core (Center) */}
                        <motion.div
                            variants={{
                                initial: { y: 15, opacity: 0 },
                                animate: { y: 0, opacity: 1 }
                            }}
                            className="w-2 h-9 rounded-sm shadow-lg shadow-primary/20"
                            style={{ background: 'var(--c-primary)' }}
                        />
                        {/* Shard 3: Accent High (Right) */}
                        <motion.div
                            variants={{
                                initial: { y: 5, opacity: 0 },
                                animate: { y: 0, opacity: 1 }
                            }}
                            className="w-2 h-5 rounded-sm"
                            style={{ background: 'var(--c-rose)' }}
                        />
                    </motion.div>
                    
                    {/* Abstract "C" connector (Optional/Subtle) */}
                    <div className="absolute inset-0 border-2 border-transparent border-l-primary/10 border-t-primary/10 rounded-lg group-hover:border-primary/20 transition-colors" />
                </div>
                
                <div className="flex flex-col leading-tight">
                    <span
                        className="text-xl font-black tracking-tighter uppercase"
                        style={{ color: 'var(--c-text-secondary)', letterSpacing: '0.02em' }}
                    >
                        Cogni<span style={{ color: 'var(--c-primary)' }}>fy</span>
                    </span>
                    <span className="text-[9px] font-black tracking-[0.3em] uppercase opacity-40 -mt-1 ml-0.5">Intelligence</span>
                </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
                {user ? (
                    <>
                        {navLinks.map((link) => {
                            if (link.label === 'Goals') {
                                return (
                                    <button
                                        key={link.label}
                                        onClick={toggleGoals}
                                        className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-bold transition-all duration-150"
                                        style={{
                                            color: goalsOpen ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                        }}
                                    >
                                        {goalsOpen && (
                                            <motion.span
                                                layoutId="nav-pill"
                                                className="absolute inset-0 rounded-lg"
                                                style={{ background: 'var(--c-primary-ultra)', border: '1.5px solid var(--c-primary)' }}
                                                transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                                            />
                                        )}
                                        <link.icon className="w-3.5 h-3.5 relative z-10" />
                                        <span className="relative z-10">{link.label}</span>
                                    </button>
                                );
                            }
                            return (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        className="relative flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-bold transition-all duration-150"
                                    style={{
                                        color: isActive(link.path) ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                    }}
                                >
                                    {isActive(link.path) && (
                                            <motion.span
                                                layoutId="nav-pill"
                                                className="absolute inset-0 rounded-lg"
                                                style={{ background: 'var(--c-primary-ultra)', border: '1.5px solid var(--c-primary)' }}
                                                transition={{ type: 'spring', damping: 25, stiffness: 400 }}
                                            />
                                    )}
                                    <link.icon className="w-3.5 h-3.5 relative z-10" />
                                    <span className="relative z-10">{link.label}</span>
                                </Link>
                            );
                        })}

                        {user.role === 'admin' && (
                            <Link
                                to="/admin"
                                className="ml-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all"
                                style={{
                                    background: isActive('/admin') ? 'var(--c-rose)' : 'var(--c-rose-light)',
                                    color: isActive('/admin') ? 'white' : 'var(--c-rose)',
                                    boxShadow: isActive('/admin') ? '0 4px 12px rgba(244,63,94,0.3)' : 'none',
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
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] font-bold transition-all duration-150 group"
                                style={{
                                    color:      isActive('/profile') ? 'var(--c-primary)' : 'var(--c-text-muted)',
                                    background: isActive('/profile') ? 'var(--c-primary-ultra)' : 'transparent',
                                }}
                            >
                                {/* Avatar with pulse ring on active */}
                                <motion.div
                                    className="relative"
                                    whileHover={{ scale: 1.1 }}
                                    transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                                >
                                    <div
                                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
                                        style={{
                                            background: 'var(--c-primary)',
                                            boxShadow: isActive('/profile') ? '0 4px 10px rgba(99,91,255,0.3)' : 'none',
                                        }}
                                    >
                                        {initials}
                                    </div>
                                    {/* Soft pulse ring when on profile */}
                                    {isActive('/profile') && (
                                        <motion.div
                                            className="absolute -inset-1 rounded-lg"
                                            style={{ border: '2px solid var(--c-primary)', opacity: 0.5 }}
                                            animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                                            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
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
                            className="btn btn-sm btn-solid flex items-center gap-1.5 !rounded-lg !px-4 !h-9 !py-0 shadow-md hover:shadow-lg transition-all"
                            style={{ background: 'var(--c-primary)', color: 'white' }}
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
                className="md:hidden p-2 rounded-lg transition-colors"
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
                                className="flex items-center justify-between px-5 pt-8 pb-6"
                                style={{ background: 'var(--c-canvas)' }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex items-end gap-0.5 scale-75 origin-left">
                                        <div className="w-1.5 h-6 rounded-sm bg-text opacity-80" style={{ background: 'var(--c-text)' }} />
                                        <div className="w-1.5 h-8 rounded-sm bg-primary" style={{ background: 'var(--c-primary)' }} />
                                        <div className="w-1.5 h-4 rounded-sm bg-rose-500" style={{ background: 'var(--c-rose)' }} />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-lg font-black text-text tracking-tighter uppercase" style={{ color: 'var(--c-text-secondary)' }}>
                                            Cogni<span style={{ color: 'var(--c-primary)' }}>fy</span>
                                        </span>
                                    </div>
                                </div>
                                <motion.button
                                    whileTap={{ scale: 0.88 }}
                                    onClick={() => setMobileOpen(false)}
                                    className="p-2 rounded-lg bg-surface-alt border border-border-soft"
                                    style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text-muted)' }}
                                >
                                    <X className="w-5 h-5" />
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
                                                key={link.label}
                                                initial={{ opacity: 0, x: 12 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.06 + 0.1, type: 'spring', damping: 20 }}
                                            >
                                                {link.label === 'Goals' ? (
                                                    <button
                                                        onClick={() => {
                                                            setMobileOpen(false);
                                                            toggleGoals();
                                                        }}
                                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all"
                                                        style={{
                                                            background: goalsOpen ? 'var(--c-primary-ultra)' : 'transparent',
                                                            color:      goalsOpen ? 'var(--c-primary)'       : 'var(--c-text)',
                                                            border: goalsOpen ? '1.5px solid var(--c-primary)' : '1.5px solid transparent',
                                                        }}
                                                    >
                                                        <link.icon className="w-4 h-4" />
                                                        {link.label}
                                                    </button>
                                                ) : (
                                                    <Link
                                                        to={link.path}
                                                        onClick={() => setMobileOpen(false)}
                                                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all"
                                                        style={{
                                                            background: isActive(link.path) ? 'var(--c-primary-ultra)' : 'transparent',
                                                            color:      isActive(link.path) ? 'var(--c-primary)'       : 'var(--c-text)',
                                                            border: isActive(link.path) ? '1.5px solid var(--c-primary)' : '1.5px solid transparent',
                                                        }}
                                                    >
                                                        <link.icon className="w-4 h-4" />
                                                        {link.label}
                                                    </Link>
                                                )}
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
                                                className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all"
                                                style={{
                                                    background: isActive('/profile') ? 'var(--c-primary-ultra)' : 'transparent',
                                                    color:      isActive('/profile') ? 'var(--c-primary)'       : 'var(--c-text)',
                                                    border: isActive('/profile') ? '1.5px solid var(--c-primary)' : '1.5px solid transparent',
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
                                                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-black uppercase tracking-wider"
                                                    style={{
                                                        background: 'var(--c-rose-light)',
                                                        color: 'var(--c-rose)',
                                                        border: '1.5px solid rgba(244,63,94,0.2)',
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
                                            className="px-4 py-3 rounded-lg text-sm font-bold text-center"
                                            style={{ background: 'var(--c-surface-alt)', color: 'var(--c-text)' }}
                                        >
                                            Log in
                                        </Link>
                                        <Link
                                            to="/register"
                                            onClick={() => setMobileOpen(false)}
                                            className="btn btn-md btn-solid text-center !rounded-lg !font-black !h-12 flex items-center justify-center shadow-lg"
                                            style={{ background: 'var(--c-primary)', color: 'white' }}
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
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all"
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
