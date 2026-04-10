import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { File as FileIcon, HardDrive, ShieldCheck, Database, Server, TrendingUp, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomModal from '@/components/ui/CustomModal';
import StorageSettings from '@/components/Admin/AdminFiles/StorageSettings';
import FileList from '@/components/Admin/AdminFiles/FileList';
import Skeleton from '@/components/ui/Skeleton';

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const AdminFiles = () => {
    const [files, setFiles] = useState([]);
    const [settings, setSettings] = useState(null);
    const [stats, setStats] = useState({ total_storage_bytes: 0 });
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('files');
    const [filters, setFilters] = useState({ userId: '', subjectId: '', mimeType: '', minSizeMb: '', sortBy: 'created_at', order: 'desc' });
    
    // Bulk Selection State
    const [selectedFileIds, setSelectedFileIds] = useState(new Set());
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    // Simple Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    useEffect(() => {
        const debounce = setTimeout(() => {
            fetchData(!settings);
        }, 300);
        return () => clearTimeout(debounce);
    }, [filters]);

    const fetchData = async (showSpinner = true) => {
        if (showSpinner) setLoading(true);
        try {
            const [filesRes, settingsRes] = await Promise.all([
                adminService.getFiles(filters),
                adminService.getSettings()
            ]);
            setFiles(filesRes.data.data);
            setSettings(settingsRes.data.data.storage);
            setStats({
                // Ensure we capture total sum strictly from global stats
                total_storage_bytes: settingsRes.data.data.stats.total_storage_bytes || 0
            });
            // Clear selections when fetching new data
            setSelectedFileIds(new Set());
        } catch (err) {
            toast.error('Failed to load storage data');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteFile = (fileId, fileName) => {
        setModalConfig({
            title: 'Delete File?',
            message: `Are you sure you want to permanently delete "${fileName}"? This will remove the original source and cannot be undone.`,
            type: 'warning',
            confirmText: 'Delete Permanently',
            onConfirm: async () => {
                try {
                    await adminService.deleteFile(fileId);
                    toast.success('File deleted');
                    fetchData(false);
                } catch (err) {
                    toast.error(err.message || 'Failed to delete file');
                } finally {
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    };

    const handleBulkDelete = () => {
        if (selectedFileIds.size === 0) return;
        setModalConfig({
            title: `Delete ${selectedFileIds.size} Files?`,
            message: `Are you sure you want to permanently delete these ${selectedFileIds.size} files? This action is highly destructive and cannot be undone.`,
            type: 'warning',
            confirmText: 'Delete All Checked',
            onConfirm: async () => {
                setIsActionLoading(true);
                try {
                    // Execute parallel deletions
                    const ids = Array.from(selectedFileIds);
                    await Promise.all(ids.map(id => adminService.deleteFile(id)));
                    toast.success(`Successfully deleted ${ids.length} files`);
                    fetchData(false);
                } catch (err) {
                    toast.error('Partial failure during bulk delete');
                    fetchData(false); // Reload whatever is left
                } finally {
                    setIsActionLoading(false);
                    setIsModalOpen(false);
                }
            }
        });
        setIsModalOpen(true);
    };

    const handleUpdateSettings = async (newSettings) => {
        try {
            await adminService.updateSettings({ storage: newSettings });
            toast.success('System limits updated');
            setSettings(newSettings);
        } catch (err) {
            toast.error('Failed to update settings');
        }
    };

    const totalCapacity = 10 * 1024 * 1024 * 1024; // Visual mock: 10GB total cluster cap if not provided
    const usedBytes = stats.total_storage_bytes || 0;
    const availableBytes = Math.max(0, totalCapacity - usedBytes);
    const usagePercent = Math.min((usedBytes / totalCapacity) * 100, 100);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div className="group">
                    <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs uppercase tracking-[0.2em] mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 anim-pulse"></div>
                        <span>Admin Console</span>
                    </div>
                    <h1 className="text-5xl font-black text-gray-900 tracking-tight lg:tracking-tighter mb-2">
                        Storage <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 drop-shadow-sm">Management</span>
                    </h1>
                    <p className="text-gray-500 font-medium text-lg mt-2">Audit active uploads, monitor resource limits, and free up space.</p>
                </div>
            </div>

            {/* Metrics KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10">
                <div className="card-minimal flex flex-col justify-between group">
                    <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4 text-indigo-400" />
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest group-hover:text-indigo-400 transition-colors">Total Capacity</span>
                    </div>
                    <span className="text-3xl font-black text-gray-900 truncate">
                        {loading ? <Skeleton className="w-20 h-8" /> : formatBytes(totalCapacity)}
                    </span>
                </div>
                
                <div className="card-minimal relative overflow-hidden flex flex-col justify-between group">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                            <Server className="w-4 h-4 text-orange-400" />
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest group-hover:text-orange-400 transition-colors">Physical Storage Used</span>
                        </div>
                    </div>
                    <span className="text-3xl font-black text-gray-900 truncate z-10 block pb-3">
                        {loading ? <Skeleton className="w-24 h-8 inline-block" /> : formatBytes(usedBytes)}
                    </span>
                    <div className="absolute bottom-0 left-0 h-1.5 w-full bg-gray-50">
                        <div className="h-full bg-orange-400 transition-all duration-1000" style={{ width: `${usagePercent}%` }}></div>
                    </div>
                </div>

                <div className="card-minimal flex flex-col justify-between group">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="w-4 h-4 text-mint-500" />
                        <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest group-hover:text-mint-500 transition-colors">Available Space</span>
                    </div>
                    <span className="text-3xl font-black text-mint-600 truncate">
                        {loading ? <Skeleton className="w-24 h-8" /> : formatBytes(availableBytes)}
                    </span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center bg-gray-100 p-1.5 rounded-2xl border border-gray-200 w-max mb-6 shadow-inner">
                <button
                    onClick={() => setActiveTab('files')}
                    className={`px-8 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'files' ? 'bg-white text-gray-900 shadow-md shadow-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <FileIcon className="w-4 h-4" />
                    File Explorer
                </button>
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-8 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'settings' ? 'bg-white text-gray-900 shadow-md shadow-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    <ShieldCheck className="w-4 h-4" />
                    System Rules
                </button>
            </div>

            {loading ? (
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-20 flex flex-col items-center justify-center animate-pulse">
                    <div className="w-16 h-16 border-4 border-indigo-50 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                    <h3 className="text-xl font-black text-gray-900 mb-2">Scanning Cluster Volumes</h3>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Synchronizing metrics...</p>
                </div>
            ) : (
                <div className="animate-in slide-in-from-bottom-4 duration-500 relative">
                    {activeTab === 'files' ? (
                        <FileList 
                            files={files} 
                            onDelete={handleDeleteFile} 
                            filters={filters}
                            setFilters={setFilters}
                            settings={settings}
                            selectedIds={selectedFileIds}
                            setSelectedIds={setSelectedFileIds}
                            onBulkDelete={handleBulkDelete}
                        />
                    ) : (
                        <StorageSettings 
                            settings={settings} 
                            stats={stats}
                            onUpdate={handleUpdateSettings} 
                        />
                    )}
                </div>
            )}

            <CustomModal
                isOpen={isModalOpen}
                onClose={() => !isActionLoading && setIsModalOpen(false)}
                title={modalConfig.title}
            >
                <div className="p-6 text-center">
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-6 mx-auto bg-red-50 text-red-600 border border-red-100">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <p className="text-gray-600 font-medium mb-8">
                        {modalConfig.message}
                    </p>
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setIsModalOpen(false)}
                            disabled={isActionLoading}
                            className="flex-1 py-4 font-bold text-gray-500 bg-white rounded-2xl hover:bg-gray-50 transition-all border border-gray-200"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={modalConfig.onConfirm}
                            disabled={isActionLoading}
                            className={`flex-1 py-4 font-bold text-white rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 shadow-red-200 ${isActionLoading ? 'opacity-70 pointer-events-none' : ''}`}
                        >
                            {isActionLoading ? 'Processing...' : modalConfig.confirmText}
                        </button>
                    </div>
                </div>
            </CustomModal>
        </div>
    );
};

export default AdminFiles;
