import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });
    const [err, setErr] = useState('');
    const [sending, setSending] = useState(false);

    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        setError(''); // Renamed from 'setErr' to 'setError'

        try {
            await register(formData);
            navigate('/dashboard');
        } catch (err) { // Changed 'error' to 'err' to match the instruction's usage
            setError(err.message || 'Registration failed.');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
            <div className="w-full max-w-sm border border-gray-200 p-6 rounded shadow-sm bg-white">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold mb-1">Create Account</h1>
                    <p className="text-gray-600 text-sm">Register to start your learning journey</p>
                </div>

                {err && (
                    <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm border border-red-200">
                        {err}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="input-label">Full Name</label>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Your name here.."
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="input-label">Email Address</label>
                        <input
                            type="email"
                            className="input-field"
                            placeholder="name@example.com"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="input-label">Password</label>
                        <input
                            type="password"
                            className="input-field"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full mt-2" disabled={sending}>
                        {sending ? 'Creating account...' : 'Sign Up'}
                    </button>
                </form>

                <p className="text-center mt-4 text-sm text-gray-600">
                    Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Log in</Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
