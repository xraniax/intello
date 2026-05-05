import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LayoutDashboard, Users, HardDrive, Settings,
    LogOut, ChevronLeft, ChevronRight,
    Bell, Menu, X, CheckCircle2,
    FileText, AlertTriangle, AlertOctagon, Info, CheckCheck, RefreshCw, Activity
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
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifSeen, setNotifSeen] = useState(false);
    const [resolvingId, setResolvingId] = useState(null);
    
    const notifRef = useRef(null);

    const navigation = [
        {
            group: 'ADMINISTRATION',
            items: [
                { name: 'Dashboard', path: '/admin', id: 'overview', icon: LayoutDashboard, color: 'indigo' },
                { name: 'Users', path: '/admin/users', id: 'users', icon: Users, color: 'fuchsia' },
                { name: 'Files', path: '/admin/files', id: 'files', icon: HardDrive, color: 'sky' },
                { name: 'Monitoring', path: '/admin/logs', id: 'logs', icon: Activity, color: 'emerald' },
                { name: 'System Rules', path: '/admin/settings', id: 'settings', icon: Settings, color: 'amber' }
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

    const navItem = useCallback((item) => {
        const isActive = location.pathname === item.path || (location.pathname === '/admin' && item.path === '/admin');
        if (item.path !== '/admin' && location.pathname === '/admin') return false; // Handled below
        if (location.pathname !== '/admin' && location.pathname.startsWith(item.path) && item.path !== '/admin') return true;
        return location.pathname === item.path;
    }, [location.pathname]);

    const activeIndex = navigation[0].items.findIndex(i => navItem(i));

    const handleNavigate = (path) => {
        navigate(path);
        setMobileMenuOpen(false);
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
                                <motion.div 
                                    className="absolute left-7 top-4 bg-gray-900 rounded-full w-1 origin-top shadow-[0_0_15px_rgba(0,0,0,0.1)] transition-all duration-500"
                                    style={{ 
                                        height: 'var(--scroll-progress, 0%)',
                                        backgroundColor: navigation[0].items[activeIndex]?.color === 'fuchsia' ? '#d946ef' :
                                                       navigation[0].items[activeIndex]?.color === 'sky' ? '#0ea5e9' :
                                                       navigation[0].items[activeIndex]?.color === 'emerald' ? '#10b981' :
                                                       navigation[0].items[activeIndex]?.color === 'amber' ? '#f59e0b' : '#111827'
                                    }}
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
                                            const isActive = navItem(item);
                                            const itemIndex = navigation[0].items.findIndex(i => i.id === item.id);
                                            const isDone = itemIndex < activeIndex;

                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => handleNavigate(item.path)}
                                                    className={`flex items-center w-full group transition-all duration-300 relative
                                                        ${isSidebarCollapsed ? 'justify-center' : 'px-4'}
                                                        ${isActive ? 'scale-105' : 'hover:translate-x-1'}
                                                    `}>
                                                    {/* Step Indicator */}
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 border-4 z-10 shrink-0
                                                        ${isActive 
                                                            ? `${item.color === 'fuchsia' ? 'bg-fuchsia-500 border-fuchsia-100 shadow-fuchsia-200' : 
                                                                 item.color === 'sky' ? 'bg-sky-500 border-sky-100 shadow-sky-200' :
                                                                 item.color === 'emerald' ? 'bg-emerald-500 border-emerald-100 shadow-emerald-200' :
                                                                 item.color === 'amber' ? 'bg-amber-500 border-amber-100 shadow-amber-200' : 'bg-gray-900 border-white shadow-indigo-200'} scale-110 text-white shadow-2xl` 
                                                            : isDone
                                                                ? `bg-white border-gray-900 text-gray-900`
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
                                                            className={`absolute inset-0 rounded-2xl -z-10 border transition-colors duration-500
                                                                ${item.color === 'fuchsia' ? 'bg-fuchsia-50 border-fuchsia-100/50' : 
                                                                  item.color === 'sky' ? 'bg-sky-50 border-sky-100/50' :
                                                                  item.color === 'emerald' ? 'bg-emerald-50 border-emerald-100/50' :
                                                                  item.color === 'amber' ? 'bg-amber-50 border-amber-100/50' : 'bg-gray-50 border-gray-100/50'}
                                                            `}
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
                                                onClick={() => { setShowNotifications(false); navigate('/admin/logs'); }}
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
                    className="flex-1 overflow-y-auto w-full relative scroll-smooth bg-gray-50/20"
                >
                    <div className="w-full relative min-h-full">
                        {/* More vibrant global ambient orbs */}
                        <div className="fixed top-0 right-0 w-[500px] h-[500px] bg-fuchsia-400/10 blur-[120px] rounded-full -z-10 animate-pulse pointer-events-none" />
                        <div className="fixed bottom-0 left-0 w-[600px] h-[600px] bg-sky-400/10 blur-[150px] rounded-full -z-10 pointer-events-none" />
                        <div className="fixed top-[20%] left-[10%] w-[300px] h-[300px] bg-emerald-400/5 blur-[100px] rounded-full -z-10 pointer-events-none" />
                        
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
                                        onClick={() => handleNavigate(item.path)}
                                        className={`flex items-center gap-4 w-full p-4 rounded-2xl transition-colors ${navItem(item) ? 'bg-gray-100 text-gray-900' : 'hover:bg-gray-50'}`}
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
