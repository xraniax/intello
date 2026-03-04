import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Book, Zap, Shield, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
    const { user } = useAuth();

    return (
        <div className="container animate-fade-in">
            <div className="glass-card mb-8" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(15, 23, 42, 0) 100%)' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Hello, {user?.name || 'Scholar'}!</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', maxWidth: '600px' }}>
                    Welcome to your Cognify dashboard. Your personal AI learning assistant is ready to help you master your course materials.
                </p>
                <Link to="/upload" className="btn btn-primary" style={{ marginTop: '2rem' }}>
                    Upload New Material
                    <ChevronRight size={20} />
                </Link>
            </div>

            <div className="grid-cols-3">
                <div className="glass-card">
                    <Book className="text-primary mb-4" size={32} />
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Course Materials</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Organize and manage your PDFs and text notes in one secure location.</p>
                </div>
                <div className="glass-card">
                    <Zap className="text-secondary mb-4" size={32} />
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>AI Processing</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Leverage our engine to generate instant summaries and adaptive quizzes.</p>
                </div>
                <div className="glass-card">
                    <Shield className="text-primary mb-4" size={32} />
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Secure Storage</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Your data is protected with enterprise-grade encryption and privacy controls.</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
