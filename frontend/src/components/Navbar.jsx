import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, BookOpen, User, PlusCircle, History } from 'lucide-react';

const Navbar = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <nav className="glass sticky top-0 z-50 py-4 mb-8">
            <div className="container flex justify-between items-center" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <Link to="/" className="flex items-center gap-2 text-xl font-bold" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                    <div className="bg-primary p-1.5 rounded-lg" style={{ background: 'var(--primary)', padding: '6px', borderRadius: '8px' }}>
                        <BookOpen size={24} color="white" />
                    </div>
                    <span>Cognify</span>
                </Link>

                <div className="flex items-center gap-6" style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    {user ? (
                        <>
                            <Link to="/upload" className="text-muted hover:text-white flex items-center gap-1" style={{ textDecoration: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <PlusCircle size={18} />
                                <span>Upload</span>
                            </Link>
                            <Link to="/history" className="text-muted hover:text-white flex items-center gap-1" style={{ textDecoration: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <History size={18} />
                                <span>History</span>
                            </Link>
                            <div className="flex items-center gap-3 pl-4 border-l" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                                <div className="flex items-center gap-2">
                                    <User size={18} className="text-primary" />
                                    <span className="font-medium">{user.name}</span>
                                </div>
                                <button onClick={handleLogout} className="btn-outline" style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '0.875rem' }}>
                                    <LogOut size={16} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Link to="/login" className="text-muted hover:text-white" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>Login</Link>
                            <Link to="/register" className="btn btn-primary">Get Started</Link>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
