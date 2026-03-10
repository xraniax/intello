import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
            setErr(error.message || 'Login failed. Please check your credentials.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <div className="w-full max-w-sm border border-gray-200 p-6 rounded shadow-sm bg-white">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1">Log In</h1>
                    <p className="text-gray-600 text-sm">Sign in to your account</p>
                </div>

                {err && (
                    <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm border border-red-200">
                        {err}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="input-label">Email Address</label>
                        <input
                            type="email"
                            className="input-field"
                            placeholder="name@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="input-label">Password</label>
                        <input
                            type="password"
                            className="input-field"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full mt-2" disabled={sending}>
                        {sending ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="text-center mt-4 text-sm text-gray-600">
                    Don't have an account? <Link to="/register" className="text-blue-600 hover:underline">Sign up</Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
