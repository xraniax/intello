import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Database, Zap, ArrowRight, ShieldCheck, Activity, 
    FileText, UserCheck, HardDrive, BarChart3
} from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';
import { formatBytes } from '@/utils/format';
import AdminAlertCentre from '@/components/Admin/AdminAlertCentre';

// Import sub-page components
import AdminUsers from './AdminUsers';
import AdminFiles from './AdminFiles';
import AdminLogs from './AdminLogs';

const SECTION_ANIM = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-100px" },
    transition: { duration: 1, ease: [0.16, 1, 0.3, 1] }
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
        className={`absolute rounded-full blur-[140px] pointer-events-none -z-10 mix-blend-multiply ${className} ${color}`}
    />
);

const AdminDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalUsers: 0,
        onlineNow: 0,
        totalStorage: 0
    });

    useEffect(() => {
        const fetchDashboardStats = async () => {
            try {
                const [usersRes, settingsRes] = await Promise.all([
                    adminService.getUsers(),
                    adminService.getSettings()
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

            } catch (err) {
                console.error("Dashboard stats error", err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboardStats();
    }, []);

    return (
        <div className="w-full relative bg-[#F8FAFC]">
            <AmbientOrb className="w-[600px] h-[600px] top-0 -left-64" color="bg-indigo-300/40" />
            <AmbientOrb className="w-[500px] h-[500px] top-[100vh] -right-32" color="bg-fuchsia-300/40" />
            <AmbientOrb className="w-[700px] h-[700px] top-[200vh] -left-80" color="bg-teal-300/40" />

            {/* SECTION 1: OVERVIEW */}
            <motion.section 
                id="overview" 
                className="min-h-[calc(100vh-80px)] flex flex-col justify-center p-8 md:p-24 relative"
                {...SECTION_ANIM}
            >
                <div className="max-w-7xl mx-auto w-full">
                    <div className="inline-flex items-center gap-3 px-5 py-2 bg-gray-50 border border-gray-100 rounded-full mb-10 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-900">Administrative Terminal</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-tight mb-8">
                        Platform <br className="hidden md:block" />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                            Intelligence
                        </span>
                    </h1>

                    <p className="max-w-2xl text-xl font-bold text-gray-500 mb-20 leading-relaxed">
                        Architecture is stable. Nodes are synchronized. <br />
                        Explore your platform's narrative journey below.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        {[
                            { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'indigo' },
                            { label: 'Active Presence', value: stats.onlineNow, icon: Zap, color: 'indigo' },
                            { label: 'Cluster Data', value: formatBytes(stats.totalStorage), icon: Database, color: 'indigo' }
                        ].map((s, i) => (
                            <motion.div 
                                key={i} 
                                whileHover={{ y: -10 }}
                                className="p-10 rounded-[3rem] bg-white/70 backdrop-blur-xl border border-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgba(99,102,241,0.1)] transition-all duration-500 group relative overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 pointer-events-none" />
                                <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center mb-8 group-hover:bg-gray-900 group-hover:text-white transition-all duration-500">
                                    <s.icon className="w-6 h-6" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{s.label}</p>
                                <h3 className="text-5xl font-black tracking-tighter">{loading ? <Skeleton className="w-20 h-10" /> : s.value}</h3>
                            </motion.div>
                        ))}
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
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] rotate-90 mb-8 border-b border-gray-900 pb-2">Scroll</span>
                    <ArrowRight className="w-5 h-5 rotate-90" />
                </motion.div>
            </motion.section>

            {/* SECTION 2: USERS */}
            <motion.section 
                id="users" 
                className="min-h-screen border-t border-gray-50 py-24"
                {...SECTION_ANIM}
            >
                <div className="max-w-7xl mx-auto w-full px-8 mb-16">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                        <div className="max-w-2xl">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-gray-900">
                                Identity <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-indigo-300">& Access</span>
                            </h2>
                            <p className="text-lg font-bold text-gray-500 leading-relaxed">Manage your community. Oversee roles, monitor activity, and ensure platform integrity.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="px-8 py-6 bg-white/70 backdrop-blur-md border border-white rounded-[2.5rem] shadow-xl shadow-indigo-100/50">
                                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mb-1">Status</p>
                                <p className="text-2xl font-black text-indigo-600 flex items-center gap-2">
                                    <UserCheck className="w-5 h-5 text-indigo-500" /> All Nodes Green
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="max-w-[1600px] mx-auto px-4 md:px-8">
                    <div className="rounded-[2.5rem] bg-white border border-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden w-full ring-1 ring-gray-100/50">
                        <AdminUsers />
                    </div>
                </div>
            </motion.section>

            {/* SECTION 3: FILES (WITH SCROLL CONTAINMENT) */}
            <motion.section 
                id="files" 
                className="min-h-screen border-t border-gray-50 py-24 bg-gray-50/30"
                {...SECTION_ANIM}
            >
                <div className="max-w-7xl mx-auto w-full px-8 mb-16">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                        <div className="max-w-2xl">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-gray-900">
                                Storage <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-fuchsia-400">Vaults</span>
                            </h2>
                            <p className="text-lg font-bold text-gray-500 leading-relaxed">The collective memory of your platform. Monitor global quotas and explore asset clusters.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="px-8 py-6 bg-white/70 backdrop-blur-md border border-white rounded-[2.5rem] shadow-xl shadow-purple-100/50">
                                <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-1">Utilization</p>
                                <p className="text-2xl font-black text-purple-600 flex items-center gap-2">
                                    <HardDrive className="w-5 h-5 text-purple-500" /> {loading ? '...' : formatBytes(stats.totalStorage)}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="max-w-[1600px] mx-auto px-4 md:px-8">
                    <div className="rounded-[2.5rem] bg-white border border-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden w-full flex flex-col ring-1 ring-gray-100/50">
                        <div className="flex-1">
                            <AdminFiles />
                        </div>
                    </div>
                </div>
            </motion.section>

            {/* SECTION 4: AUDIT LOGS (WITH SCROLL CONTAINMENT) */}
            <motion.section 
                id="logs" 
                className="min-h-screen border-t border-gray-50 py-24"
                {...SECTION_ANIM}
            >
                <div className="max-w-7xl mx-auto w-full px-8 mb-16">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
                        <div className="max-w-2xl">
                            <h2 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 text-gray-900">
                                Audit <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Stream</span>
                            </h2>
                            <p className="text-lg font-bold text-gray-500 leading-relaxed">An immutable record of every breath your platform takes. Forensic intelligence at scale.</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="px-8 py-6 bg-white/70 backdrop-blur-md border border-white rounded-[2.5rem] shadow-xl shadow-emerald-100/50">
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Ingestion Rate</p>
                                <p className="text-2xl font-black text-emerald-600 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-emerald-500" /> Optimal
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="max-w-[1600px] mx-auto px-4 md:px-8">
                    <div className="rounded-[2.5rem] bg-white border border-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] overflow-hidden w-full flex flex-col ring-1 ring-gray-100/50">
                        <div className="flex-1">
                            <AdminLogs />
                        </div>
                    </div>
                </div>
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
