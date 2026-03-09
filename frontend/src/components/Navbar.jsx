import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="bg-gray-100 border-b border-gray-200 p-4">
            <div className="max-w-6xl mx-auto flex justify-between items-center">
                <Link to="/" className="text-xl font-bold text-blue-600">
                    Cognify
                </Link>

                <nav className="flex items-center gap-4">
                    {user ? (
                        <>
                            <Link to="/upload" className="text-sm font-medium hover:underline">Upload</Link>
                            <Link to="/history" className="text-sm font-medium hover:underline">History</Link>

                            <div className="flex items-center gap-3 border-l border-gray-300 pl-4 ml-2">
                                <span className="text-sm text-gray-700">{user.name}</span>
                                <button
                                    onClick={handleLogout}
                                    className="text-sm text-red-600 hover:text-red-800 hover:underline"
                                >
                                    Log out
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-sm font-medium hover:underline">Login</Link>
                            <Link to="/register" className="btn-primary text-sm">Register</Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
};

export default Navbar;
