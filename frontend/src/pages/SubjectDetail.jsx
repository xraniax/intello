import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { subjectService } from '../services/api';
import { Book, FileText, ChevronRight, ArrowLeft, Loader2, Clock } from 'lucide-react';

const SubjectDetail = () => {
    const { id } = useParams();
    const [subject, setSubject] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const res = await subjectService.getOne(id);
                setSubject(res.data.data.subject);
                setMaterials(res.data.data.materials);
            } catch (err) {
                console.error('Failed to fetch subject details', err);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [id]);

    if (loading) {
        return (
            <div className="container flex-center" style={{ minHeight: '60vh' }}>
                <Loader2 className="animate-spin text-primary" size={48} />
            </div>
        );
    }

    if (!subject) {
        return (
            <div className="container text-center" style={{ padding: '4rem' }}>
                <h2 style={{ marginBottom: '1rem' }}>Subject not found</h2>
                <Link to="/dashboard" className="btn btn-primary">Back to Dashboard</Link>
            </div>
        );
    }

    return (
        <div className="container animate-fade-in">
            <Link to="/dashboard" className="btn btn-outline mb-8" style={{ padding: '0.5rem 1rem' }}>
                <ArrowLeft size={16} />
                Back to Dashboard
            </Link>

            <div className="glass-card mb-8">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <Book className="text-primary" size={48} />
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{subject.name}</h1>
                </div>
                {subject.description && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem' }}>{subject.description}</p>
                )}
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>Materials</h2>

            {materials.length === 0 ? (
                <div className="glass-card text-center" style={{ padding: '3rem' }}>
                    <Clock size={48} className="text-muted" style={{ margin: '0 auto 1.5rem', opacity: 0.3 }} />
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>No materials here yet.</p>
                    <Link to="/upload" className="btn btn-primary" state={{ defaultSubjectId: subject.id }}>
                        Upload to this Subject
                        <ChevronRight size={20} />
                    </Link>
                </div>
            ) : (
                <div className="grid-cols-3">
                    {materials.map((m) => (
                        <Link
                            key={m.id}
                            to="/history"
                            state={{ selectedId: m.id }}
                            className="glass-card"
                            style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '1rem' }}
                        >
                            <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '8px' }}>
                                <FileText size={24} color="white" />
                            </div>
                            <div style={{ flexGrow: 1 }}>
                                <h4 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{m.title}</h4>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {new Date(m.created_at).toLocaleDateString()} • {m.type.toUpperCase()}
                                </span>
                            </div>
                            <ChevronRight size={20} className="text-muted" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SubjectDetail;
