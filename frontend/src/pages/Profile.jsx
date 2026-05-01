import React, { useState, useEffect } from 'react';

import { profileService } from '@/features/user/services/ProfileService';
import { useAuth } from '@/hooks/AuthContext';
import { useUIStore } from '@/store/useUIStore';
import StatusBadge from '@/components/ui/StatusBadge';
import { Sparkles, ArrowRight, Upload, CheckCircle, MessageCircle, BookOpen, Brain } from 'lucide-react';
import toast from 'react-hot-toast';

// Simple SVG Icons
const Icons = {
  User: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Stats: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Award: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>,
  HardDrive: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 1.1.9 2 2 2h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2zm0 5h16M7 15h.01M11 15h.01" /></svg>
};

const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const Profile = () => {
    const { user, updateUser } = useAuth();

    const [profileData, setProfileData] = useState(null);
    const uiLoading = useUIStore(state => state.data.loadingStates['profile']?.loading || false);
    const uiActions = useUIStore(state => state.actions);
    const [activeTab, setActiveTab] = useState('info');
    
    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', notifications: true, theme: 'light' });
    const [saving, setSaving] = useState(false);


    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            uiActions.setLoading('profile', true, 'Loading your data...', false);
            const res = await profileService.getProfile();
            setProfileData(res.data.data);
            setEditForm({
                name: res.data.data.basic_info.name || '',
                notifications: res.data.data.settings.notifications ?? true,
                theme: res.data.data.settings.theme || 'light'
            });
        } catch (err) {
            toast.error(err.message || 'Failed to load profile');
        } finally {
            uiActions.setLoading('profile', false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const updates = {
                name: editForm.name,
                settings: {
                    ...profileData.settings,
                    notifications: editForm.notifications,
                    theme: editForm.theme
                }
            };
            const res = await profileService.updateProfile(updates);
            setProfileData(prev => ({
                ...prev,
                basic_info: { ...prev.basic_info, name: res.data.data.name },
                settings: res.data.data.settings
            }));
            updateUser({ ...user, name: res.data.data.name }); // Update context
            toast.success('Profile updated successfully');
            setIsEditing(false);
        } catch (err) {
            toast.error(err.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    if (uiLoading && !profileData) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-20 min-h-[400px]" style={{ background: 'var(--c-canvas)' }}>
                <div className="w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mb-6" style={{ borderColor: 'var(--c-primary-light)', borderTopColor: 'var(--c-primary)' }}></div>
                <h3 className="text-xl font-black mb-2">Architecting your profile</h3>
                <p className="font-bold uppercase tracking-widest text-xs" style={{ color: 'var(--c-text-muted)' }}>Synchronizing knowledge...</p>
            </div>
        );
    }

    if (!profileData) return (
        <div className="flex-1 flex flex-col items-center justify-center p-20 bg-white">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-6 border border-red-100">
                <Icons.Activity />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Knowledge retrieval failed</h3>
            <p className="text-gray-500 font-medium mb-8">We couldn't load your profile data at this time.</p>
            <button onClick={fetchProfile} className="btn-vibrant px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs">Retry sync</button>
        </div>
    );

    const { basic_info, stats, activity, settings, analytics } = profileData;

    return (
        <div className="min-h-full overflow-y-auto animate-in fade-in" style={{ background: 'var(--c-canvas)' }}>
            {/* Header Banner */}
            <div className="h-64 relative overflow-hidden" style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border-soft)' }}>
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(var(--c-primary) 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 pb-12 relative z-10">
                {/* Profile Avatar & Title */}
                <div className="card-minimal p-8 mb-8 flex flex-col md:flex-row items-center md:items-end gap-6 bg-white/90 backdrop-blur-md rounded-[2.5rem] border-[3px] border-white" style={{ boxShadow: 'var(--shadow-sm)' }}>
                    <div className="w-36 h-36 rounded-full border-[6px] shadow-sm flex items-center justify-center overflow-hidden shrink-0 relative transition-transform hover:scale-105 duration-300 z-10 -mt-16 md:-mt-24" style={{ background: 'var(--c-primary-ultra)', borderColor: 'var(--c-surface)', color: 'var(--c-primary)' }}>
                        {basic_info.avatar_url ? (
                            <img src={basic_info.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-6xl font-black font-serif">
                                {basic_info.name?.charAt(0).toUpperCase()}
                            </span>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none"></div>
                    </div>
                    <div className="flex-1 text-center md:text-left mb-2">
                        <h1 className="text-4xl font-black mb-1 tracking-tight font-serif" style={{ color: 'var(--c-text)' }}>{basic_info.name}</h1>
                        <div className="font-bold flex items-center justify-center md:justify-start gap-3 mt-2" style={{ color: 'var(--c-text-secondary)' }}>
                            {basic_info.email}
                            <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest" style={{ background: 'var(--c-success-light)', color: 'var(--c-success)' }}>
                                {basic_info.role}
                            </span>
                        </div>
                    </div>
                    {!isEditing && (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="btn-secondary"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Nav */}
                    <div className="lg:col-span-1 lg:border-r border-gray-100 pr-4">
                        <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
                            {[
                                { id: 'info', label: 'Basic Info', icon: Icons.User },
                                { id: 'stats', label: 'Learning Stats', icon: Icons.Stats },
                                { id: 'activity', label: 'Recent Activity', icon: Icons.Activity },
                                { id: 'settings', label: 'Settings', icon: Icons.Settings },
                            ].map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => { setActiveTab(item.id); setIsEditing(false); }}
                                    className={`flex items-center gap-3 px-5 py-3 rounded-[1.5rem] font-bold transition-all text-left whitespace-nowrap`}
                                    style={{
                                        background: activeTab === item.id ? 'var(--c-primary-light)' : 'transparent',
                                        color: activeTab === item.id ? 'var(--c-primary)' : 'var(--c-text-secondary)',
                                        boxShadow: activeTab === item.id ? '0 4px 12px -2px rgba(124, 92, 252, 0.2)' : 'none'
                                    }}
                                >
                                    <item.icon />
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="lg:col-span-3">
                        {/* Tab: Info & Settings (combined if Edit Mode) */}
                        {(activeTab === 'info' || isEditing) && (
                            <div className="card-minimal p-8">
                                <h2 className="text-2xl font-bold tracking-tight mb-6" style={{ color: 'var(--c-text)' }}>
                                    {isEditing ? 'Edit Profile & Settings' : 'Basic Information'}
                                </h2>

                                {isEditing ? (
                                    <form onSubmit={handleSave} className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: 'var(--c-text-muted)' }}>Full Name</label>
                                            <input 
                                                type="text" 
                                                value={editForm.name}
                                                onChange={e => setEditForm(prev => ({...prev, name: e.target.value}))}
                                                className="input-field"
                                                required
                                                disabled={saving}
                                            />
                                        </div>

                                        <div className="p-6 rounded-2xl" style={{ background: 'var(--c-warning-light)', borderColor: 'rgba(245, 158, 11, 0.2)', borderWidth: 1 }}>
                                            <h3 className="text-sm font-bold uppercase tracking-widest mb-4" style={{ color: 'var(--c-warning)' }}>Preferences</h3>
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <p className="font-bold">Email Notifications</p>
                                                    <p className="text-xs font-medium" style={{ color: 'var(--c-text-muted)' }}>Receive alerts about courses and quizzes.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={editForm.notifications} 
                                                        onChange={e => setEditForm(prev => ({...prev, notifications: e.target.checked}))} 
                                                        className="sr-only peer"
                                                        disabled={saving}
                                                    />
                                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: editForm.notifications ? 'var(--c-primary)' : '#e5e7eb' }}></div>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="pt-4 flex justify-end gap-3">
                                            <button 
                                                type="button" 
                                                onClick={() => setIsEditing(false)}
                                                className="btn-secondary"
                                                disabled={saving}
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                type="submit" 
                                                disabled={saving}
                                                className="btn-primary"
                                            >
                                                {saving ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                                                        <span>Saving...</span>
                                                    </>
                                                ) : 'Save Changes'}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="p-4 rounded-xl" style={{ background: 'var(--c-surface-alt)' }}>
                                                <p className="text-sm font-medium mb-1" style={{ color: 'var(--c-text-muted)' }}>Email Address</p>
                                                <p className="font-semibold">{basic_info.email}</p>
                                            </div>
                                            <div className="p-4 rounded-xl" style={{ background: 'var(--c-surface-alt)' }}>
                                                <p className="text-sm font-medium mb-1" style={{ color: 'var(--c-text-muted)' }}>Account Created</p>
                                                <p className="font-semibold">{new Date(basic_info.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-8 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
                                            <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
                                                <Icons.HardDrive /> Storage Usage
                                            </h3>
                                            <div className="p-6 rounded-2xl border" style={{ background: 'var(--c-surface-alt)', borderColor: 'var(--c-border)' }}>
                                                <div className="flex justify-between items-end mb-3">
                                                    <div>
                                                        <span className="text-3xl font-black">{formatBytes(profileData.quota.usedBytes)}</span>
                                                        <span className="font-bold ml-2" style={{ color: 'var(--c-text-muted)' }}>used of {formatBytes(profileData.quota.limitBytes)}</span>
                                                    </div>
                                                    <span className={`text-sm font-black px-3 py-1 rounded-lg ${
                                                        (profileData.quota.usedBytes / profileData.quota.limitBytes) > 0.9 ? 'bg-red-100 text-red-700' :
                                                        (profileData.quota.usedBytes / profileData.quota.limitBytes) > 0.7 ? 'bg-orange-100 text-orange-700' :
                                                        'bg-indigo-50 text-indigo-700'
                                                    }`} style={{ 
                                                        background: 'var(--c-primary-ultra)', color: 'var(--c-primary)' 
                                                    }}>
                                                        {Math.round((profileData.quota.usedBytes / profileData.quota.limitBytes) * 100)}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-[1rem] h-4 overflow-hidden shadow-inner flex items-center p-0.5">
                                                    <div 
                                                        className={`h-full rounded-[0.8rem] transition-all duration-1000 shadow-sm`}
                                                        style={{ 
                                                            width: `${Math.max(2, (profileData.quota.usedBytes / profileData.quota.limitBytes) * 100)}%`,
                                                            background: 'linear-gradient(135deg, var(--c-primary) 0%, #4F46E5 100%)'
                                                        }}
                                                    ></div>
                                                </div>
                                                <p className="text-xs mt-4 font-medium italic" style={{ color: 'var(--c-text-muted)' }}>
                                                    * Failed processing attempts do not count against your quota.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-8 border-t" style={{ borderColor: 'var(--c-border-soft)' }}>
                                            <h3 className="text-lg font-bold tracking-tight mb-4 flex items-center gap-2">
                                                <Icons.Award /> Achievements
                                            </h3>
                                            <div className="flex flex-wrap gap-3">
                                                {basic_info.achievements?.length > 0 ? basic_info.achievements.map((ach, i) => (
                                                    <span key={i} className="px-4 py-2 rounded-full font-semibold border" style={{ background: 'var(--c-warning-light)', color: 'var(--c-warning)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
                                                        {ach}
                                                    </span>
                                                )) : (
                                                    <p className="italic text-sm" style={{ color: 'var(--c-text-muted)' }}>No badges earned yet. Keep learning!</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Stats & Analytics */}
                        {activeTab === 'stats' && !isEditing && (
                            <div className="space-y-6 animate-in fade-in">
                                {/* Top Stats */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="card-minimal p-6 flex flex-col items-center justify-center text-center group cursor-default transition-all duration-300 overflow-hidden relative">
                                        <div className="w-14 h-14 shadow-sm rounded-[1.25rem] flex items-center justify-center mb-4 transition-all" style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)', border: '1px solid var(--c-primary-ultra)' }}>
                                            <Icons.Stats />
                                        </div>
                                        <h3 className="text-4xl font-black mb-1 font-serif tracking-tight" style={{ color: 'var(--c-text)' }}>{stats.total_workspaces}</h3>
                                        <p className="font-bold tracking-tight text-[13px] uppercase" style={{ color: 'var(--c-text-muted)' }}>Active Workspaces</p>
                                    </div>
                                    <div className="card-minimal p-6 flex flex-col items-center justify-center text-center group cursor-default transition-all duration-300 overflow-hidden relative">
                                        <div className="w-14 h-14 shadow-sm rounded-[1.25rem] flex items-center justify-center mb-4 transition-all" style={{ background: 'var(--c-coral-light)', color: 'var(--c-coral)', border: '1px solid rgba(255,107,107,0.1)' }}>
                                            <Icons.Activity />
                                        </div>
                                        <h3 className="text-4xl font-black mb-1 font-serif tracking-tight" style={{ color: 'var(--c-text)' }}>{stats.total_materials}</h3>
                                        <p className="font-bold tracking-tight text-[13px] uppercase" style={{ color: 'var(--c-text-muted)' }}>Total Materials</p>
                                    </div>
                                </div>

                                {/* Subject Readiness List */}
                                <div className="card-minimal p-8">
                                    <h2 className="text-xl font-bold tracking-tight mb-6 flex items-center gap-2">
                                        <Icons.Award /> Subject Readiness
                                    </h2>
                                    
                                    <div className="space-y-6">
                                        {stats.subject_readiness?.length > 0 ? stats.subject_readiness.map((item, i) => (
                                            <div key={i} className="flex flex-col gap-3 p-5 rounded-3xl border-2 transition-all hover:border-purple-200 group bg-white shadow-sm hover:shadow-md" style={{ borderColor: 'rgba(124, 92, 252, 0.05)' }}>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-black text-indigo-950 uppercase tracking-wide text-sm">{item.name}</span>
                                                    <span className="text-sm font-black px-3 py-1 rounded-full bg-purple-50 text-purple-600">
                                                        {item.readiness}% Mastered
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-3.5 overflow-hidden p-0.5 shadow-inner">
                                                    <div 
                                                        className="h-full rounded-full transition-all duration-1000 shadow-sm"
                                                        style={{ 
                                                            width: `${item.readiness === 0 ? 5 : item.readiness}%`,
                                                            background: item.readiness > 80 ? 'linear-gradient(90deg, #10B981, #34D399)' : 
                                                                        item.readiness > 40 ? 'linear-gradient(90deg, #7C5CFC, #A78BFA)' : 
                                                                        'linear-gradient(90deg, #F43F5E, #FB7185)'
                                                        }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-12 opacity-50 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No subjects enrolled yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Analytics Panel */}
                                <div className="card-minimal p-8">
                                    <h2 className="text-xl font-bold tracking-tight mb-6">Learning Insights</h2>
                                    
                                    <div className="mb-8">
                                        <p className="text-xs font-black mb-3 uppercase tracking-[0.2em]" style={{ color: 'var(--c-text-muted)' }}>Learning Status</p>
                                        <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl shadow-sm text-white font-black" style={{ background: 'var(--c-primary)', boxShadow: '0 8px 24px -6px var(--c-primary-light)' }}>
                                            <Sparkles className="w-5 h-5" />
                                            <span className="text-xl uppercase tracking-wider">{analytics.learning_status}</span>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl p-8 bg-indigo-50/50 border-2 border-indigo-100/50 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100/30 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                                        <h3 className="font-black mb-5 text-lg text-indigo-950 uppercase tracking-widest flex items-center gap-2">
                                            <ArrowRight className="w-5 h-5 text-indigo-500" />
                                            Recommended Next Steps
                                        </h3>
                                        <ul className="space-y-4 relative z-10">
                                            {analytics.recommendations.map((rec, i) => (
                                                <li key={i} className="flex items-start gap-4 p-4 rounded-2xl bg-white shadow-sm border border-indigo-50 transition-transform hover:scale-[1.02] cursor-default">
                                                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black shrink-0 text-xs">{i+1}</div>
                                                    <span className="font-bold text-gray-700 leading-tight">{rec}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Activity */}
                        {activeTab === 'activity' && !isEditing && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="card-minimal p-8 bg-white/50 backdrop-blur-sm border-2 border-purple-50">
                                    <h2 className="text-2xl font-black text-indigo-950 mb-8 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center">
                                            <Upload className="w-5 h-5" />
                                        </div>
                                        Recent Uploads
                                        <span className="text-sm ml-auto px-4 py-1.5 rounded-full bg-purple-50 text-purple-600 font-black">
                                            {activity.recent_uploads?.length || 0} Total
                                        </span>
                                    </h2>
                                    <div className="grid grid-cols-1 gap-4">
                                        {activity.recent_uploads?.length > 0 ? activity.recent_uploads.map(item => (
                                            <div key={item.id} className="group relative flex items-center gap-5 p-5 rounded-[2rem] bg-white border-2 border-transparent hover:border-purple-200 transition-all hover:shadow-xl hover:shadow-purple-900/5 hover:-translate-y-1">
                                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0">
                                                    <BookOpen className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-indigo-950 truncate tracking-tight text-lg">{item.title}</p>
                                                    <p className="text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                                                </div>
                                                <StatusBadge status={item.status} size="sm" />
                                            </div>
                                        )) : (
                                            <div className="text-center py-10 opacity-50 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                                                <p className="font-bold text-gray-400 uppercase tracking-widest text-xs">No uploads yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="card-minimal p-8 bg-white/50 backdrop-blur-sm border-2 border-pink-50">
                                    <h2 className="text-2xl font-black text-indigo-950 mb-8 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-pink-100 text-pink-600 flex items-center justify-center">
                                            <CheckCircle className="w-5 h-5" />
                                        </div>
                                        Completed Quizzes
                                        <span className="text-sm ml-auto px-4 py-1.5 rounded-full bg-pink-50 text-pink-600 font-black">
                                            {activity.recent_quizzes?.length || 0} Done
                                        </span>
                                    </h2>
                                    <div className="grid grid-cols-1 gap-4">
                                        {activity.recent_quizzes?.length > 0 ? activity.recent_quizzes.map(item => (
                                            <div key={item.id} className="group relative flex items-center gap-5 p-5 rounded-[2rem] bg-white border-2 border-transparent hover:border-pink-200 transition-all hover:shadow-xl hover:shadow-pink-900/5 hover:-translate-y-1">
                                                <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center shrink-0">
                                                    <Brain className="w-6 h-6" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-black text-indigo-950 truncate tracking-tight text-lg">{item.title}</p>
                                                    <p className="text-xs font-bold text-gray-400 mt-0.5 uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                                                </div>
                                                <div className="px-5 py-2 rounded-2xl bg-pink-50 text-pink-600 font-black text-sm">
                                                    Quiz
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-10 opacity-50 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                                                <p className="font-bold text-gray-400 uppercase tracking-widest text-xs">No quizzes yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="card-minimal p-8 bg-white/50 backdrop-blur-sm border-2 border-indigo-50">
                                    <h2 className="text-2xl font-black text-indigo-950 mb-8 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                                            <MessageCircle className="w-5 h-5" />
                                        </div>
                                        Recent Chats
                                        <span className="text-sm ml-auto px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 font-black">
                                            {activity.recent_interactions?.length || 0} Chats
                                        </span>
                                    </h2>
                                    <div className="grid grid-cols-1 gap-6">
                                        {activity.recent_interactions?.length > 0 ? activity.recent_interactions.map(item => (
                                            <div key={item.id} className="relative p-6 rounded-[2.5rem] bg-indigo-50/50 border-2 border-indigo-100/50 flex flex-col gap-4">
                                                <div className="flex items-start gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm border border-indigo-100 font-black text-indigo-600 text-sm">You</div>
                                                    <p className="font-bold text-indigo-950/80 leading-relaxed pt-2">{item.message}</p>
                                                </div>
                                                <div className="flex items-start gap-4 p-5 rounded-[2rem] bg-white shadow-sm border border-indigo-50 self-end max-w-[90%]">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 text-white shadow-md shadow-indigo-200">
                                                        <Brain className="w-5 h-5" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <p className="text-sm font-bold text-indigo-700 uppercase tracking-widest">Cognify Bot</p>
                                                        <p className="font-medium text-gray-700 leading-relaxed">{item.response.length > 150 ? item.response.substring(0, 150) + '...' : item.response}</p>
                                                    </div>
                                                </div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300 self-end mt-2">{new Date(item.timestamp).toLocaleString()}</p>
                                            </div>
                                        )) : (
                                            <div className="text-center py-10 opacity-50 bg-gray-50/50 rounded-3xl border-2 border-dashed border-gray-100">
                                                <p className="font-bold text-gray-400 uppercase tracking-widest text-xs">No chats yet</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Tab: Settings */}
                        {activeTab === 'settings' && !isEditing && (
                            <div className="card-minimal p-8 animate-in fade-in">
                                 <h2 className="text-2xl font-bold tracking-tight mb-6">Settings & Privacy</h2>
                                 <div className="space-y-6">
                                     <div className="flex justify-between items-center p-5 rounded-xl border" style={{ background: 'var(--c-surface-alt)', borderColor: 'var(--c-border-soft)' }}>
                                         <div>
                                            <p className="font-bold">Email Notifications</p>
                                            <p className="text-sm" style={{ color: 'var(--c-text-muted)' }}>Currently: <span className="font-semibold" style={{ color: 'var(--c-primary)' }}>{settings.notifications ? 'Enabled' : 'Disabled'}</span></p>
                                         </div>
                                         <button onClick={() => { setIsEditing(true); setActiveTab('info'); }} className="btn-secondary px-4 py-2 text-sm min-h-0">Change</button>
                                     </div>
                                 </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Profile;
