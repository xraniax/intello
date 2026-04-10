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
                <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-[0.2em] mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 anim-pulse"></div>
                    <span>Admin Console</span>
                </div>
                <h1 className="text-5xl font-black text-gray-900 tracking-tight">
                    System <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 drop-shadow-sm">Overview</span>
                </h1>
                <p className="text-gray-500 font-medium text-lg mt-2">Real-time metrics and system health monitoring.</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <div className="card-minimal flex flex-col relative overflow-hidden group">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center mb-4 border border-indigo-100">
                        <Users className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Users</p>
                    <h3 className="text-3xl font-black text-gray-900">{loading ? <Skeleton className="w-16 h-8" /> : stats?.totalUsers}</h3>
                </div>

                <div className="card-minimal flex flex-col relative overflow-hidden group">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center mb-4 border border-purple-100">
                        <Activity className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Online Now</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                        <h3 className="text-3xl font-black text-gray-900">{loading ? <Skeleton className="w-16 h-8" /> : stats?.onlineNow}</h3>
                    </div>
                    <p className="text-[10px] font-medium text-gray-400 mt-1">Active within 5 min</p>
                </div>

                <div className="card-minimal flex flex-col relative overflow-hidden group lg:col-span-2">
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100">
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Cluster Storage Utilized</p>
                            <h3 className="text-3xl font-black text-gray-900">{loading ? <Skeleton className="w-24 h-8" /> : formatBytes(stats?.totalStorage || 0)}</h3>
                        </div>
                    </div>
                    
                    <div className="mt-auto">
                        <div className="flex justify-between text-[10px] font-black uppercase text-gray-400 mb-2 tracking-widest">
                            <span>Utilized</span>
                            <span>10 GB Cap</span>
                        </div>
                        <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                            <div className="bg-gradient-to-r from-emerald-400 to-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(((stats?.totalStorage || 0) / 10737418240) * 100, 100)}%` }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 card-minimal">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-lg font-black text-gray-900">Recent Activity Feed</h2>
                        <Link to="/admin/logs" className="text-xs font-bold text-indigo-500 hover:text-indigo-600 transition-colors uppercase tracking-widest">
                            View All
                        </Link>
                    </div>
                    
                    <div className="space-y-6">
                        {loading ? (
                            Array(4).fill(0).map((_, i) => (
                                <div key={i} className="flex gap-4">
                                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                                    <div className="space-y-2 w-full">
                                        <Skeleton className="h-4 w-3/4" />
                                        <Skeleton className="h-3 w-1/4" />
                                    </div>
                                </div>
                            ))
                        ) : logs.length === 0 ? (
                            <div className="py-20 text-center text-gray-400 font-medium">No recent activity found.</div>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="flex gap-4 items-start pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100">
                                        <Activity className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900">{log.action}</p>
                                        <p className="text-xs text-gray-500 font-medium mt-0.5">
                                            {log.entity_type} • {log.target_user_id ? `User Context ` : ''} 
                                            <span className="text-indigo-400 font-semibold">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}</span>
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="card-minimal">
                    <h2 className="text-lg font-black text-gray-900 mb-8 flex items-center gap-2">
                        <ShieldAlert className="w-5 h-5 text-gray-900" /> System Alerts
                    </h2>
                    
                    <div className="space-y-4">
                        {loading ? (
                            <Skeleton className="h-20 w-full rounded-2xl" />
                        ) : alerts.length > 0 ? (
                            alerts.map(alert => (
                                <div key={alert.id} className={`p-4 rounded-2xl flex gap-4 ${alert.type === 'warning' ? 'bg-orange-50/50 border border-orange-100' : 'bg-emerald-50/50 border border-emerald-100'}`}>
                                    <div className={`shrink-0 w-2 h-2 mt-2 rounded-full animate-pulse ${alert.type === 'warning' ? 'bg-orange-400' : 'bg-emerald-400'}`}></div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                                            {alert.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                                            {alert.title}
                                        </p>
                                        <p className="text-xs font-medium text-gray-500">{alert.message}</p>
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
