import React, { useEffect, useState } from 'react';
import { materialService } from '../services/api';
import { FileText, Clock, Trash2, ChevronRight, Check } from 'lucide-react';

const History = () => {
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await materialService.getHistory();
                setMaterials(Array.isArray(res.data.data) ? res.data.data : []);
            } catch (error) {
                console.error('Failed to fetch history', error);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    if (loading) {
        return <div className="container">Loading your history...</div>;
    }

    return (
        <div className="container animate-fade-in">
            <div className="mb-8">
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Study History</h1>
                <p style={{ color: 'var(--text-muted)' }}>Review your learning materials and AI-generated insights</p>
            </div>

            <div className="grid-cols-2" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {materials.length === 0 ? (
                        <div className="glass-card text-center">
                            <Clock size={32} className="text-muted" style={{ margin: '0 auto 1rem' }} />
                            <p>No materials found. Start by uploading content!</p>
                        </div>
                    ) : (
                        materials.map((m) => (
                            <div
                                key={m.id}
                                className={`glass-card ${selected?.id === m.id ? 'active' : ''}`}
                                onClick={() => setSelected(m)}
                                style={{
                                    padding: '1rem',
                                    cursor: 'pointer',
                                    border: selected?.id === m.id ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                                    background: selected?.id === m.id ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-card)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div className="bg-primary p-2 rounded" style={{ background: 'var(--primary)', padding: '6px', borderRadius: '4px' }}>
                                            <FileText size={16} color="white" />
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '1rem', margin: 0 }}>{m.title}</h4>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {new Date(m.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight size={20} className="text-muted" />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="glass-card" style={{ minHeight: '600px' }}>
                    {selected ? (
                        <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                                <div>
                                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{selected.title}</h2>
                                    <span className="bg-primary" style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', background: 'var(--primary)' }}>
                                        {selected.type.toUpperCase()}
                                    </span>
                                </div>
                                <button className="btn btn-outline" style={{ color: '#ef4444', borderColor: '#ef4444', padding: '6px' }}>
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <h4 style={{ marginBottom: '0.75rem', color: 'var(--primary)' }}>AI Generated Insights</h4>
                                <div style={{
                                    background: 'rgba(15, 23, 42, 0.5)',
                                    padding: '1.5rem',
                                    borderRadius: '12px',
                                    borderLeft: '4px solid var(--primary)',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {selected.ai_generated_content?.result ? (
                                        typeof selected.ai_generated_content.result === 'string' ? (
                                            selected.ai_generated_content.result
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {selected.ai_generated_content.result.map((q, i) => (
                                                    <div key={i} style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                                                        <p style={{ fontWeight: '600' }}>Q: {q.question}</p>
                                                        <p style={{ color: 'var(--primary)', marginTop: '0.5rem' }}>A: {q.answer}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    ) : (
                                        <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No AI results generated još.</span>
                                    )}
                                </div>
                            </div>

                            <div>
                                <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>Source Content Clip</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                                    {selected.content.substring(0, 500)}...
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-center" style={{ height: '100%', flexDirection: 'column', color: 'var(--text-muted)' }}>
                            <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                            <p>Select a material from the list to view insights</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default History;
