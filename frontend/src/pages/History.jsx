import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { materialService } from '../services/api';
import { Search, Calendar, BookOpen, ChevronRight, Clock, FileText, Trash2, LayoutGrid, List } from 'lucide-react';
import { format, isToday, isYesterday, subDays, startOfDay } from 'date-fns';
import Skeleton from '../components/Common/Skeleton';
import toast from 'react-hot-toast';

const History = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [materials, setMaterials] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await materialService.getHistory();
                const historyData = Array.isArray(res.data.data) ? res.data.data : [];
                setMaterials(historyData);
            } catch (error) {
                console.error('Failed to fetch history', error);
                toast.error('Failed to load study history');
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    useEffect(() => {
        let pollInterval;
        
        const pollProcessing = async () => {
            const processingIds = materials
                .filter(m => m.status === 'processing')
                .map(m => m.id);

            if (processingIds.length === 0) {
                if (pollInterval) clearInterval(pollInterval);
                return;
            }

            for (const mid of processingIds) {
                try {
                    const res = await materialService.sync(mid);
                    const updated = res.data.data;
                    if (updated.status !== 'processing') {
                        setMaterials(prev => prev.map(m => m.id === mid ? updated : m));
                    }
                } catch (err) {
                    console.error(`Sync failed for ${mid}:`, err);
                }
            }
        };

        if (materials.some(m => m.status === 'processing')) {
            pollInterval = setInterval(pollProcessing, 4000);
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [materials]);

    const handleDelete = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this material?')) return;
        
        try {
            await materialService.delete(id);
            setMaterials(prev => prev.filter(m => m.id !== id));
            toast.success('Document removed');
        } catch (err) {
            toast.error('Failed to delete material');
        }
    };

    const groupedMaterials = useMemo(() => {
        const filtered = materials.filter(m => 
            m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.subject_name && m.subject_name.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        const groups = {
            today: [],
            yesterday: [],
            lastWeek: [],
            earlier: []
        };

        const today = startOfDay(new Date());
        const yesterday = startOfDay(subDays(new Date(), 1));
        const lastWeek = startOfDay(subDays(new Date(), 7));

        filtered.forEach(m => {
            const date = new Date(m.created_at);
            if (isToday(date)) groups.today.push(m);
            else if (isYesterday(date)) groups.yesterday.push(m);
            else if (date >= lastWeek) groups.lastWeek.push(m);
            else groups.earlier.push(m);
        });

        return groups;
    }, [materials, searchQuery]);

    const renderGroup = (label, items) => {
        if (items.length === 0) return null;
        return (
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <div className="h-px bg-gray-100 flex-grow"></div>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] px-4 py-1 bg-white border border-gray-100 rounded-full shadow-sm">
                        {label}
                    </span>
                    <div className="h-px bg-gray-100 flex-grow"></div>
                </div>
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                    {items.map(m => {
                        const isProcessing = m.status === 'processing';
                        return (
                            <div 
                                key={m.id} 
                                onClick={() => !isProcessing && navigate(`/subjects/${m.subject_id}`, { state: { openMaterialId: m.id } })}
                                className={`group relative bg-white border border-gray-100 rounded-[1.5rem] p-6 transition-all duration-300 hover:shadow-xl hover:scale-[1.02] cursor-pointer ${isProcessing ? 'cursor-wait opacity-80' : ''} ${viewMode === 'list' ? 'flex items-center justify-between py-4' : ''}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shrink-0 ${isProcessing ? 'bg-indigo-50' : 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white'}`}>
                                        {isProcessing ? (
                                            <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                        ) : m.type === 'upload' ? (
                                            <FileText className="w-6 h-6" />
                                        ) : (
                                            <BookOpen className="w-6 h-6" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-grow">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-gray-900 truncate group-hover:text-indigo-600 transition-colors">{m.title}</h4>
                                            {isProcessing && (
                                                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded animate-pulse">
                                                    AI Processing
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="px-2 py-0.5 rounded-md bg-gray-50 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
                                                {m.subject_name || 'Imported'}
                                            </span>
                                            <span className="text-[10px] text-gray-300 font-medium flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {format(new Date(m.created_at), 'h:mm a')}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {viewMode === 'grid' && (
                                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                                        <div className="text-xs text-gray-400 font-medium line-clamp-1">
                                            {isProcessing ? "AI is refining knowledge..." : m.ai_generated_content?.result ? "AI Insights Ready" : "Document Active"}
                                        </div>
                                        <button 
                                            onClick={(e) => handleDelete(e, m.id)}
                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}

                                {viewMode === 'list' && (
                                    <div className="flex items-center gap-4">
                                        <button 
                                            onClick={(e) => handleDelete(e, m.id)}
                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                        {!isProcessing && <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-indigo-500 transition-colors" />}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="history-page max-w-7xl mx-auto px-6 py-12 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-indigo-500 font-bold text-xs uppercase tracking-[0.2em] mb-2">
                        <Calendar className="w-4 h-4" />
                        <span>Timeline</span>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 tracking-tight">Study History</h1>
                    <p className="text-gray-500 font-medium text-lg italic">Your journey of enlightenment, archived and ready for revision.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="relative group w-full sm:w-80">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search your archives..."
                            className="input-field pl-12 h-12 text-sm font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex bg-white p-1 rounded-xl border border-gray-100 shadow-sm">
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50'}`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="space-y-12">
                    {[1, 2].map(g => (
                        <div key={g}>
                            <Skeleton className="h-8 w-32 mx-auto mb-8 rounded-full" />
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="bg-white border border-gray-100 rounded-[1.5rem] p-6 h-48 flex flex-col justify-between">
                                        <div className="flex gap-4">
                                            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
                                            <div className="flex-grow space-y-2">
                                                <Skeleton className="h-5 w-3/4 rounded" />
                                                <Skeleton className="h-3 w-1/2 rounded" />
                                            </div>
                                        </div>
                                        <Skeleton className="h-8 w-full rounded-xl" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : materials.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-gray-100 rounded-[3rem] bg-white/50 backdrop-blur-sm">
                    <div className="w-20 h-20 bg-indigo-50 text-indigo-200 rounded-full flex items-center justify-center mx-auto mb-6">
                        <BookOpen className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">The archives are empty</h3>
                    <p className="text-gray-400 font-medium max-w-sm mx-auto mb-8">Start your learning journey by uploading sources or chatting with your AI garden.</p>
                    <button onClick={() => navigate('/upload')} className="btn-vibrant px-10 py-4 shadow-xl shadow-purple-200/50">Grow First Document</button>
                </div>
            ) : (
                <div className="animate-in slide-in-from-bottom-4 duration-700">
                    {renderGroup('Today', groupedMaterials.today)}
                    {renderGroup('Yesterday', groupedMaterials.yesterday)}
                    {renderGroup('Last Week', groupedMaterials.lastWeek)}
                    {renderGroup('The Elder Archives', groupedMaterials.earlier)}
                </div>
            )}

            <p className="text-center mt-20 text-[10px] font-black text-gray-300 uppercase tracking-[0.5em]">
                Cognify &bull; Knowledge Eternal
            </p>
        </div>
    );
};

export default History;
