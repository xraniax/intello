import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { adminService } from '@/features/admin/services/AdminService';
import { UserStatusBadge, UserRoleBadge } from '@/components/Admin/UserBadges';
import { 
    Search, ShieldAlert, Trash2, UserPlus, MoreVertical, 
    RefreshCw, UserCheck, ShieldOff, HardDrive, Filter, 
    DownloadCloud, UploadCloud, ChevronDown, ChevronUp, Mail, Calendar, Settings,
    Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import CustomModal from '@/components/ui/CustomModal';
import Skeleton from '@/components/ui/Skeleton';
import { formatDistanceToNow, format } from 'date-fns';
import { useUIStore } from '@/store/useUIStore';
import { formatBytes } from '@/utils/format';
import QuotaOverrideModal from '@/components/Admin/QuotaOverrideModal';


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

    // Metrics
    const metrics = useMemo(() => {
        const total = users.length;
        const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
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

    // Card Component
    const UserCard = ({ user }) => {
        const isExpanded = expandedUserId === user.id;
        const isDropdownOpen = activeDropdownId === user.id;
        const defaultQuotaBytes = (settings?.storage?.default_user_quota_mb || 100) * 1024 * 1024;
        const maxQuota = user.storage_limit_bytes || defaultQuotaBytes;
        const usageBytes = parseInt(user.storage_usage_bytes) || 0;
        const usagePercent = Math.min((usageBytes / maxQuota) * 100, 100);
        
        let progressColor = 'bg-emerald-500';
        if (usagePercent > 85) progressColor = 'bg-red-500';
        else if (usagePercent > 65) progressColor = 'bg-orange-400';

    return (
            <div className={`glass-card rounded-[2.5rem] border transition-all duration-500 flex flex-col overflow-hidden ${isExpanded ? 'border-white/80 shadow-2xl scale-[1.02] z-20 bg-white' : 'border-white/40 shadow-xl shadow-gray-200/20 hover:shadow-2xl hover:border-white/80 hover:-translate-y-1'}`}>
                <div className="p-8">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-8 relative">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-[1.5rem] bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform duration-500">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-black text-gray-900 text-xl tracking-tight leading-tight truncate max-w-[150px] xl:max-w-[180px]" title={user.name}>{user.name}</h3>
                                <p className="text-sm font-bold text-gray-400/80 truncate max-w-[150px] xl:max-w-[180px] mt-0.5" title={user.email}>{user.email}</p>
                            </div>
                        </div>
                        
                        <div className="relative shrink-0">
                            <button 
                                onClick={(e) => { e.stopPropagation(); setActiveDropdownId(isDropdownOpen ? null : user.id); }}
                                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                <MoreVertical className="w-5 h-5" />
                            </button>
                            
                            {isDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-30" onClick={() => setActiveDropdownId(null)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 py-2 z-40 animate-in fade-in zoom-in-95 font-semibold text-sm overflow-hidden">
                                        {user.role !== 'admin' && (
                                            <button onClick={(e) => { e.stopPropagation(); confirmAction(user, 'quota'); }} className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                                <Settings className="w-4 h-4" /> Adjust Quota
                                            </button>
                                        )}
                                        {user.role !== 'admin' && <div className="h-px bg-gray-100 my-1"></div>}
                                        {user.id !== currentUser?.id && (
                                            <>
                                                {user.status?.toUpperCase() === 'ACTIVE' ? (
                                                    <button onClick={(e) => { e.stopPropagation(); confirmAction(user, 'suspend'); }} className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-orange-600 hover:bg-orange-50 transition-colors">
                                                        <ShieldAlert className="w-4 h-4" /> Suspend
                                                    </button>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); confirmAction(user, 'activate'); }} className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-green-600 hover:bg-green-50 transition-colors">
                                                        <UserCheck className="w-4 h-4" /> Reactivate
                                                    </button>
                                                )}
                                                {user.role === 'admin' ? (
                                                    <button onClick={(e) => { e.stopPropagation(); confirmAction(user, 'demote'); }} className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors">
                                                        <ShieldOff className="w-4 h-4" /> Remove Admin
                                                    </button>
                                                ) : (
                                                    <button onClick={(e) => { e.stopPropagation(); confirmAction(user, 'promote'); }} className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-purple-600 hover:bg-purple-50 transition-colors">
                                                        <UserPlus className="w-4 h-4" /> Make Admin
                                                    </button>
                                                )}
                                                <div className="h-px bg-gray-100 my-1"></div>
                                                <button onClick={(e) => { e.stopPropagation(); confirmAction(user, 'delete'); }} className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors">
                                                    <Trash2 className="w-4 h-4" /> Delete Person
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Badges */}
                    <div className="flex gap-2 mb-6">
                        <UserRoleBadge role={user.role} />
                        <UserStatusBadge status={user.status} />
                        {(user.storage_limit_bytes && parseInt(user.storage_limit_bytes) !== defaultQuotaBytes) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-100">
                                Custom Quota
                            </span>
                        )}
                    </div>

                    {/* Storage Progress */}
                    {user.role !== 'admin' ? (
                        <div className="mb-6">
                            <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                                <span>Physical Occupancy</span>
                                <span className={`${usagePercent > 85 ? 'text-red-500' : 'text-gray-900'} font-black`}>
                                    {formatBytes(usageBytes)} / {formatBytes(maxQuota)}
                                </span>
                            </div>
                            <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-50">
                                <div className={`h-full rounded-full transition-all duration-1000 ${progressColor} shadow-[0_0_8px_rgba(0,0,0,0.1)]`} style={{ width: `${usagePercent}%` }}></div>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-6 p-5 bg-indigo-50/50 rounded-3xl border border-indigo-100/30 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm">
                                <ShieldAlert className="w-4 h-4 text-indigo-400" />
                            </div>
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">System Tier Access</p>
                        </div>
                    )}

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4 p-5 bg-gray-50/50 rounded-3xl border border-gray-100/50">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Volumes</p>
                            <p className="text-xl font-black text-gray-900 leading-none">{user.workspace_count || 0}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Last Active</p>
                            <p className="text-sm font-black text-gray-900 truncate">
                                {user.last_active_at 
                                    ? formatDistanceToNow(new Date(user.last_active_at), {addSuffix: true}) 
                                    : (user.last_login_at ? formatDistanceToNow(new Date(user.last_login_at), {addSuffix: true}) : 'Never')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Expand Toggle */}
                <button 
                    onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                    className="w-full py-3 border-t border-gray-50/80 flex items-center justify-center gap-2 text-xs font-bold text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/50 rounded-b-3xl transition-colors"
                >
                    {isExpanded ? (
                        <><ChevronUp className="w-4 h-4" /> Less Details</>
                    ) : (
                        <><ChevronDown className="w-4 h-4" /> View Details</>
                    )}
                </button>

                {isExpanded && (
                    <div className="p-6 border-t border-gray-100 bg-[#FAFAFA] rounded-b-3xl animate-in slide-in-from-top-4 duration-300">
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Member Since
                                </h4>
                                <p className="text-sm font-bold text-gray-900">
                                    {user.created_at ? format(new Date(user.created_at), 'MMMM do, yyyy') : 'Unknown'}
                                </p>
                            </div>
                            
                            {user.role !== 'admin' && (
                                <div className="pt-4 border-t border-gray-100 flex justify-between items-center bg-white rounded-2xl p-4 shadow-sm">
                                    <div>
                                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Quota Policy</h4>
                                        <p className="text-xs font-bold text-gray-900">
                                            {(user.storage_limit_bytes && parseInt(user.storage_limit_bytes) !== defaultQuotaBytes) 
                                                ? `${Math.round(user.storage_limit_bytes/(1024*1024))}MB (Custom)` 
                                                : `${Math.round(defaultQuotaBytes/(1024*1024))}MB (Default)`}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); confirmAction(user, 'quota'); }}
                                        className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100/50"
                                    >
                                        Adjust
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="relative min-h-[calc(100vh-64px)] p-6 md:p-10 max-w-7xl mx-auto overflow-hidden">
            <div className="ambient-orb ambient-orb-lg ambient-orb-1 top-[-5%] left-[-10%] bg-indigo-200/30"></div>
            <div className="ambient-orb ambient-orb-md ambient-orb-2 bottom-[5%] right-[-10%] bg-purple-200/20"></div>

            <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 font-bold">
                <div className="mb-12 group">
                    <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.2em] mb-2 text-indigo-500">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 anim-pulse"></div>
                        <span>Command Center</span>
                    </div>
                    <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-3">
                        Users <span className="text-gradient-hero">Directory</span>
                    </h1>
                    <p className="font-medium text-lg text-gray-500/80 max-w-2xl">
                        Manage your community. Control access, oversee roles, and balance storage resources across the cluster.
                    </p>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-indigo-100/20 group hover:-translate-y-1 transition-all duration-300">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block group-hover:text-indigo-400">Total Users</span>
                        <span className="text-4xl font-black text-gray-900 leading-none">{isLoading ? <Skeleton className="w-10 h-8" /> : metrics.total}</span>
                        <div className="mt-4 h-1 w-8 bg-indigo-50 rounded-full group-hover:w-full transition-all duration-500"></div>
                    </div>
                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-emerald-100/20 group hover:-translate-y-1 transition-all duration-300">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block group-hover:text-emerald-500">Online Now</span>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                            <span className="text-4xl font-black text-emerald-600 leading-none">{isLoading ? <Skeleton className="w-10 h-8" /> : metrics.onlineNow}</span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-500 mt-2 block opacity-70">Live Activity</span>
                    </div>
                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-orange-100/20 group hover:-translate-y-1 transition-all duration-300">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block group-hover:text-orange-400">Suspended</span>
                        <span className="text-4xl font-black text-orange-500 leading-none">{isLoading ? <Skeleton className="w-10 h-8" /> : metrics.suspended}</span>
                        <div className="mt-4 h-1 w-8 bg-orange-50 rounded-full group-hover:w-full transition-all duration-500"></div>
                    </div>
                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-indigo-100/20 group hover:-translate-y-1 transition-all duration-300">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 block group-hover:text-indigo-600">Storage Sum</span>
                        <span className="text-4xl font-black text-indigo-600 leading-none truncate block">{isLoading ? <Skeleton className="w-24 h-8" /> : formatBytes(metrics.totalStorageBytes)}</span>
                        <div className="mt-4 h-1 w-8 bg-indigo-50 rounded-full group-hover:w-full transition-all duration-500"></div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="glass-card p-3 rounded-[2rem] border border-white/50 shadow-lg shadow-gray-200/30 flex flex-col lg:flex-row justify-between items-center gap-4 mb-10 relative z-20">
                    <div className="flex gap-2 w-full lg:w-auto">
                        <button 
                            onClick={fetchData}
                            className="p-3 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors focus:outline-none shrink-0"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="h-10 w-px bg-gray-100 self-center hidden lg:block mx-1"></div>
                        <div className="relative flex-1 lg:w-40">
                            <select 
                                className="w-full h-full pl-4 pr-10 py-3 md:py-0 bg-gray-50/50 hover:bg-gray-100 text-sm font-bold text-gray-600 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                                value={filterRole}
                                onChange={(e) => setFilterRole(e.target.value)}
                            >
                                <option value="all">All Roles</option>
                                <option value="admin">Admins</option>
                                <option value="user">Users</option>
                            </select>
                            <Filter className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <div className="relative flex-1 lg:w-44">
                            <select 
                                className="w-full h-full pl-4 pr-10 py-3 md:py-0 bg-gray-50/50 hover:bg-gray-100 text-sm font-bold text-gray-600 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="all">All Statuses</option>
                                <option value="ACTIVE">Active</option>
                                <option value="SUSPENDED">Suspended</option>
                            </select>
                            <Filter className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <div className="relative flex-1 lg:w-44">
                            <select 
                                className="w-full h-full pl-4 pr-10 py-3 md:py-0 bg-gray-50/50 hover:bg-gray-100 text-sm font-bold text-gray-600 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                            >
                                <option value="created_at">Date Joined</option>
                                <option value="name">Name</option>
                                <option value="email">Email</option>
                                <option value="last_active_at">Last Active</option>
                                <option value="storage_usage_bytes">Storage Used</option>
                                <option value="workspace_count">Workspaces</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                        <div className="relative flex-1 lg:w-36">
                            <select 
                                className="w-full h-full pl-4 pr-10 py-3 md:py-0 bg-gray-50/50 hover:bg-gray-100 text-sm font-bold text-gray-600 border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 outline-none rounded-xl appearance-none cursor-pointer transition-all"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                            >
                                <option value="desc">Descending</option>
                                <option value="asc">Ascending</option>
                            </select>
                            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                    
                    <div className="relative w-full lg:w-96 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search by name or email..." 
                            className="w-full bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-700 outline-none border border-transparent focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-50/50 rounded-xl py-3 pl-11 pr-4 transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                {/* Content Grid */}
                <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10 transition-opacity duration-300 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    {isLoading && users.length === 0 ? (
                        Array(6).fill(0).map((_, i) => (
                            <div key={i} className="card-minimal h-[320px]">
                                <div className="flex items-center gap-4 mb-6">
                                    <Skeleton className="w-12 h-12 rounded-2xl" />
                                    <div><Skeleton className="w-32 h-5 mb-2" /><Skeleton className="w-24 h-3" /></div>
                                </div>
                                <Skeleton className="w-full h-2 mb-8" />
                                <Skeleton className="w-full h-20 rounded-2xl" />
                            </div>
                        ))
                    ) : filteredUsers.length === 0 ? (
                        <div className="col-span-full py-20 bg-white border border-gray-200 border-dashed rounded-[3rem] text-center shadow-sm">
                            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mx-auto mb-4 border border-gray-100">
                                <Search className="w-8 h-8" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 mb-2">No users found</h3>
                            <p className="text-gray-500 font-medium max-w-sm mx-auto">We couldn't find any users matching your criteria. Try adjusting your filters or search query.</p>
                            <button onClick={() => { setSearchQuery(''); setFilterRole('all'); setFilterStatus('all'); }} className="mt-6 px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors">
                                Clear all filters
                            </button>
                        </div>
                    ) : (
                        displayedUsers.map(user => <UserCard key={user.id} user={user} />)
                    )}
                </div>
                
                {!isLoading && filteredUsers.length > 6 && (
                    <div className="mt-8 flex justify-center">
                        <button 
                            onClick={() => setShowAll(!showAll)}
                            className="px-8 py-3 bg-white border border-gray-100 rounded-full text-sm font-black text-gray-600 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50/50 transition-all flex items-center gap-2"
                        >
                            {showAll ? (
                                <><ChevronUp className="w-4 h-4" /> Show Less</>
                            ) : (
                                <><ChevronDown className="w-4 h-4" /> See All {filteredUsers.length} Users</>
                            )}
                        </button>
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
