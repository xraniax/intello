import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { materialService } from '../services/api';
import { Upload, FileText, Send, CheckCircle } from 'lucide-react';

const UploadPage = () => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState('summary');
    const [sending, setSending] = useState(false);
    const [success, setSuccess] = useState(false);
    const [err, setErr] = useState('');

    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSending(true);
        setErr('');

        try {
            await materialService.upload({ title, content, type });
            setSuccess(true);
            setTimeout(() => navigate('/history'), 2000);
        } catch (error) {
            setErr(error.response?.data?.message || 'Failed to upload material');
        } finally {
            setSending(false);
        }
    };

    if (success) {
        return (
            <div className="container flex-center" style={{ minHeight: '60vh' }}>
                <div className="glass-card text-center animate-fade-in" style={{ padding: '3rem' }}>
                    <CheckCircle size={64} color="#10b981" style={{ margin: '0 auto 1.5rem' }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Material Uploaded!</h2>
                    <p style={{ color: 'var(--text-muted)' }}>The AI engine is processing your content. Redirecting you to history...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container animate-fade-in">
            <div className="mb-8">
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Upload Material</h1>
                <p style={{ color: 'var(--text-muted)' }}>Add course content to get AI-generated summaries and quizzes</p>
            </div>

            <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div className="glass-card">
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Material Details</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <label className="input-label">Title</label>
                            <input
                                type="text"
                                className="input-field"
                                placeholder="e.g. Introduction to Neural Networks"
                                required
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="input-group">
                            <label className="input-label">Objective</label>
                            <select
                                className="input-field"
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                style={{ appearance: 'none' }}
                            >
                                <option value="summary">Generate Summary</option>
                                <option value="quiz">Generate Quiz</option>
                            </select>
                        </div>

                        <div className="input-group">
                            <label className="input-label">Content (Text)</label>
                            <textarea
                                className="input-field"
                                style={{ minHeight: '200px', resize: 'vertical' }}
                                placeholder="Paste your course content here..."
                                required
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                            ></textarea>
                        </div>

                        {err && <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{err}</p>}

                        <button type="submit" className="btn btn-primary" style={{ width: '100%', gap: '10px' }} disabled={sending}>
                            <Send size={18} />
                            {sending ? 'Processing...' : 'Send to AI Engine'}
                        </button>
                    </form>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="glass-card" style={{ borderStyle: 'dashed' }}>
                        <div className="text-center" style={{ textAlign: 'center' }}>
                            <Upload size={48} className="text-muted" style={{ margin: '0 auto 1rem' }} />
                            <h4 style={{ fontWeight: '600' }}>Drop a PDF or File</h4>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Supported formats: PDF, TXT (Max 10MB)</p>
                            <button disabled className="btn btn-outline" style={{ marginTop: '1.5rem', opacity: 0.6 }}>Choose File</button>
                            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>(PDF support coming soon in full release)</p>
                        </div>
                    </div>

                    <div className="glass-card" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                        <h4 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>Tips for best results:</h4>
                        <ul style={{ color: 'var(--text-muted)', listStyle: 'disc', paddingLeft: '1.5rem', fontSize: '0.875rem' }}>
                            <li>Ensure clear, coherent text.</li>
                            <li>Include key concepts and definitions.</li>
                            <li>Structure your content with headings.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UploadPage;
