import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { Users, HardDrive, Activity, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Skeleton from '@/components/ui/Skeleton';
import { formatDistanceToNow } from 'date-fns';
import { formatBytes } from '@/utils/format';
import AdminAlertCentre from '@/components/Admin/AdminAlertCentre';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    const [logs, setLogs] = useState([]);
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
                const onlineNow = Math.max(1, users.filter(u => {
                    const lastActive = u.last_active_at ? new Date(u.last_active_at).getTime() : 0;
                    return now - lastActive < ONLINE_THRESHOLD_MS;
                }).length);
                const settings = settingsRes.data?.data?.storage || {};
                const statsFromSettings = settingsRes.data?.data?.stats || {};
                const totalStorage = statsFromSettings.total_storage_bytes || users.reduce((acc, u) => acc + (parseInt(u.storage_usage_bytes) || 0), 0) || 0;
                
                setStats({
                    totalUsers: users.length,
                    onlineNow,
                    totalStorage
                });
                
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


    return (
        <div className="relative min-h-[calc(100vh-64px)] p-6 md:p-10 max-w-7xl mx-auto overflow-hidden">
            {/* Ambient Decorative Orbs */}
            <div className="ambient-orb ambient-orb-lg ambient-orb-1 top-[-10%] left-[-5%] bg-indigo-200/40"></div>
            <div className="ambient-orb ambient-orb-md ambient-orb-2 bottom-[10%] right-[-5%] bg-purple-200/30"></div>
            <div className="ambient-orb ambient-orb-sm ambient-orb-3 top-[30%] right-[10%] bg-pink-100/20"></div>

            <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Hero Header */}
                <div className="mb-12 group">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.2em] mb-2 text-indigo-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 anim-pulse"></div>
                        <span>Command Center</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-3">
                        System Health <span className="text-gradient-hero">Overview</span>
                    </h1>
                    <p className="font-medium text-lg text-gray-500/80 max-w-2xl">
                        Monitor your platform's heartbeat. Real-time metrics, system health, and administrative audit trails.
                    </p>
                </div>

                {/* KPI Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                    {/* Total Users */}
                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-indigo-100/20 hover:shadow-2xl transition-all duration-300 group hover:-translate-y-1">
                        <div className="w-14 h-14 rounded-3xl flex items-center justify-center mb-6 transition-all bg-indigo-50 text-indigo-600 group-hover:scale-110 duration-500">
                            <Users className="w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-gray-400">Total Users</p>
                        <h3 className="text-4xl font-black tracking-tighter text-gray-900">
                            {loading ? <div className="w-16 h-10 bg-gray-100 rounded-lg animate-pulse" /> : stats?.totalUsers}
                        </h3>
                        <div className="mt-4 h-1 w-12 bg-indigo-100 rounded-full group-hover:w-full transition-all duration-700" />
                    </div>

                    {/* Online Now */}
                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-coral-100/20 hover:shadow-2xl transition-all duration-300 group hover:-translate-y-1">
                        <div className="w-14 h-14 rounded-3xl flex items-center justify-center mb-6 transition-all bg-coral-light text-coral group-hover:scale-110 duration-500">
                            <Activity className="w-6 h-6" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-gray-400">Live Presence</p>
                        <div className="flex items-center gap-3">
                            <h3 className="text-4xl font-black tracking-tighter text-gray-900">
                                {loading ? <div className="w-16 h-10 bg-gray-100 rounded-lg animate-pulse" /> : stats?.onlineNow}
                            </h3>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 anim-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]"></span>
                        </div>
                        <p className="text-[10px] font-bold mt-2 text-emerald-600/80 uppercase">Active within 5m</p>
                    </div>

                    {/* Cluster Storage */}
                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-teal-100/20 hover:shadow-2xl transition-all duration-300 group hover:-translate-y-1 lg:col-span-2 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-14 h-14 rounded-3xl flex items-center justify-center transition-all bg-teal-light text-teal group-hover:scale-110 duration-500">
                                <HardDrive className="w-6 h-6" />
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-gray-400">Cluster Infrastructure</p>
                                <h3 className="text-4xl font-black tracking-tighter text-gray-900">
                                    {loading ? <div className="w-32 h-10 bg-gray-100 rounded-lg animate-pulse" /> : formatBytes(stats?.totalStorage || 0)}
                                </h3>
                            </div>
                        </div>
                        
                        <div>
                            <div className="flex justify-between text-[10px] font-black uppercase mb-3 tracking-widest text-teal-600/60">
                                <span>Physical Utilization</span>
                                <span>10 GB Cap</span>
                            </div>
                            <div className="w-full h-3 bg-teal-50 rounded-full overflow-hidden border border-teal-100/50 p-0.5">
                                <div className="h-full rounded-full transition-all duration-1500 ease-out bg-gradient-to-r from-teal-400 to-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.3)]" 
                                     style={{ width: `${Math.min(((stats?.totalStorage || 0) / 10737418240) * 100, 100)}%` }}></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
                    {/* Activity Feed */}
                    <div className="lg:col-span-2 glass-card p-10 rounded-[3rem] border border-white/40 shadow-xl shadow-gray-200/50">
                        <div className="flex justify-between items-center mb-10">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900 tracking-tight">Audit Stream</h2>
                                <p className="text-sm font-medium text-gray-500 mt-1">Live administrative events feed</p>
                            </div>
                            <Link to="/admin/logs" className="btn-secondary px-6 rounded-2xl shadow-sm hover:shadow-md">
                                Full History
                            </Link>
                        </div>
                        
                        <div className="space-y-6">
                            {loading ? (
                                Array(4).fill(0).map((_, i) => (
                                    <div key={i} className="flex gap-6 items-center">
                                        <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
                                        <div className="space-y-2 w-full">
                                            <Skeleton className="h-5 w-1/2" />
                                            <Skeleton className="h-4 w-1/4" />
                                        </div>
                                    </div>
                                ))
                            ) : logs.length === 0 ? (
                                <div className="py-20 text-center flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-300">
                                        <Activity className="w-8 h-8" />
                                    </div>
                                    <p className="font-bold text-gray-400 uppercase tracking-widest text-xs">No recent activity detected</p>
                                </div>
                            ) : (
                                logs.map((log, idx) => (
                                    <div key={log.id} 
                                         className="flex gap-6 items-start p-5 rounded-[2rem] border border-transparent hover:border-indigo-100 hover:bg-indigo-50/30 transition-all duration-300 group"
                                         style={{ animationDelay: `${idx * 100}ms` }}>
                                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-gray-100 bg-white group-hover:scale-110 group-hover:shadow-md transition-all duration-500">
                                            <Activity className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-1">
                                                <p className="text-lg font-bold text-gray-900 leading-tight truncate">{log.action}</p>
                                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter bg-indigo-50 px-2 py-1 rounded-lg">
                                                    {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-gray-500">
                                                Entity: <span className="text-gray-900 font-bold uppercase text-[10px] tracking-widest ml-1">{log.entity_type}</span>
                                                {log.target_user_id && <span className="mx-2 text-gray-300">|</span>}
                                                {log.target_user_id && <span className="text-indigo-600 font-bold">User Context</span>}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* System Alerts */}
                    <div className="glass-card p-10 rounded-[3rem] border border-white/40 shadow-xl shadow-gray-200/50 flex flex-col">
                        <AdminAlertCentre 
                            limit={5} 
                            onUpdate={() => {
                                // Potentially re-fetch other dashboard stats if needed
                            }} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
