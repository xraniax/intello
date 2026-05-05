import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Database, Zap, ArrowRight, ShieldCheck, Activity, 
    FileText, UserCheck, HardDrive, BarChart3, Cpu, Server
} from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';
import { formatBytes } from '@/utils/format';
import AdminAlertCentre from '@/components/Admin/AdminAlertCentre';
import ActivityStream from '@/components/Admin/ActivityStream';

// Dashboard overview only

// Subtle entrance for scroll-triggered sections (not flash-inducing)
const SECTION_ANIM = {
    initial: { opacity: 1, y: 12 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
};

// Hero section: render immediately, no flash
const HERO_ANIM = {
    initial: { opacity: 1, y: 0 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0 }
};


const AmbientOrb = ({ className, color }) => (
    <motion.div 
        animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, 30, 0]
        }}
        transition={{ 
            duration: 10 + Math.random() * 5, 
            repeat: Infinity, 
            ease: "easeInOut" 
        }}
        className={`absolute rounded-full blur-[140px] pointer-events-none -z-10 mix-blend-multiply will-change-[transform,opacity] ${className} ${color}`}
    />
);

const AdminDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalUsers: 0,
        onlineNow: 0,
        totalStorage: 0
    });
    const [sysStats, setSysStats] = useState(null);
    const [engagement, setEngagement] = useState(null);

    useEffect(() => {
        const fetchDashboardStats = async () => {
            try {
                const [usersRes, settingsRes, sysRes, analyticsRes] = await Promise.all([
                    adminService.getUsers(),
                    adminService.getSettings(),
                    adminService.getStats(),
                    adminService.getAnalytics()
                ]);
                
                const users = usersRes.data?.data || [];
                const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
                const now = Date.now();
                const onlineNow = Math.max(1, users.filter(u => {
                    const lastActive = u.last_active_at ? new Date(u.last_active_at).getTime() : 0;
                    return now - lastActive < ONLINE_THRESHOLD_MS;
                }).length);

                const settings = settingsRes.data?.data || {};
                const totalStorage = settings.stats?.total_storage_bytes || 0;
                
                setStats({
                    totalUsers: users.length,
                    onlineNow,
                    totalStorage
                });
                setSysStats(sysRes.data?.data || null);

            } catch (err) {
                console.error("Dashboard stats error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardStats();
    }, []);

    return (
        <div className="w-full relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #f8f7ff 0%, #fdf9ff 35%, #f5f8ff 70%, #f9f7ff 100%)' }}>

            {/* ── Layer 2: Animated mesh gradient blobs ── */}
            <AmbientOrb className="w-[900px] h-[900px] -top-80 -left-80" color="bg-violet-300/25" />
            <AmbientOrb className="w-[700px] h-[700px] top-[30vh] -right-60" color="bg-indigo-200/20" />
            <AmbientOrb className="w-[800px] h-[800px] top-[90vh] left-[10vw]" color="bg-sky-200/15" />

            {/* ── Layer 3: Subtle dot grid ── */}
            <div className="fixed inset-0 bg-dot-grid opacity-20 pointer-events-none z-0" />

            {/* ── Layer 4: Decorative SVG rings (top-right corner art) ── */}
            <svg className="absolute top-0 right-0 w-[480px] h-[480px] pointer-events-none opacity-[0.06] z-0" viewBox="0 0 480 480" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="480" cy="0" r="100" stroke="#6366f1" strokeWidth="1.5" />
                <circle cx="480" cy="0" r="180" stroke="#8b5cf6" strokeWidth="1" />
                <circle cx="480" cy="0" r="260" stroke="#6366f1" strokeWidth="0.8" />
                <circle cx="480" cy="0" r="340" stroke="#a78bfa" strokeWidth="0.5" />
                <circle cx="480" cy="0" r="420" stroke="#6366f1" strokeWidth="0.4" />
            </svg>

            {/* ── Layer 5: Bottom-left ring accent ── */}
            <svg className="absolute bottom-0 left-0 w-[360px] h-[360px] pointer-events-none opacity-[0.05] z-0" viewBox="0 0 360 360" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="0" cy="360" r="80" stroke="#8b5cf6" strokeWidth="1.5" />
                <circle cx="0" cy="360" r="150" stroke="#6366f1" strokeWidth="1" />
                <circle cx="0" cy="360" r="240" stroke="#a78bfa" strokeWidth="0.6" />
                <circle cx="0" cy="360" r="320" stroke="#6366f1" strokeWidth="0.4" />
            </svg>

            {/* ── Layer 6: Diagonal shimmer line ── */}
            <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.035]"
                style={{ background: 'repeating-linear-gradient(125deg, transparent 0px, transparent 80px, rgba(99,102,241,0.4) 80px, rgba(99,102,241,0.4) 81px)' }} />

            {/* SECTION 1: OVERVIEW */}
            <motion.section 
                id="overview" 
                className="min-h-[calc(100vh-80px)] flex flex-col justify-center p-8 md:p-20 relative"
                {...HERO_ANIM}
            >
                <div className="w-full">
                    <div className="inline-flex items-center gap-3 px-5 py-2 bg-gray-50 border border-gray-100 rounded-full mb-10 shadow-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 anim-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">System Core</span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-10 translate-x-[-4px] relative">
                        Mission <br/>
                        <span className="text-gradient-hero">Control</span>
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-fuchsia-400/20 blur-[60px] rounded-full -z-10 animate-pulse" />
                    </h1>

                    <p className="font-medium text-2xl text-gray-400 max-w-2xl leading-relaxed mb-16">
                        The nerve center for Cognify's global operations. Monitor metrics, manage users, and scale your learning cluster.
                    </p>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                        {/* Users Card */}
                        <motion.div 
                            whileHover={{ y: -8, scale: 1.02 }}
                            className="glass-card p-10 rounded-[3.5rem] border border-white/60 shadow-2xl shadow-fuchsia-100/30 group relative overflow-hidden"
                        >
                            <div className="absolute -right-4 -top-4 w-32 h-32 bg-fuchsia-400/10 blur-3xl rounded-full group-hover:bg-fuchsia-400/20 transition-colors" />
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-fuchsia-50 flex items-center justify-center text-fuchsia-500 border border-fuchsia-100">
                                    <Users className="w-7 h-7" />
                                </div>
                                <span className="text-xs font-black uppercase text-fuchsia-400 tracking-widest">Active Users</span>
                            </div>
                            <span className="text-6xl font-black text-gray-900 block mb-2 tracking-tighter">
                                {loading ? <Skeleton className="w-24 h-12" /> : stats.totalUsers}
                            </span>
                            <p className="text-gray-400 font-bold text-sm">Registered Students</p>
                        </motion.div>

                        {/* Storage Card */}
                        <motion.div 
                            whileHover={{ y: -8, scale: 1.02 }}
                            className="glass-card p-10 rounded-[3.5rem] border border-white/60 shadow-2xl shadow-sky-100/30 group relative overflow-hidden"
                        >
                            <div className="absolute -right-4 -top-4 w-32 h-32 bg-sky-400/10 blur-3xl rounded-full group-hover:bg-sky-400/20 transition-colors" />
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500 border border-sky-100">
                                    <HardDrive className="w-7 h-7" />
                                </div>
                                <span className="text-xs font-black uppercase text-sky-400 tracking-widest">Cluster Size</span>
                            </div>
                            <span className="text-6xl font-black text-gray-900 block mb-2 tracking-tighter">
                                {loading ? <Skeleton className="w-32 h-12" /> : formatBytes(stats.totalStorage)}
                            </span>
                            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-4 overflow-hidden">
                                <div 
                                    className="h-full bg-sky-500 rounded-full shadow-[0_0_8px_rgba(14,165,233,0.5)]" 
                                    style={{ width: `100%` }} 
                                />
                            </div>
                        </motion.div>

                        {/* Logs Card */}
                        <motion.div 
                            whileHover={{ y: -8, scale: 1.02 }}
                            className="glass-card p-10 rounded-[3.5rem] border border-white/60 shadow-2xl shadow-emerald-100/30 group relative overflow-hidden"
                        >
                            <div className="absolute -right-4 -top-4 w-32 h-32 bg-emerald-400/10 blur-3xl rounded-full group-hover:bg-emerald-400/20 transition-colors" />
                            <div className="flex items-center gap-4 mb-8">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100">
                                    <FileText className="w-7 h-7" />
                                </div>
                                <span className="text-xs font-black uppercase text-emerald-400 tracking-widest">Events</span>
                            </div>
                            <span className="text-6xl font-black text-gray-900 block mb-2 tracking-tighter">
                                {loading ? <Skeleton className="w-20 h-12" /> : stats.onlineNow}
                            </span>
                            <p className="text-gray-400 font-bold text-sm">System Actions Today</p>
                        </motion.div>
                    </div>

                    {/* Live Operations & Monitoring */}
                    <div className="mt-20 grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
                        {/* Monitor Feed */}
                        <div className="lg:col-span-2 glass-card rounded-[3.5rem] border border-white/60 p-10 relative overflow-hidden">
                            <div className="flex items-center justify-between mb-10">
                                <div>
                                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">Live Pulse</h3>
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mt-1">Real-time audit stream</p>
                                </div>
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Broadcasting</span>
                                </div>
                            </div>
                            
                            <ActivityStream limit={6} compact={true} />
                            
                            <button 
                                onClick={() => navigate('/admin/logs')}
                                className="w-full mt-10 py-4 bg-gray-50 hover:bg-gray-100 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-500 transition-all border border-gray-100"
                            >
                                Enter Detailed Archive
                            </button>
                        </div>

                        {/* System Health (Minimal Analytics) */}
                        <div className="space-y-8">
                            <div className="glass-card rounded-[3rem] border border-white/60 p-8 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-transparent pointer-events-none" />
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                                        <Activity className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Network Latency</span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-4xl font-black text-gray-900 tracking-tighter">
                                        {sysStats?.latency || '24ms'}
                                    </span>
                                    <span className="text-emerald-500 text-xs font-black mb-1 uppercase">Optimal</span>
                                </div>
                            </div>

                            {/* Engagement Sparkline */}
                            <div className="glass-card rounded-[3rem] border border-white/60 p-8 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/5 to-transparent pointer-events-none" />
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                                            <BarChart3 className="w-6 h-6" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">30D Engagement</span>
                                    </div>
                                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded-full">DAU Pulse</span>
                                </div>
                                <div className="flex items-baseline gap-3 mb-4">
                                    <span className="text-4xl font-black text-gray-900 tracking-tighter">
                                        {engagement?.dau?.slice(-1)[0]?.count || 0}
                                    </span>
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Today</span>
                                </div>
                                <div className="flex items-end gap-1 h-16 group/spark">
                                    {(engagement?.dau || []).slice(-14).map((d, i) => (
                                        <div key={i} className="flex-1 group/bar relative">
                                            <div 
                                                className="w-full bg-indigo-100 group-hover/bar:bg-indigo-400 transition-all rounded-t-sm relative"
                                                style={{ height: `${Math.max(15, (d.count / (Math.max(...engagement.dau.map(x => x.count)) || 1)) * 100)}%` }}
                                            >
                                                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[9px] font-black px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                                                    {d.count}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="glass-card rounded-[3rem] border border-white/60 p-8 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-sky-400/5 to-transparent pointer-events-none" />
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500">
                                        <Cpu className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Cluster CPU</span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-4xl font-black text-gray-900 tracking-tighter">
                                        {sysStats ? `${sysStats.cpu}%` : '12.5%'}
                                    </span>
                                    <span className="text-sky-500 text-xs font-black mb-1 uppercase">Stable</span>
                                </div>
                            </div>

                            <div className="glass-card rounded-[3rem] border border-white/60 p-8 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-amber-400/5 to-transparent pointer-events-none" />
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
                                        <Server className="w-6 h-6" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Node Uptime</span>
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-4xl font-black text-gray-900 tracking-tighter">
                                        {sysStats ? `${sysStats.memory.percentage}%` : '99.9%'}
                                    </span>
                                    <span className="text-amber-500 text-xs font-black mb-1 uppercase">
                                        {sysStats ? 'RAM Load' : 'Reliable'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-24">
                        <AdminAlertCentre limit={3} />
                    </div>
                </div>
                
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.3 }}
                    transition={{ delay: 2 }}
                    className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                >
                </motion.div>
            </motion.section>

            <footer className="py-20 border-t border-gray-50 flex flex-col items-center">
                <div className="w-12 h-12 bg-gray-900 rounded-2xl flex items-center justify-center mb-8">
                    <span className="text-white text-sm font-black italic">C</span>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[1em] text-gray-300">Cognify Admin Cluster &bull; {new Date().getFullYear()}</p>
            </footer>
        </div>
    );
};

export default AdminDashboard;
