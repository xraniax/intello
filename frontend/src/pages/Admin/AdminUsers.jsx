import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { adminService } from '@/features/admin/services/AdminService';
import { UserStatusBadge, UserRoleBadge } from '@/components/Admin/UserBadges';
import { 
    Search, ShieldAlert, Trash2, UserPlus, MoreVertical, 
    RefreshCw, UserCheck, ShieldOff, HardDrive, Filter, 
    DownloadCloud, UploadCloud, ChevronDown, ChevronUp, Mail, Calendar, Settings,
    Activity, ShieldCheck, Users, LayoutGrid, List
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import CustomModal from '@/components/ui/CustomModal';
import Skeleton from '@/components/ui/Skeleton';
import { formatDistanceToNow, format } from 'date-fns';
import { useUIStore } from '@/store/useUIStore';
import { formatBytes } from '@/utils/format';
import QuotaOverrideModal from '@/components/Admin/QuotaOverrideModal';


import { motion, AnimatePresence } from 'framer-motion';


const AmbientOrb = ({ className, color }) => (
    <motion.div 
        animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.4, 0.6, 0.4],
            x: [0, 80, 0],
            y: [0, 40, 0]
        }}
        transition={{ 
            duration: 8 + Math.random() * 4, 
            repeat: Infinity, 
            ease: "easeInOut" 
        }}
        className={`absolute rounded-full blur-[160px] pointer-events-none -z-10 mix-blend-multiply will-change-[transform,opacity] ${className} ${color}`}
    />
);


