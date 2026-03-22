import React, { useState, useEffect, useMemo } from 'react';
import { adminService } from '../../services/api';
import { UserStatusBadge, UserRoleBadge } from '../../components/Admin/UserBadges';
import { 
    Search, ShieldAlert, Trash2, UserPlus, MoreVertical, 
    RefreshCw, UserCheck, ShieldOff, HardDrive, Filter, 
    DownloadCloud, UploadCloud, ChevronDown, ChevronUp, Mail, Calendar, Settings
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import CustomModal from '../../components/Common/CustomModal';
import Skeleton from '../../components/Common/Skeleton';
import { formatDistanceToNow, format } from 'date-fns';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState(null); // to get global quota
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterRole, setFilterRole] = useState('all');
    
    const [expandedUserId, setExpandedUserId] = useState(null);
    const [activeDropdownId, setActiveDropdownId] = useState(null);
    
    // Action Modals State
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalType, setModalType] = useState(null); // 'suspend', 'activate', 'promote', 'demote', 'delete', 'quota'
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [quotaInputMb, setQuotaInputMb] = useState('');

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, settingsRes] = await Promise.all([
                adminService.getUsers(),
                adminService.getSettings()
            ]);
            setUsers(usersRes.data.data);
            setSettings(settingsRes.data.data.storage);
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
        return users.filter(user => {
            const matchesSearch = user.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                                user.email.toLowerCase().includes(debouncedSearch.toLowerCase());
            const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
            const matchesRole = filterRole === 'all' || user.role === filterRole;
            return matchesSearch && matchesStatus && matchesRole;
        });
    }, [users, debouncedSearch, filterStatus, filterRole]);

    // Metrics
    const metrics = useMemo(() => {
        const total = users.length;
        const active = users.filter(u => u.status === 'active').length;
        const inactive = total - active;
        const totalStorageBytes = users.reduce((acc, u) => acc + (parseInt(u.storage_usage_bytes) || 0), 0);
        return { total, active, inactive, totalStorageBytes };
    }, [users]);

    const handleAction = async () => {
        if (!selectedUser || !modalType) return;
        setIsActionLoading(true);
        try {
            if (modalType === 'suspend') {
                await adminService.updateUserStatus(selectedUser.id, 'suspended');
                toast.success(`${selectedUser.name} suspended`);
            } else if (modalType === 'activate') {
                await adminService.updateUserStatus(selectedUser.id, 'active');
                toast.success(`${selectedUser.name} reactivated`);
            } else if (modalType === 'promote') {
                await adminService.updateUserRole(selectedUser.id, 'admin');
                toast.success(`${selectedUser.name} promoted to admin`);
            } else if (modalType === 'demote') {
                await adminService.updateUserRole(selectedUser.id, 'user');
                toast.success(`${selectedUser.name} demoted to user`);
            } else if (modalType === 'delete') {
                await adminService.deleteUser(selectedUser.id);
                toast.success(`${selectedUser.name} deleted`);
            } else if (modalType === 'quota') {
                const limitBytes = quotaInputMb ? parseInt(quotaInputMb) * 1024 * 1024 : null;
                await adminService.updateUserStorageLimit(selectedUser.id, limitBytes);
                toast.success('Storage limit updated');
            }
            await fetchData();
            setModalType(null);
            setSelectedUser(null);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed');
        } finally {
            setIsActionLoading(false);
        }
    };

    const confirmAction = (user, type) => {
        setSelectedUser(user);
        setModalType(type);
        setActiveDropdownId(null);
        if (type === 'quota') {
            const currentLimitMb = user.storage_limit_bytes ? Math.round(user.storage_limit_bytes / (1024 * 1024)) : '';
            setQuotaInputMb(currentLimitMb.toString());
        }
    };

    // Card Component
    const UserCard = ({ user }) => {
        const isExpanded = expandedUserId === user.id;
        const isDropdownOpen = activeDropdownId === user.id;
        const defaultQuotaBytes = settings?.default_user_quota_mb * 1024 * 1024;
        const maxQuota = user.storage_limit_bytes || defaultQuotaBytes || (100 * 1024 * 1024);
        const usageBytes = parseInt(user.storage_usage_bytes) || 0;
        const usagePercent = Math.min((usageBytes / maxQuota) * 100, 100);
        
        let progressColor = 'bg-emerald-500';
        if (usagePercent > 85) progressColor = 'bg-red-500';
        else if (usagePercent > 65) progressColor = 'bg-orange-400';

        return (
            <div className={`bg-white rounded-2xl border transition-all duration-300 flex flex-col ${isExpanded ? 'border-indigo-200 shadow-xl shadow-indigo-100/50 scale-[1.02] z-10' : 'border-gray-100 hover:border-purple-100 shadow-sm hover:shadow-xl hover:-translate-y-0.5'}`}>
                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6 relative">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-black text-lg shadow-sm">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="font-bold text-gray-900 text-lg leading-tight truncate max-w-[170px] xl:max-w-[200px]" title={user.name}>{user.name}</h3>
                                <p className="text-sm font-medium text-gray-500 truncate max-w-[170px] xl:max-w-[200px]" title={user.email}>{user.email}</p>
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
                                        <button onClick={(e) => { e.stopPropagation(); confirmAction(user, 'quota'); }} className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                                            <Settings className="w-4 h-4" /> Adjust Quota
                                        </button>
                                        <div className="h-px bg-gray-100 my-1"></div>
                                        {user.status === 'active' ? (
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
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Badges */}
                    <div className="flex gap-2 mb-6">
                        <UserRoleBadge role={user.role} />
                        <UserStatusBadge status={user.status} />
                        {user.storage_limit_bytes && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-600 border border-orange-100">
                                Custom Quota
                            </span>
                        )}
                    </div>

                    {/* Storage Progress */}
                    <div className="mb-4">
                        <div className="flex justify-between text-xs font-bold text-gray-500 mb-2">
                            <span>Storage Usage</span>
                            <span className={usagePercent > 85 ? 'text-red-500' : 'text-gray-900'}>
                                {formatBytes(usageBytes)} / {formatBytes(maxQuota)}
                            </span>
                        </div>
                        <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-1000 ${progressColor}`} style={{ width: `${usagePercent}%` }}></div>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-gray-50 rounded-2xl">
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Materials</p>
                            <p className="text-lg font-black text-gray-900 leading-none">{user.material_count || 0}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Last Active</p>
                            <p className="text-sm font-bold text-gray-900 truncate">
                                {user.last_login_at ? formatDistanceToNow(new Date(user.last_login_at), {addSuffix: true}) : 'Never'}
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

                {/* Expanded Details Section */}
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
                            
                            <div className="pt-4 border-t border-gray-200">
                                <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <HardDrive className="w-4 h-4" /> Quota Override
                                </h4>
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        placeholder={`Default (${settings?.default_user_quota_mb}MB)`} 
                                        className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold outline-none focus:border-indigo-500 transition-colors"
                                        value={quotaInputMb}
                                        onChange={(e) => setQuotaInputMb(e.target.value)}
                                        onClick={(e) => { e.stopPropagation(); setQuotaInputMb(user.storage_limit_bytes ? Math.round(user.storage_limit_bytes / (1024*1024)).toString() : ''); }}
                                    />
                                    <button 
                                        onClick={() => { setSelectedUser(user); setModalType('quota'); handleAction(); }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm shadow-indigo-200 active:scale-95 transition-all outline-none"
                                    >
                                        Save
                                    </button>
                                </div>
                                <p className="text-[10px] font-medium text-gray-500 mt-2 ml-1">Leave empty to use global system default.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 animate-in fade-in duration-500">
            {/* Header & Metrics */}
            <div className="mb-10">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-6">
                    <div className="group">
                        <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-[0.2em] mb-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 anim-pulse"></div>
                            <span>Admin Console</span>
                        </div>
                        <h1 className="text-5xl font-black text-gray-900 tracking-tight lg:tracking-tighter mb-2">
                            Users <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 drop-shadow-sm">Directory</span>
                        </h1>
                        <p className="text-gray-500 font-medium mt-2 text-lg">Manage access, roles, and individual storage quotas.</p>
                    </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                    <div className="card-minimal p-5 flex flex-col justify-between group">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 group-hover:text-indigo-400 transition-colors">Total Users</span>
                        <span className="text-3xl font-black text-gray-900">{isLoading ? <Skeleton className="w-10 h-8" /> : metrics.total}</span>
                    </div>
                    <div className="card-minimal p-5 flex flex-col justify-between group">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 group-hover:text-mint-500 transition-colors">Active Now</span>
                        <span className="text-3xl font-black text-mint-600">{isLoading ? <Skeleton className="w-10 h-8" /> : metrics.active}</span>
                    </div>
                    <div className="card-minimal p-5 flex flex-col justify-between group">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 group-hover:text-orange-400 transition-colors">Suspended</span>
                        <span className="text-3xl font-black text-orange-500">{isLoading ? <Skeleton className="w-10 h-8" /> : metrics.inactive}</span>
                    </div>
                    <div className="card-minimal p-5 flex flex-col justify-between group">
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2 group-hover:text-indigo-400 transition-colors">Storage Consumed</span>
                        <span className="text-3xl font-black text-indigo-600 truncate">{isLoading ? <Skeleton className="w-24 h-8" /> : formatBytes(metrics.totalStorageBytes)}</span>
                    </div>
                </div>

                {/* Action Bar (Filters & Search) */}
                <div className="bg-white p-2 md:p-3 rounded-2xl flex flex-col lg:flex-row justify-between items-center gap-4 border border-gray-100 shadow-sm relative z-20">
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
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                            </select>
                            <Filter className="w-4 h-4 text-gray-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                    filteredUsers.map(user => <UserCard key={user.id} user={user} />)
                )}
            </div>

            {/* Action Confirmation Modal */}
            <CustomModal
                isOpen={!!modalType && modalType !== 'quota'}
                onClose={() => !isActionLoading && setModalType(null)}
                title={`${modalType?.charAt(0).toUpperCase() + modalType?.slice(1)} User: ${selectedUser?.name}`}
            >
                <div className="p-6">
                    <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto ${
                        modalType === 'delete' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
                    }`}>
                        {modalType === 'delete' ? <Trash2 className="w-8 h-8" /> : <ShieldAlert className="w-8 h-8" />}
                    </div>
                    <p className="text-center text-gray-600 font-medium mb-8">
                        Are you sure you want to <strong>{modalType}</strong> {selectedUser?.name}? 
                        {modalType === 'delete' && ' This action is permanent and cannot be undone.'}
                    </p>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setModalType(null)}
                            disabled={isActionLoading}
                            className="flex-1 py-4 font-bold text-gray-500 bg-white rounded-2xl hover:bg-gray-50 transition-all border border-gray-200 focus:outline-none"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleAction}
                            disabled={isActionLoading}
                            className={`flex-1 py-4 font-bold text-white rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 focus:outline-none ${
                                modalType === 'delete' ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                            }`}
                        >
                            {isActionLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Confirm Action'}
                        </button>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
};

export default AdminUsers;
