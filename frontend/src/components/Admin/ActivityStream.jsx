import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import {
    Activity, ShieldCheck, Database, Clock, RefreshCw, 
    UserX, UserCheck, Key, Trash2, HardDrive, Settings, 
    FileText, LogIn, ChevronDown, Info, AlertTriangle
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import toast from 'react-hot-toast';
import Skeleton from '@/components/ui/Skeleton';

// ─── Human-readable log enrichment ───────────────────────────────────────────
const ACTION_MAP = {
    UPDATE_STATUS:     { label: 'Status Changed',     icon: ShieldCheck, color: 'orange',  level: 'warning' },
    UPDATE_ROLE:       { label: 'Role Changed',        icon: Key,         color: 'blue',    level: 'info' },
    DELETE_USER:       { label: 'User Deleted',        icon: UserX,       color: 'red',     level: 'critical' },
    SUSPEND_USER:      { label: 'User Suspended',      icon: UserX,       color: 'red',     level: 'critical' },
    ACTIVATE_USER:     { label: 'User Activated',      icon: UserCheck,   color: 'green',   level: 'info' },
    UPDATE_QUOTA:      { label: 'Quota Updated',       icon: HardDrive,   color: 'purple',  level: 'warning' },
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

const ActivityStream = ({ limit = 10, compact = false, showHeader = true }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        try {
            const res = await adminService.getLogs();
            setLogs(res.data.data?.slice(0, limit) || []);
        } catch {
            toast.error('Failed to sync activity stream');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchLogs(); }, [limit]);

    if (loading) {
        return (
            <div className="space-y-4">
                {Array(compact ? 3 : 5).fill(0).map((_, i) => (
                    <div key={i} className="flex gap-4 items-start">
                        <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                        <div className="space-y-2 w-full pt-1">
                            <Skeleton className="h-4 w-1/3" />
                            <Skeleton className="h-3 w-2/3" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (logs.length === 0) {
        return (
            <div className={`${compact ? 'py-10' : 'py-20'} text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200`}>
                <Activity className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">No activity detected</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {logs.map((log) => {
                const config = getConfig(log.action);
                const colors = COLOR_MAP[config.color] || COLOR_MAP.gray;
                const Icon = config.icon;
                const desc = buildDescription(log);
                const time = format(new Date(log.created_at), 'HH:mm');

                return (
                    <div key={log.id} className="flex gap-4 items-start group">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-110 ${colors.bg} ${colors.border}`}>
                            <Icon className={`w-4 h-4 ${colors.icon}`} />
                        </div>
                        <div className={`flex-1 ${compact ? '' : 'bg-white border border-gray-100 group-hover:border-gray-200 transition-all rounded-2xl p-4'}`}>
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${colors.badge}`}>
                                        {config.label}
                                    </span>
                                    {compact && log.user_name && (
                                        <span className="text-[10px] font-bold text-gray-400">
                                            {log.user_name.split(' ')[0]}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 text-[9px] font-black uppercase text-gray-300 tracking-widest">
                                    <Clock className="w-2.5 h-2.5" />
                                    {time}
                                </div>
                            </div>
                            <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600 font-medium leading-relaxed line-clamp-2`}>
                                {desc}
                            </p>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default ActivityStream;
