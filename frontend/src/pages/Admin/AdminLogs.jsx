import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import {
    Activity, Search, Filter, AlertTriangle, ShieldCheck, UserCog,
    Database, Clock, RefreshCw, UserX, UserCheck, Key, Trash2,
    HardDrive, Settings, FileText, LogIn, ChevronDown, Info,
    Cpu, Zap, Globe, Server, BarChart3
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import Skeleton from '@/components/ui/Skeleton';
import ActivityStream from '@/components/Admin/ActivityStream';

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
    SECURITY_LOCKOUT:  { label: 'Security Lockout',    icon: ShieldCheck, color: 'red',     level: 'critical' },
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
    if (action === 'SECURITY_LOCKOUT')
        return `SYSTEM automatically locked account "${target}" for security (10+ failures).`;
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
    const [sysStats, setSysStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterLevel, setFilterLevel] = useState('all');
    const [showAll, setShowAll] = useState(false);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [activeTab, setActiveTab] = useState('audit'); // audit, behavior, security
    const [behaviorAction, setBehaviorAction] = useState(null);
    const [securityData, setSecurityData] = useState(null);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const [logsRes, sysRes, analyticsRes, securityRes] = await Promise.all([
                adminService.getLogs(),
                adminService.getStats(),
                adminService.getAnalytics(),
                adminService.getSecurityAnalytics()
            ]);
            setLogs(logsRes.data.data || []);
            setSysStats(sysRes.data?.data || null);
            setBehaviorAction(analyticsRes.data?.data || null);
            setSecurityData(securityRes.data?.data || null);
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
        <div className="w-full px-4 sm:px-6 md:px-12 py-10 animate-in fade-in duration-500 relative overflow-hidden">
            {/* Ambient decorative orb */}
            <div className="fixed top-[-10%] left-[-5%] w-[500px] h-[500px] bg-emerald-200/30 blur-[120px] rounded-full -z-10 animate-pulse pointer-events-none" />
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] mb-4 text-emerald-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 anim-pulse"></div>
                        <span>Protocol Delta</span>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 tracking-tight mb-2">
                        System <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">Monitoring</span>
                    </h1>
                    <p className="text-gray-500 font-medium">Real-time health analytics and comprehensive audit data.</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-gray-800 transition-colors shadow-xl shadow-gray-200 group active:scale-95"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    Refresh
                </button>
            </div>

            {/* Monitoring Hub (Analytics) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
                {[
                    { label: 'API Latency', value: sysStats?.latency || '24ms', sub: 'Healthy', icon: Zap, color: 'emerald' },
                    { label: 'CPU Cluster', value: sysStats ? `${sysStats.cpu}%` : '12.5%', sub: 'Stable', icon: Cpu, color: 'sky' },
                    { label: 'Memory Load', value: sysStats ? `${sysStats.memory.percentage}%` : '64.2%', sub: 'Normal', icon: Database, color: 'fuchsia' },
                    { label: 'Global Uptime', value: '99.9%', sub: 'Reliable', icon: Globe, color: 'amber' },
                ].map((stat, i) => (
                    <div key={i} className="glass-card p-6 rounded-3xl border border-white/60 shadow-xl shadow-gray-100/30 group relative overflow-hidden">
                        <div className={`absolute -right-4 -top-4 w-20 h-20 opacity-10 bg-${stat.color}-400 blur-2xl rounded-full group-hover:opacity-20 transition-opacity`} />
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`w-10 h-10 rounded-xl bg-${stat.color}-50 flex items-center justify-center text-${stat.color}-500 border border-${stat.color}-100`}>
                                <stat.icon className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{stat.label}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-gray-900 tracking-tighter">{stat.value}</span>
                            <span className={`text-[10px] font-black uppercase text-${stat.color}-500 tracking-widest`}>{stat.sub}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Content Tabs / Sections */}
            <div className="flex items-center gap-8 mb-8 border-b border-gray-100 pb-px">
                <button 
                    onClick={() => setActiveTab('audit')}
                    className={`pb-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'audit' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Audit Logs
                    {activeTab === 'audit' && <div className="absolute -top-1 -right-4 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                </button>
                <button 
                    onClick={() => setActiveTab('behavior')}
                    className={`pb-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'behavior' ? 'text-emerald-500 border-b-2 border-emerald-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    User Behavior
                    {activeTab === 'behavior' && <div className="absolute -top-1 -right-4 w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
                </button>
                <button 
                    onClick={() => setActiveTab('security')}
                    className={`pb-4 text-sm font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'security' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-400 hover:text-gray-600'}`}
                >
                    Security
                    {activeTab === 'security' && <div className="absolute -top-1 -right-4 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />}
                </button>
                <button className="pb-4 text-sm font-black uppercase tracking-[0.2em] text-gray-300 cursor-not-allowed">
                    Performance
                </button>
            </div>

            {/* Content Rendering */}
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
            ) : activeTab === 'behavior' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                        {/* DAU Card */}
                        <div className="glass-card p-8 rounded-[3rem] border border-white/60 shadow-xl shadow-gray-100/30">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                                        <BarChart3 className="w-5 h-5" />
                                    </div>
                                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Engagement Pulse</h3>
                                </div>
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-3 py-1 rounded-full">Last 30 Days</span>
                            </div>
                            
                            <div className="flex items-end gap-1.5 h-48 mb-6">
                                {(behaviorAction?.dau || []).map((d, i) => (
                                    <div key={i} className="flex-1 group relative">
                                        <div 
                                            className="w-full bg-emerald-400/20 group-hover:bg-emerald-400/40 transition-all rounded-t-lg relative"
                                            style={{ height: `${Math.max(10, (d.count / Math.max(...behaviorAction.dau.map(x => x.count))) * 100)}%` }}
                                        >
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-black py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                                {d.count} Users
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <span>30d ago</span>
                                <span>Today</span>
                            </div>
                        </div>

                        {/* Top Subjects */}
                        <div className="glass-card p-8 rounded-[3rem] border border-white/60 shadow-xl shadow-gray-100/30">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                                    <Globe className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Academic Hotspots</h3>
                            </div>
                            <div className="space-y-6">
                                {(behaviorAction?.topSubjects || []).map((s, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex justify-between items-end">
                                            <span className="text-sm font-black text-gray-700">{s.name}</span>
                                            <span className="text-xs font-black text-indigo-500">{s.count} Materials</span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                                            <div 
                                                className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full"
                                                style={{ width: `${(s.count / behaviorAction.topSubjects[0].count) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Study Activity Trends */}
                    <div className="glass-card p-8 rounded-[3rem] border border-white/60 shadow-xl shadow-gray-100/30 mb-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-fuchsia-50 flex items-center justify-center text-fuchsia-500">
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Study Velocity</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-2xl font-black text-fuchsia-500">
                                            {(behaviorAction?.studyActivity || []).reduce((acc, curr) => acc + curr.count, 0)}
                                        </span>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Events (30D)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-fuchsia-500" />
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Quizzes</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500" />
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Flashcards</span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex items-end gap-2 h-40 mb-4">
                            {/* Grouping studyActivity by date for drawing composite bars */}
                            {(() => {
                                const grouped = (behaviorAction?.studyActivity || []).reduce((acc, curr) => {
                                    const date = format(new Date(curr.date), 'yyyy-MM-dd');
                                    if (!acc[date]) acc[date] = { date, quiz: 0, flashcard: 0 };
                                    acc[date][curr.type] = curr.count;
                                    return acc;
                                }, {});
                                const days = Object.values(grouped).slice(-14); // Last 14 days of activity
                                const max = Math.max(...days.map(d => d.quiz + d.flashcard), 1);
                                
                                return days.map((d, i) => (
                                    <div key={i} className="flex-1 flex flex-col justify-end gap-0.5 group relative">
                                        <div 
                                            className="w-full bg-indigo-400 rounded-sm group-hover:bg-indigo-500 transition-colors"
                                            style={{ height: `${(d.flashcard / max) * 100}%` }}
                                        />
                                        <div 
                                            className="w-full bg-fuchsia-400 rounded-sm group-hover:bg-fuchsia-500 transition-colors"
                                            style={{ height: `${(d.quiz / max) * 100}%` }}
                                        />
                                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-black py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                            {d.quiz} Q / {d.flashcard} F
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    {/* Activity Distribution */}
                    <div className="glass-card p-8 rounded-[3rem] border border-white/60 shadow-xl shadow-gray-100/30 mb-12">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                                <Zap className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Operational Distribution</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            {(behaviorAction?.activityDistribution || []).slice(0, 5).map((act, i) => (
                                <div key={i} className="p-6 bg-white border border-gray-100 rounded-[2rem] hover:shadow-lg transition-all group">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1 group-hover:text-indigo-500 transition-colors">{act.action.replace(/_/g, ' ')}</span>
                                    <span className="text-3xl font-black text-gray-900 tracking-tighter">{act.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : activeTab === 'security' ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
                        {/* Threat Hotspots */}
                        <div className="glass-card p-8 rounded-[3rem] border border-white/60 shadow-xl shadow-gray-100/30">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Threat Hotspots</h3>
                            </div>
                            <div className="space-y-6">
                                {(securityData?.ipThreats || []).length === 0 ? (
                                    <p className="text-sm font-bold text-gray-400 py-4 text-center">No active threats detected</p>
                                ) : (
                                    securityData.ipThreats.map((t, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-gray-900">{t.ip_address}</span>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{t.active_tuples} targeted accounts</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg font-black text-red-500">{t.total_failures}</span>
                                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1">Failures</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Recent Suspensions */}
                        <div className="glass-card p-8 rounded-[3rem] border border-white/60 shadow-xl shadow-gray-100/30">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                                    <UserX className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Restricted Accounts</h3>
                            </div>
                            <div className="space-y-4">
                                {(securityData?.suspendedUsers || []).length === 0 ? (
                                    <p className="text-sm font-bold text-gray-400 py-4 text-center">No accounts currently restricted</p>
                                ) : (
                                    securityData.suspendedUsers.map((u, i) => (
                                        <div key={i} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl hover:shadow-md transition-all">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-gray-900">{u.name}</span>
                                                <span className="text-xs font-bold text-gray-500">{u.email}</span>
                                            </div>
                                            <button 
                                                onClick={async () => {
                                                    try {
                                                        await adminService.updateUserStatus(u.id, 'ACTIVE', 'Admin security override');
                                                        toast.success(`Account for ${u.email} reactivated`);
                                                        fetchLogs();
                                                    } catch {
                                                        toast.error('Failed to reactivate account');
                                                    }
                                                }}
                                                className="px-4 py-2 bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest rounded-xl border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                            >
                                                Unlock
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Security Events Pulse */}
                    <div className="glass-card p-8 rounded-[3rem] border border-white/60 shadow-xl shadow-gray-100/30">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center text-white">
                                <Activity className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Security Incident Feed</h3>
                        </div>
                        <div className="space-y-4">
                            {(securityData?.securityLogs || []).slice(0, 10).map((log, i) => (
                                <div key={i} className="flex gap-4 items-center p-4 border-l-4 border-red-500 bg-red-50/30 rounded-r-2xl">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-gray-900">{log.action}</p>
                                        <p className="text-xs font-medium text-gray-500">{format(new Date(log.created_at), 'MMM d, HH:mm:ss')} — {log.user_email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
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
                    {/* Filters (only for audit) */}
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
