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
                className="min-h-[calc(100vh-80px)] flex flex-col justify-center p-8 md:p-24 relative"
                {...HERO_ANIM}
            >
                <div className="max-w-7xl mx-auto w-full">
                    <div className="inline-flex items-center gap-3 px-5 py-2 bg-gray-50 border border-gray-100 rounded-full mb-10 shadow-sm">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-900">Administrative Terminal</span>
                    </div>

                    <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-10 translate-x-[-4px]">
                        Operational <br className="hidden md:block" />
                        <span className="text-gradient-hero">
                            Intelligence.
                        </span>
                    </h1>

                    <p className="max-w-xl text-lg font-bold text-gray-400 mb-20 leading-relaxed uppercase tracking-widest">
                        System Architecture stable. <br />
                        Data Synchronization in progress.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { label: 'Total Base Users', value: stats.totalUsers, icon: Users, color: 'indigo' },
                            { label: 'Real-time Presence', value: stats.onlineNow, icon: Zap, color: 'indigo' },
                            { label: 'Cloud Storage Sum', value: formatBytes(stats.totalStorage), icon: Database, color: 'indigo' }
                        ].map((s, i) => (
                            <motion.div 
                                key={i} 
                                whileHover={{ y: -8, scale: 1.02 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                className="glass-card p-10 rounded-[3.5rem] border-white shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] hover:shadow-[0_30px_70px_-15px_rgba(99,102,241,0.15)] transition-all duration-300 group relative overflow-hidden will-change-transform"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-white/0 pointer-events-none" />
                                <div className="w-16 h-16 rounded-[2rem] bg-gray-50 flex items-center justify-center mb-10 group-hover:bg-indigo-600 group-hover:text-white group-hover:rotate-6 shadow-sm transition-all duration-300">
                                    <s.icon className="w-7 h-7" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 group-hover:text-indigo-500 transition-colors">{s.label}</p>
                                <h3 className="text-5xl font-black tracking-tighter text-gray-900">{loading ? <Skeleton className="w-24 h-12" /> : s.value}</h3>
                                <div className="mt-8 h-1 w-full bg-indigo-50/50 rounded-full overflow-hidden">
                                     <div className="h-full w-full bg-indigo-500 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out will-change-transform" />
                                </div>
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
