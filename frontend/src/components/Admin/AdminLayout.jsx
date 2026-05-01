import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LayoutDashboard, Users, HardDrive, 
    LogOut, ChevronLeft, ChevronRight,
    Bell, Menu, X, CheckCircle2,
    FileText, AlertTriangle, AlertOctagon, Info, CheckCheck, RefreshCw
} from 'lucide-react';
import { adminService } from '@/features/admin/services/AdminService';
import { formatDistanceToNow } from 'date-fns';

const AdminLayout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [activeSection, setActiveSection] = useState('overview');
    const [sectionsCompleted, setSectionsCompleted] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifSeen, setNotifSeen] = useState(false);
    const [resolvingId, setResolvingId] = useState(null);
    
    const scrollContainerRef = useRef(null);
    const notifRef = useRef(null);

    const navigation = [
        {
            group: 'ADMINISTRATION',
            items: [
                { name: 'Dashboard', id: 'overview', icon: LayoutDashboard },
                { name: 'Users', id: 'users', icon: Users },
                { name: 'Files', id: 'files', icon: HardDrive },
                { name: 'Logs', id: 'logs', icon: FileText }
            ]
        }
    ];

    // ─── Notification Fetch ───────────────────────────────────
    const fetchNotifications = useCallback(async () => {
        try {
            const res = await adminService.getAlerts({ limit: 10 });
            setNotifications(res.data?.data || []);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleResolve = async (id, e) => {
        e.stopPropagation();
        setResolvingId(id);
        try {
            await adminService.resolveAlert(id);
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch { /* silent */ } finally {
            setResolvingId(null);
        }
    };

    const unreadCount = notifications.filter(n => !n.resolved_at).length;

    const NOTIF_ICON = { 
        danger: AlertOctagon, 
        warning: AlertTriangle, 
        info: Info,
        user_quota_warning: HardDrive,
        user_quota_exceeded: AlertOctagon
    };
    const NOTIF_COLOR = {
        danger:  'text-red-500 bg-red-50 border-red-100',
        warning: 'text-amber-500 bg-amber-50 border-amber-100',
        info:    'text-indigo-500 bg-indigo-50 border-indigo-100',
        user_quota_warning: 'text-amber-600 bg-amber-50 border-amber-200',
        user_quota_exceeded: 'text-rose-600 bg-rose-50 border-rose-200',
    };

    useEffect(() => {

        const container = scrollContainerRef.current;
        if (!container || location.pathname !== '/admin') return;

        const handleScroll = () => {
            const total = container.scrollHeight - container.clientHeight;
            if (total <= 0) return;
            const progress = (container.scrollTop / total) * 100;
            container.style.setProperty('--scroll-progress', `${progress}%`);
        };

        const observerOptions = {
            root: container,
            rootMargin: '-20% 0px -70% 0px',
            threshold: 0
        };

        const observerCallback = (entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const sectionId = entry.target.id;
                    setActiveSection(sectionId);
                    
                    const items = navigation[0].items;
                    const sectionIdx = items.findIndex(item => item.id === sectionId);
                    if (sectionIdx !== -1) {
                        setSectionsCompleted(items.slice(0, sectionIdx).map(i => i.id));
                    }
                }
            });
        };

        const observer = new IntersectionObserver(observerCallback, observerOptions);
        navigation[0].items.forEach(item => {
            const el = document.getElementById(item.id);
            if (el) observer.observe(el);
        });

        container.addEventListener('scroll', handleScroll);
        // Initial call
        handleScroll();

        return () => {
            observer.disconnect();
            container.removeEventListener('scroll', handleScroll);
        };
    }, [location.pathname]);

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: element.offsetTop,
                behavior: 'smooth'
            });
        } else {
            navigate('/admin', { state: { scrollTo: id } });
        }
    };

    return (
        <div className="flex flex-1 h-screen bg-white overflow-hidden font-sans selection:bg-indigo-100 selection:text-indigo-900 text-gray-900">
            {/* Desktop Sidebar */}
            <aside className={`hidden md:block transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] relative flex-shrink-0 z-20 ${isSidebarCollapsed ? 'w-[80px]' : 'w-72'}`}>
                <div className="flex flex-col h-full bg-white border-r border-gray-100">
                    {/* Header */}
                    <div className={`h-20 flex items-center border-b border-gray-50/50 ${isSidebarCollapsed ? 'justify-center' : 'px-8 justify-between'}`}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                            <Link to="/admin" className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200/50 rotate-3 group-hover:rotate-0 transition-transform duration-300">
                                    <span className="text-white text-lg font-black italic">C</span>
                                </div>
                                {!isSidebarCollapsed && (
                                    <span className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-500">
                                        Cognify
                                    </span>
                                )}
                            </Link>
                        </motion.div>
                    </div>

                    {/* Navigation */}
                    <div className="flex-1 overflow-y-auto pt-10 pb-6 px-4 scrollbar-hide relative">
                        <div className="relative">
                            {/* Vertical Journey Line Background */}
                            {!isSidebarCollapsed && (
                                <div className="absolute left-7 top-4 bottom-4 w-1 bg-gray-50 rounded-full" />
                            )}
                            {/* Animated Liquid Progress Line */}
                            {!isSidebarCollapsed && (
                                <div 
                                    className="absolute left-7 top-4 bg-gray-900 rounded-full w-1 origin-top shadow-[0_0_15px_rgba(0,0,0,0.1)] transition-[height] duration-200"
                                    style={{ height: 'var(--scroll-progress, 0%)' }}
                                />
                            )}

                            {navigation.map((group) => (
                                <div key={group.group} className="mb-12 relative z-10">
                                    {!isSidebarCollapsed && (
                                        <p className="px-10 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-8 opacity-50">
                                            {group.group}
                                        </p>
                                    )}

                                    <nav className="space-y-8">
                                        {group.items.map((item) => {
                                            const Icon = item.icon;
                                            const isActive = activeSection === item.id;
                                            const isDone = sectionsCompleted.includes(item.id);

                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => scrollToSection(item.id)}
                                                    className={`flex items-center w-full group transition-all duration-300 relative
                                                        ${isSidebarCollapsed ? 'justify-center' : 'px-4'}
                                                        ${isActive ? 'scale-105' : 'hover:translate-x-1'}
                                                    `}
                                                >
                                                    {/* Step Indicator */}
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-4 z-10 shrink-0
                                                        ${isActive 
                                                            ? 'bg-gray-900 border-white shadow-2xl scale-110 text-white' 
                                                            : isDone
                                                                ? 'bg-white border-gray-900 text-gray-900'
                                                                : 'bg-white border-gray-50 text-gray-200'
                                                        }
                                                    `}>
                                                        {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                                                    </div>

                                                    {!isSidebarCollapsed && (
                                                        <span className={`ml-4 text-sm tracking-tight transition-all duration-300 ${isActive ? 'font-black text-gray-900' : 'font-bold text-gray-400 group-hover:text-gray-600'}`}>
                                                            {item.name}
                                                        </span>
                                                    )}
                                                    
                                                    {/* Active Indicator Pulse */}
                                                    {isActive && !isSidebarCollapsed && (
                                                        <motion.div 
                                                            layoutId="sidebar-active-glow"
                                                            className="absolute inset-0 bg-gray-50 rounded-2xl -z-10 border border-gray-100/50"
                                                            transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                                        />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </nav>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto p-4 flex flex-col gap-2 border-t border-gray-50/50">
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className={`flex items-center w-full gap-3 p-2.5 rounded-2xl transition-all duration-300 relative
                                ${isSidebarCollapsed ? 'justify-center' : 'bg-gray-50/50 border border-gray-100/50 hover:bg-gray-50'}
                            `}
                        >
                            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-gray-200">
                                {user?.name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="flex-1 text-left">
                                    <p className="text-[10px] font-black text-gray-900 leading-none mb-1">{user?.name || 'Admin'}</p>
                                    <p className="text-[8px] font-black text-gray-400 tracking-widest uppercase">System Core</p>
                                </div>
                            )}
                        </motion.button>

                        <button 
                            onClick={logout} 
                            className={`flex items-center gap-3 w-full group transition-all duration-300 rounded-2xl
                                ${isSidebarCollapsed ? 'justify-center p-3 text-gray-400 hover:text-red-500 hover:bg-red-50' : 'p-3 bg-red-50/30 text-red-500 hover:bg-red-50 border border-red-100/30'}
                            `}
                            title="Sign Out"
                        >
                            <LogOut className={`w-4 h-4 transition-transform group-hover:-translate-x-1`} />
                            {!isSidebarCollapsed && <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sign Out</span>}
                        </button>
                    </div>
                </div>

                {/* Toggle */}
                <motion.button 
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.8 }}
                    onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute -right-4 top-8 w-8 h-8 bg-white border-2 border-gray-900 rounded-xl flex items-center justify-center z-30 shadow-2xl"
                >
                    {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </motion.button>
            </aside>

            {/* Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-white">
                <header className="h-20 border-b border-gray-50 flex items-center justify-between px-8 z-10 backdrop-blur-xl bg-white/70">
                    <div className="flex items-center gap-6">
                        <button className="md:hidden p-2 bg-gray-50 rounded-xl" onClick={() => setMobileMenuOpen(true)}>
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Nodes Synchronized</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {/* Notification Bell */}
                        <div ref={notifRef} className="relative">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => { setShowNotifications(v => !v); setNotifSeen(true); }}
                                className="p-3 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-2xl transition-colors border border-gray-100 relative"
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && !notifSeen && (
                                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white animate-ping" />
                                )}
                                {unreadCount > 0 && (
                                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white" />
                                )}
                            </motion.button>

                            <AnimatePresence>
                                {showNotifications && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.97 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.97 }}
                                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                                        className="absolute right-0 top-full mt-3 w-96 bg-white rounded-3xl shadow-2xl shadow-gray-200/60 border border-gray-100/80 z-50 overflow-hidden"
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-50">
                                            <div>
                                                <h3 className="font-black text-gray-900 text-sm">System Alerts</h3>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                                                    {unreadCount > 0 ? `${unreadCount} active` : 'All clear'}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => fetchNotifications()}
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                                                title="Refresh"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Notification List */}
                                        <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                                            {notifications.length === 0 ? (
                                                <div className="py-12 flex flex-col items-center gap-3 text-gray-300">
                                                    <CheckCheck className="w-8 h-8" />
                                                    <p className="text-xs font-black uppercase tracking-widest">System Nominal</p>
                                                </div>
                                            ) : notifications.map(n => {
                                                const severity = (n.severity || n.type || 'info').toLowerCase();
                                                const NIcon = NOTIF_ICON[severity] || Info;
                                                const colorClass = NOTIF_COLOR[severity] || NOTIF_COLOR.info;
                                                const isResolved = !!n.resolved_at;

                                                return (
                                                    <div key={n.id} className={`flex items-start gap-3 px-4 py-4 transition-colors ${isResolved ? 'opacity-40' : 'hover:bg-gray-50/70'}`}>
                                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${colorClass}`}>
                                                            <NIcon className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-black text-gray-900 leading-snug">{n.title || n.message || 'System Alert'}</p>
                                                            {n.message && n.title && (
                                                                <p className="text-[11px] text-gray-400 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                                                            )}
                                                            <p className="text-[10px] text-gray-300 mt-1 font-bold uppercase tracking-wider">
                                                                {n.created_at ? formatDistanceToNow(new Date(n.created_at), { addSuffix: true }) : ''}
                                                            </p>
                                                        </div>
                                                        {!isResolved && (
                                                            <button
                                                                onClick={(e) => handleResolve(n.id, e)}
                                                                disabled={resolvingId === n.id}
                                                                className="shrink-0 p-1.5 text-gray-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                                                title="Resolve"
                                                            >
                                                                {resolvingId === n.id
                                                                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                                    : <CheckCheck className="w-3.5 h-3.5" />
                                                                }
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* Footer */}
                                        <div className="px-5 py-3 border-t border-gray-50 text-center">
                                            <button
                                                onClick={() => { setShowNotifications(false); document.getElementById('logs')?.scrollIntoView({ behavior: 'smooth' }); }}
                                                className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 uppercase tracking-widest transition-colors"
                                            >
                                                View Full Audit Stream
                                            </button>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                </header>

                <main 
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto w-full relative scroll-smooth narrative-viewport"
                >
                    <div className="w-full relative min-h-full">
                        {children}
                    </div>
                </main>
            </div>

            {/* Mobile Nav */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 md:hidden"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.aside 
                            initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                            className="fixed inset-y-0 left-0 w-80 bg-white z-50 md:hidden shadow-2xl p-8 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-12">
                                <span className="text-2xl font-black tracking-tighter">Cognify</span>
                                <button onClick={() => setMobileMenuOpen(false)}><X className="w-8 h-8" /></button>
                            </div>
                            <div className="space-y-6">
                                {navigation[0].items.map(item => (
                                    <button 
                                        key={item.id} 
                                        onClick={() => { scrollToSection(item.id); setMobileMenuOpen(false); }}
                                        className="flex items-center gap-4 w-full p-4 rounded-2xl hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-white">
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <span className="text-lg font-black">{item.name}</span>
                                    </button>
                                ))}
                            </div>
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminLayout;
