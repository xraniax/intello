import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { subjectService } from '../services/api';
import { Search, Filter, SortAsc, Plus, X, Edit2, Trash2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import CustomModal from '../components/Common/CustomModal';
import Skeleton from '../components/Common/Skeleton';

import { useAuthStore } from '../store/useAuthStore';
import { useSubjectStore } from '../store/useSubjectStore';
import { useUIStore } from '../store/useUIStore';

const Dashboard = () => {
    const user = useAuthStore((state) => state.data.user);
    const subjects = useSubjectStore((state) => state.data.subjects);
    const loading = useSubjectStore((state) => state.loading);
    const fetchError = useSubjectStore((state) => state.error);
    const { fetchSubjects, createSubject } = useSubjectStore((state) => state.actions);
    const uiError = useUIStore(state => state.data.errors['createSubject']);

    const [newSubjectName, setNewSubjectName] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('recent_opened'); // recent_opened, recent_created, alpha_asc, alpha_desc
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        fetchSubjects().catch(() => {});
    }, [fetchSubjects]);

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
                    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
                case 'recent_opened':
                default: {
                    // Sort by lastActivityAt (Snake case from DB might be last_activity_at but we aliased it to lastActivityAt)
                    const dateA = new Date(a.lastActivityAt || a.last_activity_at || a.updated_at || a.created_at || 0);
                    const dateB = new Date(b.lastActivityAt || b.last_activity_at || b.updated_at || b.created_at || 0);
                    return dateB - dateA;
                }
            }
        });

        return result;
    }, [subjects, searchQuery, filterType]);

    const handleCreateSubject = async (e) => {
        e.preventDefault();
        const trimmedName = newSubjectName.trim();
        
        if (!trimmedName) {
            toast.error('Subject name is required');
            return;
        }

        if (trimmedName.length < 2) {
            toast.error('Subject name is too short (min 2 chars)');
            return;
        }

        try {
            await createSubject(trimmedName);
            setNewSubjectName('');
            setIsAdding(false);
            toast.success(`Subject "${trimmedName}" created!`);
        } catch (err) {
            // Error is handled via UIStore/SubjectStore
            toast.error(err.message || 'Failed to create subject');
        }
    };

    const handleDeleteSubject = (id, name) => {
        setModalConfig({
            title: 'Delete Subject?',
            message: `Are you sure you want to delete "${name}"? This will permanently remove all materials inside.`,
            type: 'warning',
            confirmText: 'Delete Forever',
            onConfirm: async () => {
                try {
                    await subjectService.delete(id);
                    await fetchSubjects();
                    toast.success('Subject deleted');
                } catch {
                    toast.error('Failed to delete subject');
                } finally {
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    };

    const handleRenameSubject = (id, currentName) => {
        setModalConfig({
            title: 'Rename Subject',
            message: 'Choose a new name for your study space.',
            type: 'prompt',
            defaultValue: currentName,
            confirmText: 'Save Changes',
            onConfirm: async (newName) => {
                if (!newName || newName === currentName) {
                    setIsModalOpen(false);
                    return;
                }
                try {
                    await subjectService.rename(id, newName);
                    toast.success('Subject renamed');
                    fetchSubjects();
                } catch (err) {
                    toast.error(err.message || 'Failed to rename subject');
                } finally {
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    };

    return (
        <div className="dashboard-page max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-700">
            {/* ... navigation / header ... */}

            {/* Welcome Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6 group">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-[0.2em] mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 anim-pulse"></div>
                        <span>Active Garden</span>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 tracking-tight">
                        Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 drop-shadow-sm">{user?.name?.split(' ')[0] || 'Scholar'}</span>
                    </h1>
                    <p className="text-gray-500 font-medium text-lg">Your cognitive garden is thriving. What shall we explore today?</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="btn-vibrant group flex items-center gap-3 px-8 py-4 shadow-xl shadow-purple-200/50 hover:shadow-purple-300 transition-all border border-purple-400/20"
                >
                    <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center group-hover:rotate-90 transition-transform duration-500">
                        <Plus className="w-4 h-4" />
                    </div>
                    <span className="font-extrabold uppercase tracking-widest text-sm">New Subject</span>
                </button>
            </div>

            {/* Quick Add Form (Inline) */}
            {isAdding && (
                <div className="mb-8 p-8 bg-white/80 backdrop-blur-md rounded-[2.5rem] border-2 border-purple-100/50 shadow-2xl shadow-purple-100/10 animate-in zoom-in-95 duration-300 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-purple-100/30 to-indigo-50/30 rounded-bl-[6rem] -z-10"></div>
                    <button
                        onClick={() => setIsAdding(false)}
                        className="absolute top-6 right-6 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Plus className="w-4 h-4 text-purple-600" />
                        </div>
                        Create New Study Space
                    </h3>
                    
                    <form onSubmit={handleCreateSubject} className="flex flex-col sm:flex-row gap-4 relative z-10">
                        <div className="flex-grow">
                            <input
                                type="text"
                                className={`input-field h-14 text-lg ${uiError ? 'border-red-300 ring-2 ring-red-50' : ''}`}
                                placeholder="Enter subject name (e.g. Molecular Biology)"
                                value={newSubjectName}
                                onChange={(e) => { 
                                    setNewSubjectName(e.target.value); 
                                    if (uiError) useUIStore.getState().actions.clearError('createSubject');
                                }}
                                autoFocus
                                disabled={loading}
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                type="submit"
                                className="btn-vibrant px-10 h-14 min-w-[180px] flex items-center justify-center gap-2"
                                disabled={loading || !newSubjectName.trim()}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        <span>Creating...</span>
                                    </>
                                ) : 'Create Now'}
                            </button>
                        </div>
                    </form>
                    {uiError && (
                        <p className="mt-4 text-sm text-red-500 font-medium ml-1 flex items-center gap-1 animate-in slide-in-from-top-1">
                            <X className="w-4 h-4" /> {uiError}
                        </p>
                    )}
                </div>
            )}

            {/* Controls Row: Search & Filter */}
            <div className="flex flex-col lg:flex-row gap-4 mb-8 items-center justify-between">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <h2 className="text-3xl font-black text-gray-900 whitespace-nowrap tracking-tight">Your Spaces</h2>
                    <div className="h-px bg-gray-100 flex-grow hidden lg:block min-w-[60px]"></div>
                    <span className="bg-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full border border-gray-100">
                        {subjects.length} Total
                    </span>
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
                            <option value="recent_opened">Recently Active</option>
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="card-minimal h-[280px] flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                                <Skeleton variant="circle" className="w-12 h-12" />
                                <div className="flex gap-2">
                                    <Skeleton className="w-8 h-8 rounded-lg" />
                                    <Skeleton className="w-8 h-8 rounded-lg" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Skeleton className="h-6 w-3/4" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-2/3" />
                            </div>
                            <div className="flex justify-between items-center pt-6 border-t border-gray-50">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                        </div>
                    ))}
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
                    <button onClick={() => setIsAdding(true)} className="btn-vibrant px-12 py-4 text-lg shadow-2xl">Initialize First Subject</button>
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
                                        <h3 className="text-2xl font-black text-gray-900 mb-2 group-hover:text-purple-600 transition-colors leading-tight tracking-tight">
                                            {subject.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mb-4">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-mint-50 text-mint-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-mint-100">
                                                <BookOpen className="w-3 h-3" />
                                                <span>{subject.material_count || 0} Sources</span>
                                            </div>
                                            {subject.lastActivityAt && (
                                                <div className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-indigo-100">
                                                    Active
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-gray-500 text-sm font-medium line-clamp-2 leading-relaxed mb-6 italic">
                                            {subject.description || `Harnessing AI to master the intricacies of ${subject.name}.`}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                                        <div className="flex items-center text-[10px] font-black text-gray-400 uppercase tracking-widest gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                                            <span>
                                                {subject.lastActivityAt || subject.last_activity_at 
                                                    ? formatDistanceToNow(new Date(subject.lastActivityAt || subject.last_activity_at), { addSuffix: true })
                                                    : 'New Space'}
                                            </span>
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
            {/* Custom Modal for Confirms/Prompts */}
            <CustomModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                {...modalConfig}
            />
        </div>
    );
};

export default Dashboard;
