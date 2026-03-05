import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Book, Plus, Edit2, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { subjectService } from '../services/api';

const Dashboard = () => {
    const { user } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        try {
            const res = await subjectService.getAll();
            setSubjects(res.data.data);
        } catch (err) {
            console.error('Failed to fetch subjects', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSubject = async (e) => {
        e.preventDefault();
        if (!newSubjectName.trim()) return;
        setCreating(true);
        try {
            await subjectService.create(newSubjectName);
            setNewSubjectName('');
            await fetchSubjects();
        } catch (err) {
            alert('Failed to create subject');
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteSubject = async (id, name) => {
        if (window.confirm(`Are you sure you want to delete "${name}"? All materials inside will be deleted.`)) {
            try {
                await subjectService.delete(id);
                setSubjects(subjects.filter(s => s.id !== id));
            } catch (err) {
                alert('Failed to delete subject');
            }
        }
    };

    const handleRenameSubject = async (id, currentName) => {
        const newName = window.prompt('Enter new subject name:', currentName);
        if (newName && newName !== currentName) {
            try {
                await subjectService.rename(id, newName);
                fetchSubjects();
            } catch (err) {
                alert('Failed to rename subject');
            }
        }
    };

    return (
        <div className="container animate-fade-in">
            <div className="glass-card mb-8" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(15, 23, 42, 0) 100%)' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Hello, {user?.name || 'Scholar'}!</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '1.125rem', maxWidth: '600px' }}>
                    Manage your subjects and course materials below. Click on a subject to view its contents.
                </p>
            </div>

            <div className="grid mb-6" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Your Subjects</h2>
                <form onSubmit={handleCreateSubject} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                        type="text"
                        placeholder="New Subject Name..."
                        className="input-field"
                        style={{ width: '250px', marginBottom: 0 }}
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        disabled={creating}
                    />
                    <button type="submit" className="btn btn-primary" disabled={creating}>
                        {creating ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        Add
                    </button>
                </form>
            </div>

            {loading ? (
                <div className="flex-center" style={{ height: '200px' }}>
                    <Loader2 className="animate-spin text-primary" size={48} />
                </div>
            ) : subjects.length === 0 ? (
                <div className="glass-card text-center" style={{ padding: '4rem' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>You haven't created any subjects yet.</p>
                    <Link to="/upload" className="btn btn-primary">
                        Upload First Material
                        <ChevronRight size={20} />
                    </Link>
                </div>
            ) : (
                <div className="grid-cols-3">
                    {subjects.map((subject) => (
                        <div key={subject.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                <Book className="text-primary" size={32} />
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => handleRenameSubject(subject.id, subject.name)}
                                        className="btn btn-outline"
                                        style={{ padding: '0.4rem', borderRadius: '6px' }}
                                        title="Rename"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSubject(subject.id, subject.name)}
                                        className="btn btn-outline"
                                        style={{ padding: '0.4rem', borderRadius: '6px', border: '1px solid #ef4444', color: '#ef4444' }}
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{subject.name}</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem', flexGrow: 1 }}>
                                {subject.material_count || 0} Materials associated
                            </p>
                            <Link to={`/subjects/${subject.id}`} className="btn btn-outline" style={{ width: '100%' }}>
                                View Materials
                                <ChevronRight size={16} />
                            </Link>
                        </div>
                    ))}
                    <Link to="/upload" className="glass-card" style={{ borderStyle: 'dashed', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: 'transparent' }}>
                        <Plus size={48} className="text-muted" />
                        <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Upload New Content</span>
                    </Link>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
