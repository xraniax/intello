import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/AuthContext';
import { Link } from 'react-router-dom';
import { subjectService } from '../services/api';
import { Search, Filter, SortAsc, SortDesc, Clock, Plus, X, Edit2, Trash2 } from 'lucide-react';

const Dashboard = () => {
    const { user } = useAuth();
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState(null);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('recent_opened'); // recent_opened, recent_created, alpha_asc, alpha_desc
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchSubjects();
    }, []);

    const fetchSubjects = async () => {
        setFetchError(null);
        try {
            const res = await subjectService.getAll();
            setSubjects(res.data.data || []);
        } catch (err) {
            console.error('Failed to fetch subjects', err);
            setFetchError(err.message || 'Could not load subjects. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    // Client-side filtering and sorting
    const filteredAndSortedSubjects = React.useMemo(() => {
        let result = [...subjects];

        // 1. Search Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(s =>
                s.name.toLowerCase().includes(query) ||
                (s.description && s.description.toLowerCase().includes(query))
            );
        }

        // 2. Sorting Logic
        result.sort((a, b) => {
            switch (filterType) {
                case 'alpha_asc':
                    return a.name.localeCompare(b.name);
                case 'alpha_desc':
                    return b.name.localeCompare(a.name);
                case 'recent_created':
                    // Assuming higher ID means more recent or use created_at if available
                    return (b.created_at || b.id) > (a.created_at || a.id) ? 1 : -1;
                case 'recent_opened':
                default:
                    // Sort by updated_at (or id as fallback)
                    return (b.updated_at || b.id) > (a.updated_at || a.id) ? 1 : -1;
            }
        });

        return result;
    }, [subjects, searchQuery, filterType]);

    const handleCreateSubject = async (e) => {
        e.preventDefault();
        if (!newSubjectName.trim()) return;
        setCreating(true);
        setCreateError(null);
        try {
            await subjectService.create(newSubjectName);
            setNewSubjectName('');
            setIsAdding(false);
            await fetchSubjects();
        } catch (err) {
            setCreateError(err.message || 'Failed to create subject. Please try again.');
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
        <div className="max-w-6xl mx-auto p-4 md:p-6">
            <div className="mb-8 p-6 bg-white border border-gray-100 rounded-xl shadow-sm">
                <h1 className="text-3xl font-bold mb-2 tracking-tight text-gray-900">Hello, {user?.name || 'Scholar'}!</h1>
                <p className="text-gray-500">Manage your learning subjects and source documents below.</p>
            </div>

            {/* Header Row: Title & Action Button */}
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Your Subjects</h2>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className={`btn-primary flex items-center gap-2 transition-colors ${isAdding ? 'bg-gray-500 hover:bg-gray-600' : ''}`}
                >
                    {isAdding ? (
                        <>
                            <X className="w-4 h-4" />
                            <span>Cancel</span>
                        </>
                    ) : (
                        <>
                            <Plus className="w-4 h-4" />
                            <span>Add Subject</span>
                        </>
                    )}
                </button>
            </div>

            {/* Inline Creation Form (Conditional) */}
            {isAdding && (
                <div className="mb-6 p-4 border border-gray-100 bg-white rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2">
                    <form onSubmit={handleCreateSubject} className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-grow">
                            <input
                                type="text"
                                placeholder="Enter subject name (e.g. Computer Science 101)"
                                className="input-field bg-white"
                                value={newSubjectName}
                                onChange={(e) => { setNewSubjectName(e.target.value); setCreateError(null); }}
                                autoFocus
                                disabled={creating}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn-primary whitespace-nowrap px-6"
                            disabled={creating || !newSubjectName.trim()}
                        >
                            {creating ? 'Creating...' : 'Create Subject'}
                        </button>
                    </form>
                    {createError && (
                        <p className="mt-2 text-sm text-red-600">{createError}</p>
                    )}
                </div>
            )}

            {/* Controls Row: Search & Filter */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
                {/* Search Bar (Expansive) */}
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search subjects by name or description..."
                        className="input-field pl-10 h-11"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Filter Dropdown */}
                <div className="relative min-w-[180px]">
                    <select
                        className="input-field bg-white pr-10 appearance-none cursor-pointer h-11"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="recent_opened">Sort: Recently Opened</option>
                        <option value="recent_created">Sort: Recently Created</option>
                        <option value="alpha_asc">Sort: A-Z (Alphabetical)</option>
                        <option value="alpha_desc">Sort: Z-A (Alphabetical)</option>
                    </select>
                    <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
                </div>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-500">Loading subjects...</div>
            ) : fetchError ? (
                <div className="p-12 border border-solid border-red-100 bg-red-50 text-center rounded-xl shadow-sm">
                    <p className="mb-4 text-red-600 font-medium">{fetchError}</p>
                    <button onClick={fetchSubjects} className="btn-primary">Retry</button>
                </div>
            ) : subjects.length === 0 ? (
                <div className="p-12 border border-solid border-gray-100 bg-white text-center rounded-xl shadow-sm">
                    <p className="mb-6 text-gray-500 font-medium text-lg">You haven't created any subjects yet.</p>
                    <Link to="/upload" className="btn-primary inline-block">Upload First Document</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAndSortedSubjects.length === 0 ? (
                        <div className="col-span-full p-12 border border-dashed border-gray-300 text-center rounded bg-gray-50">
                            <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">No subjects match your search "{searchQuery}"</p>
                            <button
                                onClick={() => setSearchQuery('')}
                                className="text-blue-600 text-sm hover:underline mt-2"
                            >
                                Clear search
                            </button>
                        </div>
                    ) : (
                        filteredAndSortedSubjects.map((subject) => (
                            <div key={subject.id} className="border border-gray-200 p-4 rounded bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col group">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-lg font-bold group-hover:text-blue-600 transition-colors">{subject.name}</h3>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRenameSubject(subject.id, subject.name); }}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                            title="Rename"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteSubject(subject.id, subject.name); }}
                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-500 mb-4 flex-grow line-clamp-2">
                                    {subject.description || `${subject.material_count || 0} Documents associated`}
                                </p>
                                <Link to={`/subjects/${subject.id}`} className="btn-secondary text-center text-sm py-1.5">
                                    Open Workspace
                                </Link>
                            </div>
                        ))
                    )}

                    <Link to="/upload" className="border border-dashed border-gray-300 p-4 rounded flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-blue-600 transition-all min-h-[150px]">
                        <span className="text-2xl mb-1">+</span>
                        <span className="font-medium text-sm">Upload New Content</span>
                    </Link>
                </div>
            )}
        </div>
    );
};

export default Dashboard;
