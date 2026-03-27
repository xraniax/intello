import React, { useState, useEffect } from 'react';
import { profileService } from '../services/api';
import { useAuth } from '../hooks/AuthContext';
import toast from 'react-hot-toast';

// Simple SVG Icons
const Icons = {
  User: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Stats: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Activity: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  Settings: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  Award: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
};

const Profile = () => {
    const { user, updateUser } = useAuth();
    const [profileData, setProfileData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('info');
    
    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', notifications: true, theme: 'system' });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await profileService.getProfile();
            setProfileData(res.data.data);
            setEditForm({
                name: res.data.data.basic_info.name || '',
                notifications: res.data.data.settings.notifications ?? true,
                theme: res.data.data.settings.theme || 'system'
            });
        } catch (err) {
            toast.error(err.message || 'Failed to load profile');
        } finally {
            setLoading(false);
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

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center p-8 bg-[#fcfbf9]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fuchsia-600"></div>
            </div>
        );
    }

    if (!profileData) return <div className="p-8 text-center text-gray-500">Failed to load profile</div>;

    const { basic_info, stats, activity, settings, analytics } = profileData;

    return (
        <div className="min-h-full bg-[#fcfbf9] overflow-y-auto">
            {/* Header Banner */}
            <div className="h-48 bg-gradient-to-r from-fuchsia-100 via-purple-100 to-indigo-100 relative">
                <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]"></div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 pb-12 relative z-10">
                {/* Profile Avatar & Title */}
                <div className="bg-white rounded-2xl shadow-xl shadow-fuchsia-900/5 p-6 mb-8 flex flex-col md:flex-row items-center md:items-end gap-6 border border-fuchsia-50">
                    <div className="bg-fuchsia-100 w-32 h-32 rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden shrink-0">
                        {basic_info.avatar_url ? (
                            <img src={basic_info.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-4xl font-black text-fuchsia-400 mix-blend-multiply">
                                {basic_info.name?.charAt(0).toUpperCase()}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 text-center md:text-left mb-2">
                        <h1 className="text-3xl font-bold text-gray-900 mb-1 tracking-tight">{basic_info.name}</h1>
                        <p className="text-fuchsia-600 font-medium flex items-center justify-center md:justify-start gap-2">
                            {basic_info.email}
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider">
                                {basic_info.role}
                            </span>
                        </p>
                    </div>
                    {!isEditing && (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="bg-white hover:bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm hover:shadow active:scale-95"
                        >
                            Edit Profile
                        </button>
                    )}
                </div>

                {/* Main Content Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Sidebar Nav */}
                    <div className="lg:col-span-1 border-r border-gray-100 pr-4">
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
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all text-left whitespace-nowrap ${
                                        activeTab === item.id 
                                            ? 'bg-fuchsia-50 text-fuchsia-700 shadow-sm' 
                                            : 'text-gray-600 hover:bg-gray-50'
                                    }`}
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
                            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-8 border border-gray-100">
                                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">
                                    {isEditing ? 'Edit Profile & Settings' : 'Basic Information'}
                                </h2>

                                {isEditing ? (
                                    <form onSubmit={handleSave} className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                                            <input 
                                                type="text" 
                                                value={editForm.name}
                                                onChange={e => setEditForm(prev => ({...prev, name: e.target.value}))}
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-fuchsia-500 focus:border-transparent outline-none transition-all"
                                                required
                                            />
                                        </div>

                                        <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100">
                                            <h3 className="text-lg font-semibold text-orange-800 mb-4">Preferences</h3>
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <p className="font-medium text-gray-900">Email Notifications</p>
                                                    <p className="text-sm text-gray-500">Receive alerts about courses and quizzes.</p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={editForm.notifications} onChange={e => setEditForm(prev => ({...prev, notifications: e.target.checked}))} className="sr-only peer" />
                                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-fuchsia-600"></div>
                                                </label>
                                            </div>

                                        </div>

                                        <div className="pt-4 flex justify-end gap-3">
                                            <button 
                                                type="button" 
                                                onClick={() => setIsEditing(false)}
                                                className="px-5 py-2.5 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                type="submit" 
                                                disabled={saving}
                                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-semibold shadow-md active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {saving ? 'Saving...' : 'Save Changes'}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="p-4 bg-gray-50 rounded-xl">
                                                <p className="text-sm text-gray-500 font-medium mb-1">Email Address</p>
                                                <p className="text-gray-900 font-semibold">{basic_info.email}</p>
                                            </div>
                                            <div className="p-4 bg-gray-50 rounded-xl">
                                                <p className="text-sm text-gray-500 font-medium mb-1">Account Created</p>
                                                <p className="text-gray-900 font-semibold">{new Date(basic_info.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-8 border-t border-gray-100">
                                            <h3 className="text-lg font-bold tracking-tight text-gray-900 mb-4 flex items-center gap-2">
                                                <Icons.HardDrive /> Storage Usage
                                            </h3>
                                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200/50">
                                                <div className="flex justify-between items-end mb-3">
                                                    <div>
                                                        <span className="text-3xl font-black text-gray-900">{formatBytes(profileData.quota.usedBytes)}</span>
                                                        <span className="text-gray-500 font-bold ml-2">used of {formatBytes(profileData.quota.limitBytes)}</span>
                                                    </div>
                                                    <span className={`text-sm font-black px-3 py-1 rounded-lg ${
                                                        (profileData.quota.usedBytes / profileData.quota.limitBytes) > 0.9 ? 'bg-red-100 text-red-700' :
                                                        (profileData.quota.usedBytes / profileData.quota.limitBytes) > 0.7 ? 'bg-orange-100 text-orange-700' :
                                                        'bg-fuchsia-100 text-fuchsia-700'
                                                    }`}>
                                                        {Math.round((profileData.quota.usedBytes / profileData.quota.limitBytes) * 100)}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                                                    <div 
                                                        className={`h-full rounded-full transition-all duration-1000 shadow-sm ${
                                                            (profileData.quota.usedBytes / profileData.quota.limitBytes) > 0.9 ? 'bg-gradient-to-r from-red-500 to-rose-600' :
                                                            (profileData.quota.usedBytes / profileData.quota.limitBytes) > 0.7 ? 'bg-gradient-to-r from-orange-400 to-amber-500' :
                                                            'bg-gradient-to-r from-fuchsia-500 to-indigo-600'
                                                        }`}
                                                        style={{ width: `${Math.max(2, (profileData.quota.usedBytes / profileData.quota.limitBytes) * 100)}%` }}
                                                    ></div>
                                                </div>
                                                <p className="text-xs text-gray-400 mt-4 font-medium italic">
                                                    * Failed processing attempts do not count against your quota.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-8 pt-8 border-t border-gray-100">
                                            <h3 className="text-lg font-bold tracking-tight text-gray-900 mb-4 flex items-center gap-2">
                                                <Icons.Award /> Achievements
                                            </h3>
                                            <div className="flex flex-wrap gap-3">
                                                {basic_info.achievements?.length > 0 ? basic_info.achievements.map((ach, i) => (
                                                    <span key={i} className="px-4 py-2 bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 rounded-full font-semibold border border-orange-200">
                                                        {ach}
                                                    </span>
                                                )) : (
                                                    <p className="text-gray-500 italic text-sm">No badges earned yet. Keep learning!</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Stats & Analytics */}
                        {activeTab === 'stats' && !isEditing && (
                            <div className="space-y-6">
                                {/* Top Stats */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                                        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Icons.Stats /></div>
                                        <h3 className="text-4xl font-black text-gray-900 mb-1">{stats.total_workspaces}</h3>
                                        <p className="text-gray-500 font-medium tracking-tight">Active Workspaces</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-fuchsia-100/50 flex flex-col items-center justify-center text-center">
                                        <div className="w-12 h-12 bg-fuchsia-100 text-fuchsia-600 rounded-xl flex items-center justify-center mb-4"><Icons.Activity /></div>
                                        <h3 className="text-4xl font-black text-fuchsia-600 mb-1">{stats.total_materials}</h3>
                                        <p className="text-gray-500 font-medium tracking-tight">Total Materials</p>
                                    </div>
                                </div>

                                {/* Subject Readiness List */}
                                <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-8 border border-gray-100">
                                    <h2 className="text-xl font-bold tracking-tight text-gray-900 mb-6 flex items-center gap-2">
                                        <Icons.Award /> Subject Readiness
                                    </h2>
                                    
                                    <div className="space-y-4">
                                        {stats.subject_readiness?.length > 0 ? stats.subject_readiness.map((item, i) => (
                                            <div key={i} className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-gray-900">{item.name}</span>
                                                    <span className={`text-sm font-black ${item.readiness > 70 ? 'text-emerald-600' : 'text-gray-500'}`}>
                                                        {item.readiness}% Ready
                                                    </span>
                                                </div>
                                                <div className="w-full bg-gray-200 rounded-full h-2">
                                                    <div 
                                                        className={`h-2 rounded-full transition-all duration-1000 ${
                                                            item.readiness > 70 ? 'bg-emerald-500' : 
                                                            item.readiness > 40 ? 'bg-orange-400' : 'bg-gray-400'
                                                        }`}
                                                        style={{ width: `${item.readiness === 0 ? 5 : item.readiness}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-8 opacity-50">
                                                <p className="text-sm italic">No subjects enrolled yet.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Analytics Panel */}
                                <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-8 border border-gray-100">
                                    <h2 className="text-xl font-bold tracking-tight text-gray-900 mb-6">Learning Insights</h2>
                                    
                                    <div className="mb-8">
                                        <p className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wider">Learning Status</p>
                                        <p className="text-2xl font-black py-2 px-4 rounded-xl bg-indigo-50 text-indigo-700 inline-block border border-indigo-100">{analytics.learning_status}</p>
                                    </div>

                                    <div className="bg-indigo-50/50 rounded-xl p-6 border border-indigo-100">
                                        <h3 className="font-bold text-indigo-900 mb-3 text-lg">Recommended Next Steps</h3>
                                        <ul className="space-y-3">
                                            {analytics.recommendations.map((rec, i) => (
                                                <li key={i} className="flex items-start gap-3 text-indigo-800">
                                                    <div className="mt-1"><svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg></div>
                                                    <span className="font-medium">{rec}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Activity */}
                        {activeTab === 'activity' && !isEditing && (
                            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-8 border border-gray-100">
                                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Recent Activity</h2>
                                
                                <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                    Uploaded Materials 
                                    <span className="text-xs ml-2 bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{activity.recent_uploads?.length || 0}</span>
                                </h3>
                                <ul className="space-y-4 mb-10">
                                    {activity.recent_uploads?.length > 0 ? activity.recent_uploads.map(item => (
                                        <li key={item.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                            <div>
                                                <p className="font-semibold text-gray-900">{item.title}</p>
                                                <p className="text-sm text-gray-500">{new Date(item.created_at).toLocaleString()}</p>
                                            </div>
                                            <span className="text-xs uppercase font-bold tracking-wider bg-white border border-gray-200 px-3 py-1 rounded-lg text-gray-600">Material</span>
                                        </li>
                                    )) : <li className="text-gray-500 italic p-4">No recent uploads.</li>}
                                </ul>

                                <h3 className="text-lg font-bold text-gray-800 mb-4 pb-2 border-b border-gray-100 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                    AI Interactions
                                    <span className="text-xs ml-2 bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{activity.recent_interactions?.length || 0}</span>
                                </h3>
                                <ul className="space-y-4">
                                    {activity.recent_interactions?.length > 0 ? activity.recent_interactions.map(item => (
                                        <li key={item.id} className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                            <p className="font-semibold text-emerald-900 mb-2">Q: {item.message}</p>
                                            <p className="text-sm text-emerald-700 bg-white/60 p-3 rounded-lg"><span className="font-bold">A:</span> {item.response.length > 100 ? item.response.substring(0, 100) + '...' : item.response}</p>
                                            <p className="text-xs text-emerald-500 mt-2 text-right">{new Date(item.timestamp).toLocaleString()}</p>
                                        </li>
                                    )) : <li className="text-gray-500 italic p-4">No recent chats.</li>}
                                </ul>
                            </div>
                        )}
                        
                        {/* Tab: Settings */}
                        {activeTab === 'settings' && !isEditing && (
                            <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-8 border border-gray-100">
                                 <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-6">Settings & Privacy</h2>
                                 <div className="space-y-6">
                                     <div className="flex justify-between items-center p-5 bg-gray-50 rounded-xl border border-gray-100">
                                         <div>
                                            <p className="font-bold text-gray-900">Email Notifications</p>
                                            <p className="text-sm text-gray-500">Currently: <span className="font-semibold text-fuchsia-600">{settings.notifications ? 'Enabled' : 'Disabled'}</span></p>
                                         </div>
                                         <button onClick={() => { setIsEditing(true); setActiveTab('info'); }} className="text-sm font-semibold bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50 text-gray-700">Change</button>
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
