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
        <div className="max-w-7xl mx-auto p-6 md:p-10 animate-in fade-in duration-700">
            {/* Hero Section */}
            <div className="relative mb-12 p-10 rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#C3B1E1]/20 via-[#FFF8F0] to-[#A1E3D8]/10 border border-purple-100/50">
                <div className="relative z-10 max-w-2xl">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 tracking-tight text-gray-900 leading-tight">
                        Welcome back, <span className="text-purple-600">{user?.name?.split(' ')[0] || 'Scholar'}</span>
                    </h1>
                    <p className="text-lg text-gray-600 font-medium leading-relaxed mb-8">
                        Your personal knowledge garden is growing. Ready to cultivate some more wisdom today?
                    </p>
                    <button
                        onClick={() => setIsAdding(!isAdding)}
                        className={`btn-primary flex items-center gap-2 group ${isAdding ? 'bg-red-400 border-red-400 hover:bg-red-500' : ''}`}
                    >
                        {isAdding ? (
                            <>
                                <X className="w-5 h-5 transition-transform group-hover:rotate-90" />
                                <span>Cancel</span>
                            </>
                        ) : (
                            <>
                                <Plus className="w-5 h-5 transition-transform group-hover:scale-110" />
                                <span>Create New Subject</span>
                            </>
                        )}
                    </button>
                </div>
                {/* Abstract shape for flair */}
                <div className="absolute top-[-10%] right-[-5%] w-64 h-64 bg-purple-200/30 rounded-full blur-3xl"></div>
                <div className="absolute bottom-[-20%] left-[10%] w-96 h-96 bg-mint-100/20 rounded-full blur-3xl"></div>
            </div>

            {/* Inline Creation Form */}
            {isAdding && (
                <div className="mb-12 p-8 card-minimal border-indigo-100 bg-white/50 backdrop-blur-sm animate-in zoom-in-95 slide-in-from-top-4 duration-300">
                    <form onSubmit={handleCreateSubject} className="flex flex-col md:flex-row gap-4">
                        <div className="flex-grow">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Subject Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Molecular Biology, Modern History..."
                                className="input-field py-4 text-lg bg-white"
                                value={newSubjectName}
                                onChange={(e) => { setNewSubjectName(e.target.value); setCreateError(null); }}
                                autoFocus
                                disabled={creating}
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="submit"
                                className="btn-primary py-4 px-8 text-lg w-full md:w-auto"
                                disabled={creating || !newSubjectName.trim()}
                            >
                                {creating ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        Creating...
                                    </div>
                                ) : 'Create Now'}
                            </button>
                        </div>
                    </form>
                    {createError && (
                        <p className="mt-4 text-sm text-red-500 font-medium ml-1 flex items-center gap-1">
                            <X className="w-4 h-4" /> {createError}
                        </p>
                    )}
                </div>
            )}

            {/* Controls Row: Search & Filter */}
            <div className="flex flex-col lg:flex-row gap-4 mb-10 items-center justify-between">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <h2 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Your Subjects</h2>
                    <div className="h-px bg-gray-100 flex-grow hidden lg:block min-w-[100px]"></div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                    {/* Search Bar */}
                    <div className="relative group w-full sm:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Find a subject..."
                            className="input-field pl-12 h-12 text-sm font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Filter Dropdown */}
                    <div className="relative group w-full sm:w-64">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-mint-500 transition-colors pointer-events-none" />
                        <select
                            className="input-field pl-12 h-12 text-sm font-semibold bg-white pr-10 appearance-none cursor-pointer"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="recent_opened">Recently Opened</option>
                            <option value="recent_created">Recently Created</option>
                            <option value="alpha_asc">Alphabetical (A-Z)</option>
                            <option value="alpha_desc">Alphabetical (Z-A)</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                            <SortAsc className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-20 text-gray-400 space-y-4">
                    <div className="w-12 h-12 border-4 border-purple-100 border-t-purple-500 rounded-full animate-spin"></div>
                    <p className="font-bold uppercase tracking-widest text-xs">Cultivating your workspace...</p>
                </div>
            ) : fetchError ? (
                <div className="p-12 border-2 border-red-50 bg-red-50/30 text-center rounded-[2rem] backdrop-blur-sm">
                    <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <X className="w-8 h-8" />
                    </div>
                    <p className="mb-6 text-red-600 font-bold text-lg">{fetchError}</p>
                    <button onClick={fetchSubjects} className="btn-primary bg-red-500 border-red-500 hover:bg-red-600">Reconnect to Backend</button>
                </div>
            ) : subjects.length === 0 ? (
                <div className="p-20 border-2 border-dashed border-gray-200 bg-white/50 text-center rounded-[2rem] flex flex-col items-center">
                    <div className="w-20 h-20 bg-purple-50 text-purple-300 rounded-full flex items-center justify-center mb-8">
                        <Plus className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">A clean slate awaits</h3>
                    <p className="mb-10 text-gray-500 font-medium text-lg max-w-sm">Create your first subject to start organizing your knowledge with AI power.</p>
                    <button onClick={() => setIsAdding(true)} className="btn-primary px-10 py-4 text-lg">Initialize First Subject</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAndSortedSubjects.length === 0 ? (
                        <div className="col-span-full p-20 border-2 border-dashed border-gray-200 text-center rounded-[2rem] bg-white/40">
                            <Search className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                            <p className="text-gray-500 text-xl font-bold mb-2">No matches found</p>
                            <p className="text-gray-400 mb-6">We couldn't find any subjects matching "{searchQuery}"</p>
                            <button
                                onClick={() => setSearchQuery('')}
                                className="text-indigo-500 font-bold hover:text-indigo-600 transition-colors underline underline-offset-4"
                            >
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        <>
                            {filteredAndSortedSubjects.map((subject) => (
                                <div key={subject.id} className="card-minimal flex flex-col group hover:scale-[1.02] transition-transform duration-300 h-full">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-100 to-indigo-50 flex items-center justify-center group-hover:from-purple-500 group-hover:to-indigo-500 transition-all duration-500">
                                            <span className="text-purple-600 group-hover:text-white font-black text-lg transition-colors duration-500">
                                                {subject.name.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleRenameSubject(subject.id, subject.name); }}
                                                className="p-2 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all"
                                                title="Rename"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDeleteSubject(subject.id, subject.name); }}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-grow">
                                        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-600 transition-colors leading-tight">
                                            {subject.name}
                                        </h3>
                                        <p className="text-gray-500 text-sm font-medium line-clamp-3 leading-relaxed mb-6">
                                            {subject.description || `${subject.material_count || 0} smart documents analyzed and ready for review.`}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                                        <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest gap-2">
                                            <Clock className="w-3 h-3" />
                                            <span>Just now</span>
                                        </div>
                                        <Link
                                            to={`/subjects/${subject.id}`}
                                            className="text-indigo-500 font-bold text-sm hover:text-indigo-600 flex items-center gap-1 group/btn transition-colors"
                                        >
                                            Open Space
                                            <svg className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </Link>
                                    </div>
                                </div>
                            ))}

                            <button
                                onClick={() => setIsAdding(true)}
                                className="border-2 border-dashed border-gray-200 p-8 rounded-[2rem] flex flex-col items-center justify-center text-gray-400 hover:border-purple-300 hover:bg-purple-50/50 hover:text-purple-500 transition-all group duration-300 h-full min-h-[220px]"
                            >
                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center mb-4 group-hover:border-purple-300 group-hover:bg-white transition-all">
                                    <Plus className="w-6 h-6 transition-transform group-hover:rotate-90" />
                                </div>
                                <span className="font-bold text-sm uppercase tracking-widest">Add Subject</span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default Dashboard;
