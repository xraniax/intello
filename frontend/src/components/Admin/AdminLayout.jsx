import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    LayoutDashboard, Users, HardDrive, 
    LogOut, ChevronLeft, ChevronRight,
    Bell, Menu, X, CheckCircle2,
    FileText
} from 'lucide-react';

const AdminLayout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const [activeSection, setActiveSection] = useState('overview');
    const [sectionsCompleted, setSectionsCompleted] = useState([]);
    const [scrollProgress, setScrollProgress] = useState(0);
    
    const scrollContainerRef = useRef(null);

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

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || location.pathname !== '/admin') return;

        const handleScroll = () => {
            const total = container.scrollHeight - container.clientHeight;
            if (total <= 0) return;
            const progress = (container.scrollTop / total) * 100;
            setScrollProgress(progress);
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
            <aside className={`hidden md:block transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative flex-shrink-0 z-20 ${isSidebarCollapsed ? 'w-[80px]' : 'w-72'}`}>
                <div className="flex flex-col h-full bg-white border-r border-gray-100">
                    {/* Header */}
                    <div className={`h-20 flex items-center border-b border-gray-50/50 ${isSidebarCollapsed ? 'justify-center' : 'px-8 justify-between'}`}>
                        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Link to="/admin" className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-200/50 rotate-3 group-hover:rotate-0 transition-transform">
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
                                    className="absolute left-7 top-4 bg-gray-900 rounded-full w-1 origin-top shadow-[0_0_15px_rgba(0,0,0,0.1)]"
                                    initial={{ height: 0 }}
                                    animate={{ height: `${scrollProgress}%` }}
                                    transition={{ type: 'spring', damping: 20, stiffness: 100 }}
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
                                                    className={`flex items-center w-full group transition-all duration-500 relative
                                                        ${isSidebarCollapsed ? 'justify-center' : 'px-4'}
                                                        ${isActive ? 'scale-105' : 'hover:translate-x-1'}
                                                    `}
                                                >
                                                    {/* Step Indicator */}
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 border-4 z-10 shrink-0
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
                                                        <span className={`ml-4 text-sm tracking-tight transition-all duration-500 ${isActive ? 'font-black text-gray-900' : 'font-bold text-gray-400 group-hover:text-gray-600'}`}>
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

                    {/* Footer Profile */}
                    <div className="p-6 border-t border-gray-50">
                        <motion.button 
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                            className={`flex items-center w-full gap-4 p-3 rounded-2xl transition-all duration-300 relative
                                ${isSidebarCollapsed ? 'justify-center border-0' : 'bg-gray-50 border border-gray-100'}
                                ${showProfileMenu ? 'ring-2 ring-gray-900' : ''}
                            `}
                        >
                            <div className="w-10 h-10 rounded-2xl bg-gray-900 flex items-center justify-center text-white font-black text-sm shadow-xl shadow-gray-200">
                                {user?.name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="flex-1 text-left">
                                    <p className="text-xs font-black text-gray-900 leading-none mb-1">{user?.name || 'Admin'}</p>
                                    <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase">System Core</p>
                                </div>
                            )}

                            <AnimatePresence>
                                {showProfileMenu && (
                                    <motion.div 
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: -10, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute bottom-full left-0 w-full mb-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 p-2"
                                    >
                                        <button onClick={logout} className="flex items-center gap-3 w-full p-3 hover:bg-red-50 text-red-500 rounded-xl transition-colors font-black text-xs uppercase tracking-widest">
                                            <LogOut className="w-4 h-4" /> Sign Out
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.button>
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
                        <motion.button whileHover={{ scale: 1.1 }} className="p-3 bg-gray-50 text-gray-400 hover:text-gray-900 rounded-2xl transition-colors border border-gray-100 relative">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-indigo-500 rounded-full ring-2 ring-white" />
                        </motion.button>
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
