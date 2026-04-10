import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, User as UserIcon, LayoutDashboard, UserCircle, LogOut } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
    const user = useAuthStore((state) => state.data.user);
    const logout = useAuthStore((state) => state.actions.logout);
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

    const handleLogout = () => {
        logout();
        setIsMobileMenuOpen(false);
        navigate('/login');
    };

    const navLinks = [
        { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { label: 'Profile', path: '/profile', icon: UserCircle },
    ];

    return (
        <header className="py-4 px-6 border-b border-purple-100/50 bg-white/70 backdrop-blur-xl sticky top-0 z-50 transition-all duration-300">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link to="/" className="text-2xl font-black tracking-tight hover:opacity-80 transition-opacity flex items-center gap-2 group">
                    <span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-100 to-indigo-50 flex items-center justify-center group-hover:from-purple-500 group-hover:to-indigo-500 transition-all duration-500">
                        <div className="w-3.5 h-3.5 rounded-full bg-purple-500 group-hover:bg-white transition-colors duration-500"></div>
                    </span>
                    <span className="text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">Cognify</span>
                </Link>

                {/* Desktop Nav */}
                <nav className="hidden md:flex items-center gap-6">
                    {user ? (
                        <>
                            <Link to="/dashboard" className="text-sm font-bold text-gray-500 hover:text-purple-600 transition-colors uppercase tracking-widest text-[11px]">Dashboard</Link>
                            {user.role === 'admin' && (
                                <Link to="/admin" className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-xl border border-indigo-100 flex items-center gap-1.5 uppercase tracking-tighter">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                                    Admin Console
                                </Link>
                            )}

                            <div className="h-4 w-[1px] bg-gray-100 mx-2"></div>

                            <div className="flex items-center gap-4">
                                <Link to="/profile" className="w-10 h-10 bg-gray-50 flex items-center justify-center rounded-xl hover:bg-purple-50 hover:text-purple-600 text-gray-400 transition-all">
                                    <UserIcon className="w-5 h-5" />
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="text-[11px] font-black text-red-500 uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-red-50 transition-all"
                                >
                                    Sign out
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-sm font-bold text-gray-500 hover:text-purple-600 transition-colors uppercase tracking-widest text-[11px]">Login</Link>
                            <Link to="/register" className="btn-vibrant px-6 py-2.5 text-xs">
                                Get Started
                            </Link>
                        </>
                    )}
                </nav>

                {/* Mobile Hamburger Toggle */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2 text-gray-500 hover:bg-gray-50 rounded-xl transition-all"
                >
                    {isMobileMenuOpen ? <X className="w-6 h-6 border-red-100" /> : <Menu className="w-6 h-6" />}
                </button>
            </div>

            {/* Mobile Menu Drawer */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 h-full w-4/5 max-w-sm bg-white shadow-2xl z-50 md:hidden flex flex-col p-8"
                        >
                            <div className="flex justify-between items-center mb-12">
                                <span className="text-xl font-black tracking-tight">Menu</span>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 bg-gray-50 rounded-xl text-gray-400"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col gap-4">
                                {user ? (
                                    <>
                                        {navLinks.map((link) => (
                                            <Link
                                                key={link.path}
                                                to={link.path}
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="flex items-center gap-4 p-4 rounded-2xl bg-gray-50 hover:bg-purple-50 hover:text-purple-600 transition-all group"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-gray-400 group-hover:text-purple-600">
                                                    <link.icon className="w-5 h-5" />
                                                </div>
                                                <span className="font-bold">{link.label}</span>
                                            </Link>
                                        ))}
                                        {user.role === 'admin' && (
                                            <Link
                                                to="/admin"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="flex items-center gap-4 p-4 rounded-2xl bg-indigo-50 text-indigo-700 font-bold"
                                            >
                                                <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                                </div>
                                                Admin Console
                                            </Link>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Link
                                            to="/login"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="p-4 rounded-2xl bg-gray-50 font-bold text-center"
                                        >
                                            Login
                                        </Link>
                                        <Link
                                            to="/register"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="btn-vibrant p-4 rounded-2xl text-center shadow-none"
                                        >
                                            Get Started
                                        </Link>
                                    </>
                                )}
                            </div>

                            {user && (
                                <button
                                    onClick={handleLogout}
                                    className="mt-auto flex items-center gap-4 p-4 rounded-2xl bg-red-50 text-red-600 font-bold transition-all"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                                        <LogOut className="w-5 h-5" />
                                    </div>
                                    Sign Out
                                </button>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </header>
    );
};

export default Navbar;
