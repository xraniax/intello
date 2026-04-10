import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/AuthContext';
import { 
    LayoutDashboard, Users, HardDrive, UploadCloud, 
    Activity, Settings, LogOut, ChevronLeft, ChevronRight,
    Search, Bell, Menu, X, User as UserIcon
} from 'lucide-react';

const AdminLayout = ({ children }) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navigation = [
        {
            group: 'MANAGEMENT',
            items: [
                { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
                { name: 'Users', path: '/admin/users', icon: Users },
                { name: 'Storage', path: '/admin/files', icon: HardDrive }
            ]
        },
        {
            group: 'SYSTEM',
            items: [
                { name: 'Activity Log', path: '/admin/logs', icon: Activity },
                { name: 'Settings', path: '/admin/settings', icon: Settings }
            ]
        }
    ];

    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-white border-r border-gray-100">
            {/* Logo area */}
            <div className={`h-16 flex items-center border-b border-gray-50 ${isSidebarCollapsed ? 'justify-center' : 'px-6 justify-between'}`}>
                {!isSidebarCollapsed && (
                    <Link to="/admin" className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-md">
                            <span className="text-white text-sm font-black tracking-tighter">C</span>
                        </div>
                        Cognify
                    </Link>
                )}
                {isSidebarCollapsed && (
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-sm font-black tracking-tighter">C</span>
                    </div>
                )}
            </div>

            {/* Nav Links */}
            <div className="flex-1 overflow-y-auto py-6 scrollbar-hide">
                {navigation.map((group) => (
                    <div key={group.group} className="mb-8">
                        {!isSidebarCollapsed && (
                            <p className="px-6 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3">
                                {group.group}
                            </p>
                        )}
                        <nav className="space-y-1.5 px-3">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
                                return (
                                    <NavLink
                                        key={item.name}
                                        to={item.path}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center ${isSidebarCollapsed ? 'justify-center w-10 h-10 mx-auto' : 'px-3 py-2.5'} gap-3 rounded-xl font-semibold text-sm transition-all duration-200 group relative
                                            ${isActive 
                                                ? 'bg-gray-900 text-white shadow-md shadow-gray-200 pointer-events-none' 
                                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                                            }
                                        `}
                                    >
                                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
                                        
                                        {!isSidebarCollapsed && (
                                            <span className="flex-1 truncate">{item.name}</span>
                                        )}
                                        
                                        {/* Tooltip for collapsed mode */}
                                        {isSidebarCollapsed && (
                                            <div className="absolute left-14 px-2.5 py-1.5 bg-gray-900 text-white text-[10px] uppercase tracking-widest font-black rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap shadow-xl">
                                                {item.name}
                                            </div>
                                        )}
                                    </NavLink>
                                )
                            })}
                        </nav>
                    </div>
                ))}
            </div>

            {/* Bottom Admin User Profile inside Sidebar */}
            <div className={`p-4 border-t border-gray-50 bg-white relative ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
                <div className="relative w-full">
                    <button 
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className={`flex items-center w-full gap-3 p-2 rounded-xl hover:bg-gray-100 transition-colors ${isSidebarCollapsed ? 'justify-center border border-transparent hover:border-gray-200' : 'border border-gray-100 bg-gray-50/50'}`}
                    >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm border border-white/20">
                            {user?.name?.charAt(0).toUpperCase() || 'A'}
                        </div>
                        {!isSidebarCollapsed && (
                            <div className="flex-1 text-left truncate flex flex-col justify-center">
                                <p className="text-xs font-bold text-gray-900 truncate tracking-tight">{user?.name || 'Administrator'}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user?.role || 'Admin'}</p>
                            </div>
                        )}
                    </button>
                    
                    {/* Popover Menu */}
                    {showProfileMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                            <div className={`absolute bottom-[calc(100%+8px)] bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 py-2 w-48 overflow-hidden z-50 animate-in slide-in-from-bottom-2 ${isSidebarCollapsed ? 'left-12' : 'left-0'}`}>
                                <div className="px-4 py-3 border-b border-gray-50 mb-1 bg-gray-50/50">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Signed in as</p>
                                    <p className="text-xs font-bold text-gray-900 truncate tracking-tight">{user?.email}</p>
                                </div>
                                <Link to="/dashboard" className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 w-full text-left transition-colors">
                                    <LayoutDashboard className="w-3.5 h-3.5" /> Back to App
                                </Link>
                                <div className="h-px bg-gray-100 my-1"></div>
                                <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 w-full text-left transition-colors">
                                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-1 h-screen bg-[#F8F9FA] overflow-hidden font-sans">
            {/* Desktop Sidebar */}
            <aside className={`hidden md:block transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] relative flex-shrink-0 z-20 ${isSidebarCollapsed ? 'w-[72px]' : 'w-64'}`}>
                <SidebarContent />
                {/* Collapse Toggle */}
                <button 
                    onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                    className="absolute -right-3 top-6 bg-white border border-gray-200 text-gray-400 hover:text-gray-900 rounded-full p-1 shadow-sm shadow-gray-200/50 z-30 transition-colors hover:scale-110 active:scale-95"
                >
                    {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
            </aside>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-40 md:hidden animate-in fade-in" onClick={() => setMobileMenuOpen(false)}></div>
            )}
            <aside className={`fixed inset-y-0 left-0 w-72 bg-white z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:hidden flex flex-col shadow-2xl ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <SidebarContent />
            </aside>

            {/* Main Layout Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* TopBar */}
                <header className="h-16 bg-white/70 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 md:px-8 z-10 sticky top-0">
                    <div className="flex items-center gap-4 flex-1">
                        <button 
                            className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>
                </header>

                {/* Main Content Viewport */}
                <main className="flex-1 overflow-y-auto w-full relative">
                    <div className="w-full h-full pb-12">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
};

export default AdminLayout;