const AdminUsers = () => {
    const currentUser = useAuthStore(state => state.data?.user);
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState(null); // to get global quota
    const [isLoading, setIsLoading] = useState(true);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterRole, setFilterRole] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    
    const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
    const [expandedUserId, setExpandedUserId] = useState(null);
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    const [storageBudget, setStorageBudget] = useState(null);
    const [showAll, setShowAll] = useState(false);
    
    // Action Modals State
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalType, setModalType] = useState(null); // 'suspend', 'activate', 'promote', 'demote', 'delete', 'quota'
    const [isActionLoading, setIsActionLoading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, settingsRes] = await Promise.all([
                adminService.getUsers(),
                adminService.getSettings()
            ]);
            setUsers(usersRes.data?.data || []);
            setSettings(settingsRes.data?.data || null);
            
            // Initial budget fetch via impact analysis
            const defaultM = settingsRes.data?.data?.storage?.default_user_quota_mb || 100;
            const impactRes = await adminService.getQuotaImpact(defaultM);
            setStorageBudget(impactRes.data?.data?.budget || null);
        } catch (error) {
            toast.error('Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const filteredUsers = useMemo(() => {
        let result = users.filter(user => {
            const matchesSearch = user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                                user.email.toLowerCase().includes(debouncedSearch.toLowerCase());
            const matchesStatus = filterStatus === 'all' || user.status?.toUpperCase() === filterStatus;
            const matchesRole = filterRole === 'all' || user.role === filterRole;
            return matchesSearch && matchesStatus && matchesRole;
        });

        return result.sort((a, b) => {
            let valA = a[sortBy];
            let valB = b[sortBy];
            
            if (sortBy === 'storage_usage_bytes' || sortBy === 'workspace_count') {
                valA = parseInt(valA) || 0;
                valB = parseInt(valB) || 0;
            } else if (sortBy === 'created_at' || sortBy === 'last_active_at') {
                valA = valA ? new Date(valA).getTime() : 0;
                valB = valB ? new Date(valB).getTime() : 0;
            } else {
                valA = (valA || '').toString().toLowerCase();
                valB = (valB || '').toString().toLowerCase();
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [users, debouncedSearch, filterStatus, filterRole, sortBy, sortOrder]);

    const displayedUsers = useMemo(() => {
        return showAll ? filteredUsers : filteredUsers.slice(0, 6);
    }, [filteredUsers, showAll]);

    const metrics = useMemo(() => {
        const total = users.length;
        const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
        const now = Date.now();
        const onlineNow = Math.max(1, users.filter(u => {
            const lastActive = u.last_active_at ? new Date(u.last_active_at).getTime() : 0;
            return now - lastActive < ONLINE_THRESHOLD_MS;
        }).length);
        const suspended = users.filter(u => u.status?.toUpperCase() === 'SUSPENDED').length;
        const totalStorageBytes = settings?.stats?.total_storage_bytes || 
                                users.reduce((acc, u) => acc + (parseInt(u.storage_usage_bytes) || 0), 0);
        return { total, onlineNow, suspended, totalStorageBytes };
    }, [users, settings]);

    const applyOptimistic = (userId, patch) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...patch } : u));
    };

    const handleAction = async () => {
        if (!selectedUser || !modalType) return;
        const uiActions = useUIStore.getState().actions;
        const msg = `${modalType.charAt(0).toUpperCase() + modalType.slice(1)}ing user...`;

        setIsActionLoading(true);
        uiActions.setLoading('adminAction', true, msg, false);
        try {
            if (modalType === 'suspend') {
                applyOptimistic(selectedUser.id, { status: 'SUSPENDED' });
                await adminService.updateUserStatus(selectedUser.id, 'suspended');
                toast.success(`${selectedUser.name} suspended`);
            } else if (modalType === 'activate') {
                applyOptimistic(selectedUser.id, { status: 'ACTIVE' });
                await adminService.updateUserStatus(selectedUser.id, 'active');
                toast.success(`${selectedUser.name} reactivated`);
            } else if (modalType === 'promote') {
                applyOptimistic(selectedUser.id, { role: 'admin' });
                await adminService.updateUserRole(selectedUser.id, 'admin');
                toast.success(`${selectedUser.name} promoted to admin`);
            } else if (modalType === 'demote') {
                applyOptimistic(selectedUser.id, { role: 'user' });
                await adminService.updateUserRole(selectedUser.id, 'user');
                toast.success(`${selectedUser.name} demoted to user`);
            } else if (modalType === 'delete') {
                setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
                await adminService.deleteUser(selectedUser.id);
                toast.success(`${selectedUser.name} deleted`);
            }
            setModalType(null);
            setSelectedUser(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
            await fetchData(); // revert optimistic on failure
        } finally {
            setIsActionLoading(false);
            uiActions.setLoading('adminAction', false);
        }
    };

    const handleSaveQuota = async (user, mb) => {
        const uiActions = useUIStore.getState().actions;
        uiActions.setLoading('adminAction', true, 'Updating quota...', false);
        try {
            const limitBytes = mb ? parseInt(mb) * 1024 * 1024 : null;
            await adminService.updateUserStorageLimit(user.id, limitBytes);
            applyOptimistic(user.id, { storage_limit_bytes: limitBytes });
            toast.success('Storage limit updated');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to update quota');
        } finally {
            uiActions.setLoading('adminAction', false);
        }
    };

    const confirmAction = (user, type) => {
        setSelectedUser(user);
        setModalType(type);
        setActiveDropdownId(null);
        
        if (type === 'quota') {
            return;
        }

        if (user.id === currentUser?.id) {
            toast.error(`You cannot ${type} yourself`);
            return;
        }

        if (user.role === 'admin' && currentUser?.role === 'admin') {
            const userCreated = new Date(user.created_at);
            const adminCreated = new Date(currentUser.created_at);
            if (userCreated <= adminCreated) {
                toast.error('You cannot manage admins who joined before you');
                return;
            }
        }

        setSelectedUser(user);
        setModalType(type);
        setActiveDropdownId(null);
    };

    // --- PREMIUM COMPONENTS ---

    const DesktopTableView = ({ users }) => {
        const toggleSort = (key) => {
            if (sortBy === key) {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            } else {
                setSortBy(key);
                setSortOrder('desc');
            }
        };

        const getHeaderClass = (field) => `font-black text-[9px] uppercase tracking-widest ${sortBy === field ? 'text-indigo-600' : 'text-gray-400'}`;

        return (
            <div className="hidden md:block overflow-x-auto custom-scrollbar border-2 border-black/5 bg-white/40 backdrop-blur-md rounded-sm">
            <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                    <tr className="border-b-2 border-black/5 bg-gray-50/50">
                        <th className="px-5 py-3 first:pl-8">
                            <button onClick={() => toggleSort('name')} className="flex items-center gap-2 group outline-none">
                                <span className={getHeaderClass('name')}>IDENTITY/NODE</span>
                                {sortBy === 'name' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-500" /> : <ChevronDown className="w-3 h-3 text-indigo-500" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
                            </button>
                        </th>
                        <th className="px-5 py-3">
                             <button onClick={() => toggleSort('role')} className="flex items-center gap-2 group outline-none">
                                <span className={getHeaderClass('role')}>ACCESS LEVEL</span>
                                {sortBy === 'role' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-500" /> : <ChevronDown className="w-3 h-3 text-indigo-500" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
                            </button>
                        </th>
                        <th className="px-5 py-3">
                            <button onClick={() => toggleSort('storage_usage_bytes')} className="flex items-center gap-2 group outline-none">
                                <span className={getHeaderClass('storage_usage_bytes')}>DATA OCCUPANCY</span>
                                {sortBy === 'storage_usage_bytes' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-500" /> : <ChevronDown className="w-3 h-3 text-indigo-500" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
                            </button>
                        </th>
                        <th className="px-5 py-3">
                            <button onClick={() => toggleSort('last_active_at')} className="flex items-center gap-2 group outline-none">
                                <span className={getHeaderClass('last_active_at')}>PULSE</span>
                                {sortBy === 'last_active_at' ? (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-indigo-500" /> : <ChevronDown className="w-3 h-3 text-indigo-500" />) : <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />}
                            </button>
                        </th>
                        <th className="px-5 py-3 text-right pr-8 font-black text-[9px] uppercase tracking-widest text-gray-400">CMD</th>
                    </tr>
                </thead>
                <tbody className="divide-y-2 divide-black/5">
                    {displayedUsers.map((user, idx) => (
                        <motion.tr 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            key={user.id} 
                            className="group hover:bg-white/60 transition-all cursor-pointer"
                        >
                            <td className="px-5 py-2 first:pl-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-sm bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-indigo-200/50">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-[13px] tracking-tight leading-none mb-0.5" style={{ color: 'var(--c-text-secondary)' }}>{user.name}</h3>
                                        <p className="text-[9px] font-mono font-bold text-gray-400 uppercase tracking-tighter">{user.email}</p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-5 py-2">
                                <UserRoleBadge role={user.role} />
                            </td>
                            <td className="px-5 py-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] font-black text-gray-900">{formatBytes(parseInt(user.storage_usage_bytes) || 0)}</span>
                                    <div className="w-20 h-1 bg-gray-100 border border-black/5 rounded-none overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500" style={{ width: `${Math.min(100, ((parseInt(user.storage_usage_bytes) || 0) / ((user.storage_limit_bytes || (settings?.storage?.default_user_quota_mb || 100) * 1024 * 1024)) * 100))}%` }}></div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-5 py-2">
                                <p className="text-[10px] font-mono font-bold text-gray-900 uppercase">
                                    {user.last_active_at ? formatDistanceToNow(new Date(user.last_active_at), {addSuffix: true}) : 'Silent'}
                                </p>
                            </td>
                            <td className="px-5 py-2 text-right pr-8">
                                <button onClick={() => confirmAction(user, 'delete')} className="text-gray-400 hover:text-red-500 transition-colors">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </td>
                        </motion.tr>
                    ))}
                </tbody>
            </table>
            </div>
        );
    };

    const MobileCardView = ({ users }) => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {users.map((user, idx) => {
                    const defaultQuotaBytes = (settings?.storage?.default_user_quota_mb || 100) * 1024 * 1024;
                    const maxQuota = user.storage_limit_bytes || defaultQuotaBytes;
                    const usageBytes = parseInt(user.storage_usage_bytes) || 0;
                    const usagePercent = Math.min((usageBytes / maxQuota) * 100, 100);

                    return (
                        <motion.div 
                            key={user.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className="glass-card p-8 rounded-sm border border-white/60 shadow-xl shadow-gray-200/20 hover:shadow-2xl hover:border-white transition-all group backdrop-blur-md"
                        >
                            <div className="flex justify-between items-start mb-8">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-sm bg-gradient-to-br from-indigo-500 to-fuchsia-600 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-100">
                                        {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-lg tracking-tight leading-none mb-2" style={{ color: 'var(--c-text-secondary)' }}>{user.name}</h3>
                                        <UserStatusBadge status={user.status} />
                                    </div>
                                </div>
                                <button onClick={() => confirmAction(user, 'delete')} className="w-10 h-10 rounded-sm flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all border border-transparent hover:border-red-100">
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-6">
                                <div className="p-5 bg-gray-50/50 rounded-[2rem] border border-gray-100/50">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Physical Occupancy</span>
                                        <span className="text-[11px] font-black text-gray-900">{formatBytes(usageBytes)}</span>
                                    </div>
                                    <div className="h-2 w-full bg-white rounded-full overflow-hidden p-0.5 border border-gray-100">
                                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{ width: `${usagePercent}%` }}></div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between px-2">
                                    <UserRoleBadge role={user.role} />
                                    <div className="text-right">
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Last Pulse</p>
                                        <p className="text-[10px] font-black text-gray-900 uppercase">
                                            {user.last_active_at ? formatDistanceToNow(new Date(user.last_active_at), {addSuffix: true}) : 'Silent'}
                                        </p>
                                    </div>
                                </div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => confirmAction(user, 'quota')}
                                    className="w-full py-4 bg-white border border-gray-100 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all shadow-sm"
                                >
                                    Adjust Cluster Logic
                                </motion.button>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="w-full relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #f8f7ff 0%, #fdf9ff 35%, #f5f8ff 70%, #f9f7ff 100%)' }}>
            
            {/* ── Background Infrastructure ── */}
            <AmbientOrb className="w-[900px] h-[900px] -top-80 -left-80" color="bg-fuchsia-400/30" />
            <AmbientOrb className="w-[700px] h-[700px] top-[30vh] -right-60" color="bg-pink-300/25" />
            <AmbientOrb className="w-[1000px] h-[1000px] -bottom-80 left-[10vw]" color="bg-indigo-300/30" />
            
            <div className="absolute inset-0 bg-dot-grid pointer-events-none opacity-[0.08]" />
            <div className="absolute inset-0 bg-grid-mesh pointer-events-none opacity-[0.03]" />
            
            {/* Header SVG Rings */}
            <svg className="absolute top-0 right-0 w-[480px] h-[480px] pointer-events-none opacity-[0.06] z-0" viewBox="0 0 480 480" fill="none">
                <circle cx="480" cy="0" r="100" stroke="#f43f5e" strokeWidth="1.5" />
                <circle cx="480" cy="0" r="180" stroke="#8b5cf6" strokeWidth="1" />
                <circle cx="480" cy="0" r="260" stroke="#f43f5e" strokeWidth="0.8" />
                <circle cx="480" cy="0" r="340" stroke="#ec4899" strokeWidth="0.5" />
                <circle cx="480" cy="0" r="420" stroke="#f43f5e" strokeWidth="0.4" />
            </svg>

            <div className="relative z-10 min-h-[calc(100vh-64px)] p-8 md:p-20 w-full animate-in fade-in slide-in-from-bottom-4 duration-1000">
                <div className="mb-20">
                    <div className="inline-flex items-center gap-3 px-5 py-2 bg-white/50 border border-white rounded-full mb-10 shadow-sm backdrop-blur-sm">
                        <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500 anim-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-500">Security Cluster Alpha</span>
                    </div>

                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none mb-6 relative" style={{ color: 'var(--c-text-secondary)' }}>
                        User <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-600 via-pink-500 to-indigo-600">Inventory</span>
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-pink-400/20 blur-[80px] rounded-full -z-10 animate-pulse" />
                    </h1>

                    <p className="font-bold text-lg text-gray-400 max-w-xl leading-snug">
                        Real-time status of the academic collective.
                    </p>
                </div>

                {/* Metrics Row RE-DESIGNED */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10 relative z-10">
                    <motion.div whileHover={{ y: -4 }} className="glass-card p-6 rounded-sm border-2 border-indigo-500/20 shadow-xl shadow-indigo-100/10 group bg-white/40">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-sm bg-indigo-500/10 flex items-center justify-center text-indigo-600 border border-indigo-500/20">
                                <Users className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-indigo-500/60 tracking-wider">Total Node Count</span>
                        </div>
                        <span className="text-4xl font-black text-gray-900 block mb-1 tracking-tighter font-mono">
                            {isLoading ? <Skeleton className="w-20 h-8" /> : metrics.total.toString().padStart(4, '0')}
                        </span>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Active Entries</p>
                    </motion.div>
                    <motion.div whileHover={{ y: -4 }} className="glass-card p-6 rounded-sm border-2 border-emerald-500/20 shadow-xl shadow-emerald-100/10 group bg-white/40">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-sm bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/20">
                                <Activity className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-emerald-500/60 tracking-wider">Live Pulse</span>
                        </div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                            <span className="text-4xl font-black text-gray-900 tracking-tighter font-mono">{metrics.onlineNow.toString().padStart(4, '0')}</span>
                        </div>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Active Nodes</p>
                    </motion.div>

                    <motion.div whileHover={{ y: -4 }} className="glass-card p-6 rounded-sm border-2 border-orange-500/20 shadow-xl shadow-orange-100/10 group bg-white/40">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-sm bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/20">
                                <ShieldAlert className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-orange-500/60 tracking-wider">Security Isolations</span>
                        </div>
                        <span className="text-4xl font-black text-gray-900 block mb-1 tracking-tighter font-mono">{metrics.suspended.toString().padStart(4, '0')}</span>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Quarantined records</p>
                    </motion.div>

                    <motion.div whileHover={{ y: -4 }} className="glass-card p-6 rounded-sm border-2 border-fuchsia-500/20 shadow-xl shadow-fuchsia-100/10 group bg-white/40">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-sm bg-fuchsia-500/10 flex items-center justify-center text-fuchsia-600 border border-fuchsia-500/20">
                                <HardDrive className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-fuchsia-500/60 tracking-wider">Storage Occupancy</span>
                        </div>
                        <span className="text-4xl font-black text-gray-900 block mb-1 tracking-tighter font-mono">
                            {formatBytes(metrics.totalStorageBytes).split(' ')[0]}<span className="text-lg ml-1">{formatBytes(metrics.totalStorageBytes).split(' ')[1]}</span>
                        </span>
                        <p className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Network Load</p>
                    </motion.div>
                </div>

                {/* Filter Console RE-DESIGNED */}
                <div className="glass-card p-4 rounded-[2.5rem] border border-white/60 shadow-xl shadow-gray-200/20 flex flex-col lg:flex-row justify-between items-center gap-6 mb-12 relative z-20 backdrop-blur-md">
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={fetchData}
                            className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-indigo-100 hover:shadow-sm"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </motion.button>

                        <div className="h-8 w-px bg-gray-200/60 hidden lg:block mx-1"></div>

                        <div className="flex gap-2 flex-1 lg:flex-none">
                            <div className="relative group flex-1 lg:w-44">
                                <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors z-10" />
                                <select 
                                    className="w-full pl-10 pr-10 py-3 bg-gray-50/50 hover:bg-white text-xs font-black uppercase tracking-widest text-gray-500 border border-transparent focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/30 outline-none rounded-2xl appearance-none cursor-pointer transition-all"
                                    value={filterRole}
                                    onChange={(e) => setFilterRole(e.target.value)}
                                >
                                    <option value="all">Access: All</option>
                                    <option value="admin">Tier: Admin</option>
                                    <option value="user">Tier: User</option>
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>

                            <div className="relative group flex-1 lg:w-48">
                                <Activity className="w-3.5 h-3.5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors z-10" />
                                <select 
                                    className="w-full pl-10 pr-10 py-3 bg-gray-50/50 hover:bg-white text-xs font-black uppercase tracking-widest text-gray-500 border border-transparent focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/30 outline-none rounded-2xl appearance-none cursor-pointer transition-all"
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                >
                                    <option value="all">Status: All</option>
                                    <option value="ACTIVE">Status: Active</option>
                                    <option value="SUSPENDED">Status: Isolated</option>
                                </select>
                                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>

                        {/* View Switcher */}
                        <div className="flex bg-gray-100/50 p-1.5 rounded-2xl border border-gray-100">
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                List View
                            </button>
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            >
                                Grid View
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative w-full lg:w-96 group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="SEARCH REPOSITORY..." 
                            className="w-full bg-gray-50/50 hover:bg-white text-[11px] font-black uppercase tracking-widest text-gray-700 outline-none border border-transparent focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/30 rounded-[1.5rem] py-4 pl-12 pr-6 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Data View RE-DESIGNED */}
                <div className={`relative z-10 transition-all duration-500 ${isLoading ? 'opacity-50 pointer-events-none scale-[0.98]' : 'opacity-100 scale-100'}`}>
                    {isLoading && users.length === 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {Array(6).fill(0).map((_, i) => (
                                <div key={i} className="glass-card h-64 animate-pulse rounded-[3.5rem] bg-indigo-50/20 shadow-none border-indigo-50/30" />
                            ))}
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="py-32 glass-card rounded-[4rem] text-center border-dashed border-2 border-gray-100 bg-white/20 backdrop-blur-xl">
                            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center text-gray-200 mx-auto mb-8 shadow-xl shadow-gray-100/50 border border-gray-50">
                                <Search className="w-10 h-10" />
                            </div>
                            <h3 className="text-3xl font-black mb-4 tracking-tight" style={{ color: 'var(--c-text-secondary)' }}>No Records Found</h3>
                            <p className="text-gray-400 font-bold max-w-sm mx-auto uppercase text-[10px] tracking-widest leading-relaxed">The repository returned zero matches for your current security filter.</p>
                            <button onClick={() => { setSearchQuery(''); setFilterRole('all'); setFilterStatus('all'); }} className="mt-10 px-10 py-4 bg-gray-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-full hover:shadow-2xl hover:shadow-gray-900/30 transition-all active:scale-95">
                                Reset Control Console
                            </button>
                        </div>
                    ) : (
                        viewMode === 'list' ? <DesktopTableView users={displayedUsers} /> : <MobileCardView users={displayedUsers} />
                    )}
                </div>

                {!isLoading && filteredUsers.length > 6 && (
                    <div className="mt-12 flex justify-center pb-20">
                        <motion.button 
                            whileHover={{ y: -4, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAll(!showAll)}
                            className="px-12 py-4 bg-white/50 border border-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 hover:text-indigo-600 hover:bg-white hover:shadow-xl hover:shadow-indigo-100/50 transition-all flex items-center gap-3 backdrop-blur-sm shadow-sm"
                        >
                            {showAll ? (
                                <><ChevronUp className="w-4 h-4" /> Collapse Repository</>
                            ) : (
                                <><ChevronDown className="w-4 h-4" /> Expand Full Archive ({filteredUsers.length} Records)</>
                            )}
                        </motion.button>
                    </div>
                )}

                <CustomModal
                    isOpen={!!modalType && modalType !== 'quota'}
                    onClose={() => setModalType(null)}
                    onConfirm={handleAction}
                    isLoading={isActionLoading}
                    type={modalType === 'delete' ? 'warning' : 'confirm'}
                    title={`${modalType?.charAt(0).toUpperCase() + modalType?.slice(1)} User: ${selectedUser?.name}`}
                    message={`Are you sure you want to ${modalType} ${selectedUser?.name}? ${modalType === 'delete' ? 'This action is permanent and cannot be undone.' : ''}`}
                />

                <QuotaOverrideModal 
                    isOpen={modalType === 'quota'}
                    onClose={() => setModalType(null)}
                    onSave={async (user, mb) => {
                        await handleSaveQuota(user, mb);
                        setModalType(null);
                    }}
                    user={selectedUser}
                    globalSettings={settings?.storage}
                    storageBudget={storageBudget}
                    isLoading={isActionLoading}
                />
            </div>
        </div>
    );
};

export default AdminUsers;
