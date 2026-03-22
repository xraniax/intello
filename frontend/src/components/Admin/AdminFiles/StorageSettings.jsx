import React, { useState } from 'react';
import { Save, AlertTriangle, FileText, DownloadCloud, HardDrive } from 'lucide-react';

const StorageSettings = ({ settings, stats, onUpdate }) => {
    const [formData, setFormData] = useState(settings || {
        max_file_size_mb: 10,
        allowed_types: ["application/pdf"],
        default_user_quota_mb: 100
    });
    const [saving, setSaving] = useState(false);
    const [newType, setNewType] = useState('');
    const [customType, setCustomType] = useState('');

    const formatBytes = (bytes) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const handleAddType = () => {
        const typeToAdd = newType === 'custom' ? customType.trim() : newType;
        if (typeToAdd && !formData.allowed_types.includes(typeToAdd)) {
            setFormData({ ...formData, allowed_types: [...formData.allowed_types, typeToAdd] });
            setNewType('');
            setCustomType('');
        }
    };
    
    const handleRemoveType = (typeToRemove) => {
        setFormData({ ...formData, allowed_types: formData.allowed_types.filter(t => t !== typeToRemove) });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onUpdate(formData);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <div className="card-minimal border-indigo-50/50">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                        Global Quota configuration
                    </h3>
                    
                    <form onSubmit={handleSubmit} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">
                                    Max Single File Size (MB)
                                </label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        className="input-field pr-12"
                                        value={formData.max_file_size_mb}
                                        onChange={(e) => setFormData({ ...formData, max_file_size_mb: parseInt(e.target.value) })}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs uppercase">MB</div>
                                </div>
                                <p className="text-gray-400 text-[10px] mt-2 ml-1 font-medium">Controls the maximum size of a single PDF upload.</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">
                                    Default User Quota (MB)
                                </label>
                                <div className="relative group">
                                    <input
                                        type="number"
                                        className="input-field pr-12"
                                        value={formData.default_user_quota_mb}
                                        onChange={(e) => setFormData({ ...formData, default_user_quota_mb: parseInt(e.target.value) })}
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs uppercase">MB</div>
                                </div>
                                <p className="text-gray-400 text-[10px] mt-2 ml-1 font-medium">Standard storage limit for all new student accounts.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 ml-1">
                                Allowed MIME Types
                            </label>
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                {formData.allowed_types.map(type => (
                                    <div key={type} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold flex items-center gap-2 border border-indigo-100 group">
                                        {type}
                                        <button type="button" onClick={() => handleRemoveType(type)} className="text-indigo-400 hover:text-red-500 focus:outline-none transition-colors">
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                <div className="flex items-center gap-2">
                                    <select 
                                        className="border border-gray-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300"
                                        value={newType}
                                        onChange={(e) => setNewType(e.target.value)}
                                    >
                                        <option value="">Select MIME Type...</option>
                                        <option value="application/pdf">application/pdf (PDF)</option>
                                        <option value="text/plain">text/plain (TXT)</option>
                                        <option value="text/csv">text/csv (CSV)</option>
                                        <option value="application/msword">application/msword (DOC)</option>
                                        <option value="application/vnd.openxmlformats-officedocument.wordprocessingml.document">application/vnd... (DOCX)</option>
                                        <option value="image/jpeg">image/jpeg (JPEG)</option>
                                        <option value="image/png">image/png (PNG)</option>
                                        <option value="custom">Custom...</option>
                                    </select>
                                    {newType === 'custom' && (
                                        <input 
                                            type="text" 
                                            className="border border-gray-200 rounded-lg py-1.5 px-3 text-xs w-36 font-medium focus:outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-300 transition-all" 
                                            placeholder="e.g. text/html" 
                                            value={customType}
                                            onChange={(e) => setCustomType(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddType();
                                                }
                                            }}
                                        />
                                    )}
                                    <button 
                                        type="button" 
                                        onClick={handleAddType} 
                                        disabled={!newType || (newType === 'custom' && !customType)}
                                        className="px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg text-xs font-bold border border-gray-100 hover:bg-white hover:text-indigo-500 hover:border-indigo-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        + Add
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-4">
                                <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                                <p className="text-orange-700 text-xs font-medium leading-relaxed">
                                    <strong>Caution:</strong> The AI Engine is currently optimized for PDF processing. Enabling other formats without engine updates may result in extraction failures.
                                </p>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-gray-50 flex justify-end">
                            <button
                                type="submit"
                                className="btn-vibrant px-8 py-3 text-sm flex items-center gap-2"
                                disabled={saving}
                            >
                                <Save className="w-4 h-4" />
                                {saving ? 'Applying...' : 'Apply System Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="space-y-6">
                <div className="card-minimal bg-indigo-50/30 border-indigo-100/50 p-6">
                    <h4 className="text-indigo-900 font-bold flex items-center gap-2 mb-4">
                        <DownloadCloud className="w-5 h-5" />
                        Storage Insights
                    </h4>
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-bold text-indigo-600/70 uppercase tracking-wider">Health Status</span>
                            <span className="text-sm font-black text-indigo-900">Optimal</span>
                        </div>
                        <div className="w-full bg-indigo-100 rounded-full h-2">
                            <div 
                                className="bg-indigo-500 h-2 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.3)] transition-all duration-1000"
                                style={{ width: `${Math.max(1, Math.min(100, ((stats?.total_storage_bytes || 0) / (10 * 1024 * 1024 * 1024)) * 100))}%` }}
                            ></div>
                        </div>
                        <p className="text-[10px] text-indigo-600/60 font-medium leading-relaxed">
                            System is currently utilizing {formatBytes(stats?.total_storage_bytes || 0)} of total cluster capacity (assumed 10GB). All nodes responding.
                        </p>
                    </div>
                </div>

                <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <h4 className="text-gray-900 font-bold text-sm mb-4">Admin Tip</h4>
                    <p className="text-xs text-gray-500 font-medium leading-relaxed">
                        You can override individual user limits in the <strong>User Management</strong> section if a student requires additional research space.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StorageSettings;
