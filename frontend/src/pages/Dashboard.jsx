import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
        <div className="max-w-6xl mx-auto">
            <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded">
                <h1 className="text-2xl font-bold mb-2">Hello, {user?.name || 'Scholar'}!</h1>
                <p className="text-gray-700">Manage your subjects and course materials below.</p>
            </div>

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Your Subjects</h2>
                <form onSubmit={handleCreateSubject} className="flex gap-2">
                    <input
                        type="text"
                        placeholder="New Subject Name..."
                        className="input-field"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        disabled={creating}
                    />
                    <button type="submit" className="btn-primary whitespace-nowrap" disabled={creating}>
                        {creating ? 'Adding...' : 'Add Subject'}
                    </button>
                </form>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500">Loading subjects...</div>
            ) : subjects.length === 0 ? (
                <div className="p-8 border border-dashed border-gray-300 text-center rounded">
                    <p className="mb-4 text-gray-600">You haven't created any subjects yet.</p>
                    <Link to="/upload" className="btn-primary inline-block">Upload First Material</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subjects.map((subject) => (
                        <div key={subject.id} className="border border-gray-200 p-4 rounded bg-white flex flex-col">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-lg font-bold">{subject.name}</h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleRenameSubject(subject.id, subject.name)}
                                        className="text-sm text-blue-600 hover:underline"
                                    >
                                        Rename
                                    </button>
                                    <button
                                        onClick={() => handleDeleteSubject(subject.id, subject.name)}
                                        className="text-sm text-red-600 hover:underline"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                            <p className="text-sm text-gray-500 mb-4 flex-grow">
                                {subject.material_count || 0} Materials associated
                            </p>
                            <Link to={`/subjects/${subject.id}`} className="btn-secondary text-center text-sm">
                                Open Workspace
                            </Link>
                        </div>
                    ))}

                    <Link to="/upload" className="border border-dashed border-gray-300 p-4 rounded flex flex-col items-center justify-center text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors min-h-[150px]">
                        <span className="font-medium">+ Upload New Content</span>
                    </Link>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
