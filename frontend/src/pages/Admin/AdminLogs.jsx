import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import {
    Activity, Search, Filter, AlertTriangle, ShieldCheck, UserCog,
    Database, Clock, RefreshCw, UserX, UserCheck, Key, Trash2,
    HardDrive, Settings, FileText, LogIn, ChevronDown, Info
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import Skeleton from '@/components/ui/Skeleton';

// ─── Human-readable log enrichment ───────────────────────────────────────────
const ACTION_MAP = {
    // User management
    UPDATE_STATUS:     { label: 'Status Changed',     icon: ShieldCheck, color: 'orange',  level: 'warning' },
    UPDATE_ROLE:       { label: 'Role Changed',        icon: Key,         color: 'blue',    level: 'info' },
    DELETE_USER:       { label: 'User Deleted',        icon: UserX,       color: 'red',     level: 'critical' },
    SUSPEND_USER:      { label: 'User Suspended',      icon: UserX,       color: 'red',     level: 'critical' },
    ACTIVATE_USER:     { label: 'User Activated',      icon: UserCheck,   color: 'green',   level: 'info' },
    UPDATE_QUOTA:      { label: 'Quota Updated',       icon: HardDrive,   color: 'purple',  level: 'warning' },
    // System
    CLEANUP_STORAGE:   { label: 'Storage Cleanup',     icon: HardDrive,   color: 'teal',    level: 'info' },
    DELETE_FILE:       { label: 'File Deleted',        icon: Trash2,      color: 'red',     level: 'critical' },
    UPDATE_SETTINGS:   { label: 'Settings Updated',    icon: Settings,    color: 'gray',    level: 'info' },
    LOGIN:             { label: 'Admin Login',         icon: LogIn,       color: 'green',   level: 'info' },
    CREATE_USER:       { label: 'User Created',        icon: UserCheck,   color: 'green',   level: 'info' },
    VIEW_LOGS:         { label: 'Logs Viewed',         icon: FileText,    color: 'gray',    level: 'info' },
};

const COLOR_MAP = {
    red:    { bg: 'bg-red-50',    border: 'border-red-100',    icon: 'text-red-500',    badge: 'bg-red-50 text-red-700 border-red-100' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-100', icon: 'text-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-100' },
    blue:   { bg: 'bg-blue-50',   border: 'border-blue-100',   icon: 'text-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-100' },
    green:  { bg: 'bg-emerald-50',border: 'border-emerald-100',icon: 'text-emerald-500',badge: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-100', icon: 'text-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-100' },
    teal:   { bg: 'bg-teal-50',   border: 'border-teal-100',   icon: 'text-teal-500',   badge: 'bg-teal-50 text-teal-700 border-teal-100' },
    gray:   { bg: 'bg-gray-50',   border: 'border-gray-100',   icon: 'text-gray-400',   badge: 'bg-gray-50 text-gray-600 border-gray-100' },
};

function getConfig(action) {
    const key = (action || '').toUpperCase();
    return ACTION_MAP[key] || { label: action, icon: Activity, color: 'gray', level: 'info' };
}

function buildDescription(log) {
    const d = log.details || {};
    const actor = log.user_name || log.user_email || 'System';
    const target = d.target_name || d.email || d.name || log.target_id || '';
    const action = (log.action || '').toUpperCase();

    if (action === 'UPDATE_STATUS')
        return `${actor} changed "${target}"'s status from ${d.previous_status || '—'} to ${d.new_status || d.status || '—'}${d.reason ? ` (Reason: ${d.reason})` : ''}.`;
    if (action === 'UPDATE_ROLE')
        return `${actor} changed "${target}"'s role from ${d.previous_role || '—'} to ${d.role || d.new_role || '—'}.`;
    if (action === 'DELETE_USER')
        return `${actor} permanently deleted user "${target}".`;
    if (action === 'UPDATE_QUOTA')
        return `${actor} set storage quota for "${target}" to ${d.limit_mb != null ? `${d.limit_mb} MB` : '—'}.`;
    if (action === 'CLEANUP_STORAGE')
        return `${actor} ran a storage cleanup — freed ${d.space_freed_bytes != null ? Math.round(d.space_freed_bytes / 1024) + ' KB' : '—'}.`;
    if (action === 'DELETE_FILE')
        return `${actor} deleted file "${d.file_name || target}".`;
    if (action === 'UPDATE_SETTINGS')
        return `${actor} updated system settings.`;
    if (action === 'CREATE_USER')
        return `${actor} created user "${target}".`;
    if (action === 'ACTIVATE_USER')
        return `${actor} activated user "${target}".`;
    if (action === 'SUSPEND_USER')
        return `${actor} suspended user "${target}".`;
    if (action === 'LOGIN')
        return `${actor} signed in to the admin dashboard.`;
    if (target) return `${actor} performed "${log.action}" on "${target}".`;
    return `${actor} performed "${log.action}".`;
}

function formatGroupDate(dateStr) {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMMM d, yyyy');
}

function groupByDate(logs) {
    const groups = {};
    for (const log of logs) {
        const key = format(new Date(log.created_at), 'yyyy-MM-dd');
        if (!groups[key]) groups[key] = { date: log.created_at, items: [] };
        groups[key].items.push(log);
    }
    return Object.values(groups);
}

// ─── Expandable details panel ─────────────────────────────────────────────────
function LogDetailJSON({ details }) {
    const [open, setOpen] = useState(false);
    if (!details || Object.keys(details).length === 0) return null;
    return (
        <div className="mt-3">
            <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-indigo-500 transition-colors"
            >
                <Info className="w-3 h-3" />
                Raw Details
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <pre className="mt-2 bg-gray-900 text-green-400 rounded-xl p-3 text-[11px] font-mono overflow-x-auto shadow-inner max-h-40">
                    {JSON.stringify(details, null, 2)}
                </pre>
            )}
        </div>
    );
}

const PAGE_SIZE = 5;

// ─── Main Component ───────────────────────────────────────────────────────────
const AdminLogs = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState('all');
    const [showAll, setShowAll] = useState(false);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await adminService.getLogs();
            setLogs(res.data.data || []);
            setVisibleCount(PAGE_SIZE);
        } catch {
            toast.error('Failed to load system logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, []);
    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [searchQuery, filterLevel]);

    const stats = useMemo(() => ({
        total: logs.length,
        critical: logs.filter(l => getConfig(l.action).level === 'critical').length,
        warning: logs.filter(l => getConfig(l.action).level === 'warning').length,
    }), [logs]);

    const filtered = useMemo(() => logs.filter(log => {
        const config = getConfig(log.action);
        const desc = buildDescription(log).toLowerCase();
        const matchesSearch =
            desc.includes(searchQuery.toLowerCase()) ||
            (log.action && log.action.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.user_name && log.user_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (log.user_email && log.user_email.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesLevel =
            filterLevel === 'all' ||
            config.level === filterLevel;
        return matchesSearch && matchesLevel;
    }), [logs, searchQuery, filterLevel]);

    const grouped = useMemo(() => groupByDate(filtered.slice(0, visibleCount)), [filtered, visibleCount]);

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">Activity Log</h1>
                    <p className="text-gray-500 font-medium">Complete audit trail of administrator and system actions.</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-gray-800 transition-colors shadow-xl shadow-gray-200 group active:scale-95"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    Refresh
                </button>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                    { label: 'Total Events', value: stats.total, color: 'text-gray-800', bg: 'bg-white' },
                    { label: 'Critical Actions', value: stats.critical, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Warnings', value: stats.warning, color: 'text-orange-600', bg: 'bg-orange-50' },
                ].map(s => (
                    <div key={s.label} className={`${s.bg} border border-gray-100 rounded-2xl p-4 text-center shadow-sm`}>
                        <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-0.5">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white p-3 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 border border-gray-100 shadow-sm mb-8">
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative">
                        <select
                            className="pl-3 pr-8 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-bold text-gray-600 border border-transparent focus:bg-white focus:border-indigo-100 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                            value={filterLevel}
                            onChange={(e) => setFilterLevel(e.target.value)}
                        >
                            <option value="all">All Events</option>
                            <option value="info">Informational</option>
                            <option value="warning">Warnings</option>
                            <option value="critical">Critical</option>
                        </select>
                        <Filter className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest shrink-0">{filtered.length} shown</span>
                </div>

                <div className="relative w-full md:w-80 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search by action, user, or entity..."
                        className="w-full bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-700 outline-none border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 rounded-xl py-2.5 pl-11 pr-4 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Timeline */}
            {loading ? (
                <div className="space-y-6">
                    {Array(5).fill(0).map((_, i) => (
                        <div key={i} className="flex gap-4 items-start">
                            <Skeleton className="w-11 h-11 rounded-2xl shrink-0" />
                            <div className="space-y-2 w-full pt-1">
                                <Skeleton className="h-4 w-1/3" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="py-24 text-center bg-white rounded-3xl border border-gray-100">
                    <div className="w-16 h-16 bg-gray-50 rounded-3xl flex items-center justify-center text-gray-300 mx-auto mb-4 border border-gray-100">
                        <Activity className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">No events found</h3>
                    <p className="text-gray-500 font-medium">Try adjusting your filters or search query.</p>
                </div>
            ) : (
                <>
                <div className="space-y-8">
                    {grouped.map((group) => (
                        <div key={group.date}>
                            <div className="flex items-center gap-3 mb-4">
                                <span className="text-xs font-black text-gray-400 uppercase tracking-[0.2em]">
                                    {formatGroupDate(group.date)}
                                </span>
                                <div className="flex-1 h-px bg-gray-100" />
                            </div>

                            <div className="space-y-3">
                                {group.items.map((log) => {
                                    const config = getConfig(log.action);
                                    const colors = COLOR_MAP[config.color] || COLOR_MAP.gray;
                                    const Icon = config.icon;
                                    const desc = buildDescription(log);
                                    const time = format(new Date(log.created_at), 'HH:mm:ss');

                                    return (
                                        <div key={log.id} className="flex gap-4 items-start group">
                                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-110 ${colors.bg} ${colors.border}`}>
                                                <Icon className={`w-5 h-5 ${colors.icon}`} />
                                            </div>
                                            <div className="flex-1 bg-white border border-gray-100 group-hover:border-gray-200 group-hover:shadow-md transition-all rounded-2xl p-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${colors.badge}`}>
                                                            {config.label}
                                                        </span>
                                                        {log.user_name && (
                                                            <span className="text-xs font-bold text-gray-500">
                                                                by <span className="text-gray-800">{log.user_name}</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400 tracking-widest shrink-0">
                                                        <Clock className="w-3 h-3" />
                                                        {time}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-gray-700 font-medium leading-relaxed">{desc}</p>
                                                <LogDetailJSON details={log.details} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {visibleCount < filtered.length && (
                    <div className="mt-8 flex flex-col items-center gap-2">
                        <button
                            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                            className="px-8 py-3 bg-white border border-gray-100 rounded-full text-sm font-black text-gray-600 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50/50 transition-all flex items-center gap-2"
                        >
                            <ChevronDown className="w-4 h-4" />
                            Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
                            <span className="text-gray-400 font-bold">({filtered.length - visibleCount} remaining)</span>
                        </button>
                    </div>
                )}
                </>
            )}
        </div>
    );
};

export default AdminLogs;
