import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';
import toast from 'react-hot-toast';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await authService.forgotPassword(email);
            setSent(true);
            toast.success('Reset link sent to your email!');
        } catch (error) {
            toast.error(error.message || 'Failed to send reset link.');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
                <div className="w-full max-w-sm border border-gray-200 p-6 rounded shadow-sm bg-white text-center">
                    <div className="mb-4 text-green-500">
                        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold mb-2">Check your email</h2>
                    <p className="text-gray-600 mb-4">
                        We've sent a password reset link to <strong>{email}</strong>.
                    </p>
                    <button
                        onClick={() => setSent(false)}
                        className="text-sm text-blue-600 hover:underline mb-6 block mx-auto focus:outline-none"
                    >
                        Didn't receive the email? Send again
                    </button>
                    <Link to="/login" className="btn-primary inline-block w-full">
                        Back to Login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[90vh] p-6 animate-in fade-in duration-700">
            <div className={`w-full max-w-[400px] card-minimal transition-opacity duration-300 ${loading ? 'opacity-70' : ''}`}>
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Forgot Password</h1>
                    <p className="text-gray-500 font-medium">Enter your email to receive a reset link</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Email Address</label>
                        <input
                            type="email"
                            className="input-field"
                            placeholder="name@example.com"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2" disabled={loading}>
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Sending...</span>
                            </>
                        ) : 'Send Reset Link'}
                    </button>

                    <div className="text-center mt-6">
                        <Link to="/login" className="text-sm font-semibold text-indigo-500 hover:text-indigo-600 transition-colors">
                            Back to Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;
