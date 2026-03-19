import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="py-4 px-6 border-b border-gray-100 bg-white/70 backdrop-blur-md sticky top-0 z-40 transition-all duration-300">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
                <Link to="/" className="text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                         <div className="w-3 h-3 rounded-full bg-indigo-400"></div>
                    </span>
                    <span className="text-gray-800">Cognify</span>
                </Link>

                <nav className="flex items-center gap-2">
                    {user ? (
                        <>
                            <Link to="/upload" className="nav-link">Upload</Link>
                            <Link to="/history" className="nav-link">History</Link>

                            <div className="h-4 w-[1px] bg-gray-200 mx-2"></div>

                            <div className="flex items-center gap-4">
                                <span className="text-sm font-semibold text-gray-700">{user.name}</span>
                                <button
                                    onClick={handleLogout}
                                    className="text-sm font-medium text-peach-600 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-all duration-200"
                                    style={{ color: '#e53e3e' }}
                                >
                                    Sign out
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="nav-link">Login</Link>
                            <Link to="/register" className="btn-primary ml-2 shadow-none hover:shadow-lg">
                                Get Started
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Navbar;
