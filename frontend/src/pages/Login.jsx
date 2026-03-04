import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [err, setErr] = useState('');
    const [sending, setSending] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        setErr('');

        try {
            await login(email, password);
            navigate('/dashboard');
        } catch (error) {
            setErr(error.message);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="container flex-center" style={{ minHeight: 'calc(100vh - 150px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '450px' }}>
                <div className="text-center mb-8" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div className="bg-primary w-12 h-12 rounded-xl flex-center mx-auto mb-4" style={{ background: 'var(--primary)', width: '3rem', height: '3rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                        <LogIn color="white" size={28} />
                    </div>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Welcome Back</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Sign in to continue your learning journey</p>
                </div>

                {err && (
                    <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                        {err}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Email Address</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                className="input-field"
                                placeholder="name@example.com"
                                required
                                style={{ paddingLeft: '40px' }}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                className="input-field"
                                placeholder="••••••••"
                                required
                                style={{ paddingLeft: '40px' }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={sending}>
                        {sending ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="text-center mt-6" style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Don't have an account? <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>Sign up</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
