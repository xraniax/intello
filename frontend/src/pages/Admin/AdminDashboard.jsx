import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { Users, HardDrive, Activity, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/ui/Skeleton';
import { formatDistanceToNow } from 'date-fns';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [usersRes, settingsRes, logsRes] = await Promise.all([
                    adminService.getUsers(),
                    adminService.getSettings(),
                    adminService.getLogs()
                ]);
                
                const users = usersRes.data.data || [];
                const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
                const now = Date.now();
                const onlineNow = users.filter(u => {
                    const lastActive = u.last_active_at ? new Date(u.last_active_at).getTime() : 0;
                    return now - lastActive < ONLINE_THRESHOLD_MS;
                }).length;
                const settings = settingsRes.data.data.storage || {};
                const statsFromSettings = settingsRes.data.data.stats || {};
                const totalStorage = statsFromSettings.total_storage_bytes || users.reduce((acc, u) => acc + (parseInt(u.storage_usage_bytes) || 0), 0) || 0;
                
                // Calculate ALerts dynamically
                const defaultQuota = (settings.default_user_quota_mb || 100) * 1024 * 1024;
                const nearQuotaUsers = users.filter(u => {
                    const limit = u.storage_limit_bytes || defaultQuota;
                    const usage = parseInt(u.storage_usage_bytes) || 0;
                    return limit > 0 && usage > limit * 0.9;
                });

                const newAlerts = [];
                if (nearQuotaUsers.length > 0) {
                    newAlerts.push({
                        id: 'quota',
                        title: 'Quota Warning',
                        message: `${nearQuotaUsers.length} user(s) are approaching their storage limit.`,
                        type: 'warning'
                    });
                }
                
                if (newAlerts.length === 0) {
                    newAlerts.push({
                        id: 'system',
                        title: 'System Optimal',
                        message: 'All cluster nodes are operating within strict limits.',
                        type: 'success'
                    });
                }

                setStats({
                    totalUsers: users.length,
                    onlineNow,
                    totalStorage
                });
                setAlerts(newAlerts);
                
                const fetchedLogs = logsRes.data.data?.logs || logsRes.data.data || [];
                setLogs(Array.isArray(fetchedLogs) ? fetchedLogs.slice(0, 5) : []);

            } catch (err) {
                console.error("Dashboard dataload error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardData();
    }, []);

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const index = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, index)).toFixed(2)) + ' ' + ['Bytes', 'KB', 'MB', 'GB', 'TB'][index];
    };

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto animate-in fade-in duration-500">
            <div className="mb-8 group">
                <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-widest mb-1" style={{ color: 'var(--c-primary)' }}>
                    <div className="w-1.5 h-1.5 rounded-full anim-pulse" style={{ background: 'var(--c-primary)' }}></div>
                    <span>Admin Console</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--c-text)', letterSpacing: '-0.03em' }}>
                    System <span className="text-gradient-hero">Overview</span>
                </h1>
                <p className="font-medium text-lg mt-2" style={{ color: 'var(--c-text-secondary)' }}>Real-time metrics and system health monitoring.</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="card-minimal flex flex-col relative overflow-hidden group">
                    <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-4 transition-all" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-ultra)' }}>
                        <Users className="w-5 h-5" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-muted)' }}>Total Users</p>
                    <h3 className="text-[28px] font-black font-serif tracking-tight" style={{ color: 'var(--c-text)' }}>{loading ? <Skeleton className="w-16 h-8" /> : stats?.totalUsers}</h3>
                </div>

                <div className="card-minimal flex flex-col relative overflow-hidden group">
                    <div className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-4 transition-all" style={{ background: 'var(--c-coral-light)', color: 'var(--c-coral)', border: '1px solid rgba(255,107,107,0.1)' }}>
                        <Activity className="w-5 h-5" />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-muted)' }}>Online Now</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full anim-pulse shrink-0" style={{ background: 'var(--c-success)' }}></span>
                        <h3 className="text-[28px] font-black font-serif tracking-tight" style={{ color: 'var(--c-text)' }}>{loading ? <Skeleton className="w-16 h-8" /> : stats?.onlineNow}</h3>
                    </div>
                    <p className="text-[10px] font-bold mt-1" style={{ color: 'var(--c-text-muted)' }}>Active within 5 min</p>
                </div>

                <div className="card-minimal flex flex-col relative overflow-hidden group lg:col-span-2">
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 rounded-[14px] flex items-center justify-center transition-all bg-white shadow-sm border border-gray-100" style={{ color: 'var(--c-teal)' }}>
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--c-text-muted)' }}>Cluster Storage</p>
                            <h3 className="text-[28px] font-black font-serif tracking-tight" style={{ color: 'var(--c-text)' }}>{loading ? <Skeleton className="w-24 h-8" /> : formatBytes(stats?.totalStorage || 0)}</h3>
                        </div>
                    </div>
                    
                    <div className="mt-auto">
                        <div className="flex justify-between text-[10px] font-bold uppercase mb-2 tracking-widest" style={{ color: 'var(--c-text-muted)' }}>
                            <span>Utilized</span>
                            <span>10 GB Cap</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-surface-alt)' }}>
                            <div className="h-full rounded-full transition-all duration-1000" style={{ background: 'var(--c-teal)', width: `${Math.min(((stats?.totalStorage || 0) / 10737418240) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 card-minimal">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-[17px] font-bold" style={{ color: 'var(--c-text)' }}>Recent Activity Feed</h2>
                        <Link to="/admin/logs" className="text-[11px] font-bold uppercase tracking-widest hover:opacity-80 transition-opacity" style={{ color: 'var(--c-primary)' }}>
                            View All
                        </Link>
                    </div>
                    
                    <div className="space-y-6">
                        {loading ? (
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="w-10 h-10 rounded-[14px] shrink-0" />
                                    <div className="space-y-2 w-full">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/4" />
                                    </div>
                                </div>
                            ))
                        ) : logs.length === 0 ? (
                            <div className="py-20 text-center font-medium" style={{ color: 'var(--c-text-muted)' }}>No recent activity found.</div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="flex gap-4 items-start pb-4 border-b last:border-0 last:pb-0" style={{ borderColor: 'var(--c-border-soft)' }}>
                                    <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm border" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)' }}>
                                        <Activity className="w-4 h-4" style={{ color: 'var(--c-text-muted)' }} />
                                    </div>
                                    <div>
                                        <p className="text-[14px] font-bold leading-tight mb-1" style={{ color: 'var(--c-text)' }}>{log.action}</p>
                                        <p className="text-[12px] font-medium" style={{ color: 'var(--c-text-secondary)' }}>
                                            {log.entity_type} {log.target_user_id ? `• User Context ` : ''} 
                                            <span className="font-semibold ml-1" style={{ color: 'var(--c-primary)' }}>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="card-minimal">
                    <h2 className="text-[17px] font-bold mb-8 flex items-center gap-2" style={{ color: 'var(--c-text)' }}>
                        <ShieldAlert className="w-5 h-5" /> System Alerts
                    </h2>
                    
                    <div className="space-y-4">
                        {loading ? (
                            <Skeleton className="h-20 w-full rounded-[20px]" />
                        ) : alerts.length > 0 ? (
                            alerts.map(alert => (
                                <div key={alert.id} className="p-4 rounded-[18px] flex gap-4" style={{ 
                                    background: alert.type === 'warning' ? 'var(--c-warning-light)' : 'var(--c-success-light)',
                                    border: `1px solid ${alert.type === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'}`
                                }}>
                                    <div className="shrink-0 w-2 h-2 mt-2 rounded-full anim-pulse" style={{ background: alert.type === 'warning' ? 'var(--c-warning)' : 'var(--c-success)' }}></div>
                                    <div>
                                        <p className="text-[14px] font-bold mb-1 flex items-center gap-1.5" style={{ color: 'var(--c-text)' }}>
                                            {alert.type === 'success' && <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--c-success)' }} />}
                                            {alert.title}
                                        </p>
                                        <p className="text-[13px] font-medium" style={{ color: 'var(--c-text-secondary)' }}>{alert.message}</p>
                                    </div>
                                </div>
                            ))
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
