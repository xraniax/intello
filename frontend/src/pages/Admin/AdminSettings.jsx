import React, { useState, useEffect } from 'react';
import { adminService } from '../../services/api';
import { Settings as SettingsIcon, Save, ShieldCheck, HardDrive, RefreshCw, AlertCircle, FileType } from 'lucide-react';
import toast from 'react-hot-toast';

const AdminSettings = () => {
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form inputs state
    const [maxUserSizeMb, setMaxUserSizeMb] = useState('');
    const [maxClusterSizeGb, setMaxClusterSizeGb] = useState('');
    const [allowedTypes, setAllowedTypes] = useState('');

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await adminService.getSettings();
            const config = res.data.data.storage;
            setSettings(config);
            // Pre-fill inputs
            setMaxUserSizeMb(config.default_user_quota_mb || '');
            setMaxClusterSizeGb(config.max_cluster_size_bytes ? Math.round(config.max_cluster_size_bytes / (1024*1024*1024)) : '');
            setAllowedTypes(config.allowed_types ? config.allowed_types.join(', ') : '');
        } catch (err) {
            toast.error('Failed to load system settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                storage: {
                    default_user_quota_mb: parseInt(maxUserSizeMb) || undefined,
                    max_cluster_size_bytes: maxClusterSizeGb ? parseInt(maxClusterSizeGb) * 1024 * 1024 * 1024 : undefined,
                    allowed_types: allowedTypes ? allowedTypes.split(',').map(t => t.trim()).filter(Boolean) : undefined
                }
            };
            await adminService.updateSettings(payload);
            toast.success('System configuration strictly updated.');
            fetchSettings();
        } catch (err) {
            toast.error('Failed to save settings: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight lg:tracking-tighter mb-2">System Directives</h1>
                    <p className="text-gray-500 font-medium">Configure global security boundaries, volume limits, and access rules.</p>
                </div>
                <button 
                    onClick={fetchSettings} 
                    className="flex items-center justify-center gap-2 p-3 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
                    title="Refresh Config"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {loading ? (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 p-20 text-center shadow-sm">
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm animate-pulse">Initializing Policy Core...</p>
                </div>
            ) : (
                <form onSubmit={handleSave} className="space-y-6">
                    {/* File Upload Boundaries */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <div className="p-6 md:p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
                                    <HardDrive className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-black text-gray-900">Volume Directives</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                                        Default User Quota (MB)
                                    </label>
                                    <div className="relative group">
                                        <input 
                                            type="number" 
                                            value={maxUserSizeMb}
                                            onChange={(e) => setMaxUserSizeMb(e.target.value)}
                                            className="w-full bg-gray-50 focus:bg-white border border-transparent focus:border-indigo-400 text-gray-900 font-bold rounded-xl px-4 py-3 outline-none transition-all shadow-sm focus:ring-4 focus:ring-indigo-100"
                                            placeholder="e.g. 50"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 select-none">MB</div>
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400">If a user doesn't have a specific quota, this limit restricts their total uploaded data.</p>
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest">
                                        Cluster Capacity Ceiling (GB)
                                    </label>
                                    <div className="relative group">
                                        <input 
                                            type="number" 
                                            value={maxClusterSizeGb}
                                            onChange={(e) => setMaxClusterSizeGb(e.target.value)}
                                            className="w-full bg-gray-50 focus:bg-white border border-transparent focus:border-indigo-400 text-gray-900 font-bold rounded-xl px-4 py-3 outline-none transition-all shadow-sm focus:ring-4 focus:ring-indigo-100"
                                            placeholder="e.g. 100"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 select-none">GB</div>
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-400">Global maximum allowable upload volume for the entire platform.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Security & Access */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-orange-400"></div>
                        <div className="p-6 md:p-8">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-black text-gray-900">Security Gateways</h2>
                            </div>
                            
                            <div className="space-y-3">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <FileType className="w-4 h-4" /> Allowed MIME Types
                                </label>
                                <textarea 
                                    value={allowedTypes}
                                    onChange={(e) => setAllowedTypes(e.target.value)}
                                    className="w-full bg-gray-50 focus:bg-white border border-transparent focus:border-orange-400 text-gray-900 font-bold rounded-xl px-4 py-3 outline-none transition-all shadow-sm focus:ring-4 focus:ring-orange-100 font-mono text-sm leading-relaxed"
                                    placeholder="application/pdf, text/plain..."
                                    rows="4"
                                />
                                <div className="bg-orange-50 border border-orange-100 text-orange-700 px-4 py-3 rounded-xl flex items-start gap-3 mt-4">
                                    <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                                    <p className="text-xs font-semibold">Separate MIME types explicitly by commas. Do not input file extensions (e.g., input <code className="bg-white px-1 py-0.5 rounded shadow-sm text-orange-900">application/pdf</code> instead of <code className="bg-white px-1 py-0.5 rounded shadow-sm text-orange-900">.pdf</code>).</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="flex justify-end pt-4">
                        <button 
                            type="submit"
                            disabled={saving}
                            className={`px-8 py-3.5 bg-gray-900 text-white font-bold text-sm rounded-xl hover:bg-black transition-colors shadow-2xl shadow-gray-300 flex items-center gap-3 active:scale-95 ${saving ? 'opacity-70 pointer-events-none' : ''}`}
                        >
                            {saving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Enforce Directives
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

export default AdminSettings;
