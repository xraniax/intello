import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { Activity, Search, Filter, AlertTriangle, ShieldCheck, UserCog, Database, Clock, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Skeleton from '@/components/ui/Skeleton';

const AdminLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState('all');

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await adminService.getLogs();
            setLogs(res.data.data || []);
        } catch (err) {
            toast.error('Failed to load system logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const filteredLogs = logs.filter(log => {
        const matchesSearch = 
            (log.action && log.action.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.target_type && log.target_type.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.details && JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase()));
        
        // Mock filtering logic based on action strings since there is no explicit 'level' field
        const matchesLevel = filterLevel === 'all' || 
            (filterLevel === 'critical' && (log.action.includes('delete') || log.action.includes('suspend'))) ||
            (filterLevel === 'info' && (!log.action.includes('delete') && !log.action.includes('suspend')));

        return matchesSearch && matchesLevel;
    });

    const getLogIcon = (action) => {
        const actionStr = action.toLowerCase();
        if (actionStr.includes('delete') || actionStr.includes('remove')) return <AlertTriangle className="w-5 h-5 text-red-500" />;
        if (actionStr.includes('suspend') || actionStr.includes('quota')) return <ShieldCheck className="w-5 h-5 text-orange-500" />;
        if (actionStr.includes('role') || actionStr.includes('user')) return <UserCog className="w-5 h-5 text-blue-500" />;
        if (actionStr.includes('file') || actionStr.includes('storage')) return <Database className="w-5 h-5 text-purple-500" />;
        return <Activity className="w-5 h-5 text-gray-400" />;
    };

    const getLogColor = (action) => {
        const actionStr = action.toLowerCase();
        if (actionStr.includes('delete') || actionStr.includes('remove')) return 'bg-red-50 border-red-100';
        if (actionStr.includes('suspend') || actionStr.includes('quota')) return 'bg-orange-50 border-orange-100';
        if (actionStr.includes('role') || actionStr.includes('user')) return 'bg-blue-50 border-blue-100';
        if (actionStr.includes('file') || actionStr.includes('storage')) return 'bg-purple-50 border-purple-100';
        return 'bg-gray-50 border-gray-100';
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight lg:tracking-tighter mb-2">Activity Index</h1>
                    <p className="text-gray-500 font-medium">Immutable audit trail of administrator and system actions.</p>
                </div>
                <button 
                    onClick={fetchLogs} 
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-gray-800 transition-colors shadow-xl shadow-gray-200 group active:scale-95"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} /> Sync Stream
                </button>
            </div>

            {/* Quick Stats & Filters */}
            <div className="bg-white p-3 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 border border-gray-100 shadow-sm relative z-20 mb-8">
                <div className="flex items-center gap-4 px-3 w-full md:w-auto overflow-x-auto scrollbar-hide">
                    <div className="flex items-center gap-2 shrink-0">
                        <Clock className="w-4 h-4 text-indigo-500" />
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{logs.length} Events Logged</span>
                    </div>
                    <div className="h-6 w-px bg-gray-200 hidden md:block"></div>
                    <div className="relative shrink-0">
                        <select 
                            className="w-36 pl-3 pr-8 py-2 bg-gray-50/50 hover:bg-gray-100 text-sm font-bold text-gray-600 border border-transparent focus:bg-white focus:border-indigo-100 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                            value={filterLevel}
                            onChange={(e) => setFilterLevel(e.target.value)}
                        >
                            <option value="all">All Events</option>
                            <option value="info">Informational</option>
                            <option value="critical">Critical Actions</option>
                        </select>
                        <Filter className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                </div>
                
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input 
                        type="text" 
                        placeholder="Search actions or entities..." 
                        className="w-full bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-700 outline-none border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 rounded-xl py-2.5 pl-11 pr-4 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Timeline View */}
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-6 md:p-10 relative overflow-hidden">
                <div className="absolute left-10 md:left-14 top-10 bottom-10 w-px bg-gray-100 z-0 hidden sm:block"></div>
                
                {loading ? (
                    <div className="space-y-8 relative z-10">
                        {Array(5).fill(0).map((_, i) => (
                            <div key={i} className="flex gap-6 items-start">
                                <Skeleton className="w-12 h-12 rounded-2xl shrink-0 hidden sm:block" />
                                <div className="space-y-2 w-full pt-1">
                                    <Skeleton className="h-5 w-1/3" />
                                    <Skeleton className="h-4 w-1/2" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : filteredLogs.length === 0 ? (
                    <div className="py-20 text-center relative z-10">
                        <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 mx-auto mb-4 border border-gray-100">
                            <Activity className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-gray-900 mb-2">No logs found</h3>
                        <p className="text-gray-500 font-medium">Try adjusting your filters or search query.</p>
                    </div>
                ) : (
                    <div className="space-y-6 relative z-10">
                        {filteredLogs.map((log) => (
                            <div key={log.id} className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-start group">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-110 hidden sm:flex ${getLogColor(log.action)}`}>
                                    {getLogIcon(log.action)}
                                </div>
                                <div className="flex-1 bg-gray-50/50 hover:bg-white border border-gray-100 group-hover:border-gray-200 group-hover:shadow-md transition-all rounded-3xl p-5 w-full">
                                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black uppercase tracking-widest text-indigo-500 bg-indigo-50 px-2.5 py-1 rounded-lg">
                                                {log.action}
                                            </span>
                                            <span className="text-sm font-bold text-gray-500">
                                                on target: <span className="text-gray-900">{log.target_type}</span>
                                            </span>
                                        </div>
                                        <div className="text-[10px] font-black uppercase text-gray-400 tracking-widest flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                                        </div>
                                    </div>
                                    <div className="bg-white border border-gray-100 rounded-xl p-3 font-mono text-xs text-gray-600 overflow-x-auto shadow-sm">
                                        {JSON.stringify(log.details)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminLogs;
