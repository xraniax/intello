import React, { useState, useEffect } from 'react';
import { adminService } from '@/features/admin/services/AdminService';
import { File as FileIcon, HardDrive, ShieldCheck, Database, Server, TrendingUp, AlertTriangle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import CustomModal from '@/components/ui/CustomModal';
import FileList from '@/components/Admin/AdminFiles/FileList';
import Skeleton from '@/components/ui/Skeleton';
import { formatBytes } from '@/utils/format';


const AdminFiles = () => {
    const [files, setFiles] = useState([]);
    const [settings, setSettings] = useState(null);
    const [stats, setStats] = useState({ total_storage_bytes: 0 });
    const [loading, setLoading] = useState(true);
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
            setFiles(filesRes.data?.data || []);
            setSettings(settingsRes.data?.data?.storage || {});
            setStats({
                total_storage_bytes: settingsRes.data?.data?.stats?.total_storage_bytes || 0
            });
            // Clear selections when fetching new data
            setSelectedFileIds(new Set());
        } catch (err) {
            toast.error('Failed to load storage data');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (fileId, fileName) => {
        try {
            const response = await adminService.downloadFile(fileId);
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            toast.error('Download failed');
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



    const totalCapacity = settings?.max_cluster_size_bytes
        || (settings?.max_cluster_size_gb ? settings.max_cluster_size_gb * 1073741824 : 10 * 1024 * 1024 * 1024);
    const usedBytes = stats.total_storage_bytes || 0;
    const availableBytes = Math.max(0, totalCapacity - usedBytes);
    const usagePercent = Math.min((usedBytes / totalCapacity) * 100, 100);

    return (
        <div className="relative min-h-[calc(100vh-64px)] p-6 md:p-12 w-full overflow-hidden">
            {/* Ambient Decorative Orbs */}
            <div className="ambient-orb ambient-orb-lg ambient-orb-1 top-[-10%] right-[-5%] bg-sky-200/30"></div>
            <div className="ambient-orb ambient-orb-md ambient-orb-2 bottom-[10%] left-[-5%] bg-blue-200/20"></div>

            <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {/* Header */}
                    <div className="flex justify-between items-start">
                        <div className="group">
                            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-[0.2em] mb-2 text-sky-500">
                                <div className="w-1.5 h-1.5 rounded-full bg-sky-500 anim-pulse"></div>
                                <span>Nexus Storage</span>
                            </div>
                            <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-3">
                                File <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-blue-500">Explorer</span>
                            </h1>
                            <p className="font-medium text-lg text-gray-500/80 max-w-2xl">
                                Audit active uploads, manage storage assets, and scan cluster volumes.
                            </p>
                        </div>
                        <button 
                            onClick={() => fetchData(true)}
                            className="p-4 text-gray-400 hover:text-sky-600 hover:bg-white rounded-[1.5rem] transition-all shadow-sm hover:shadow-md border border-transparent hover:border-gray-100 mt-8"
                            title="Refresh Storage Metrics"
                        >
                            <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-indigo-100/20 group hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500">
                                <Database className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest group-hover:text-indigo-400">Total Capacity</span>
                        </div>
                        <span className="text-4xl font-black text-gray-900 truncate block">
                            {loading ? <Skeleton className="w-20 h-10" /> : formatBytes(totalCapacity)}
                        </span>
                        <div className="mt-6 h-1 w-8 bg-indigo-100 rounded-full group-hover:w-full transition-all duration-700"></div>
                    </div>
                    
                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-orange-100/20 group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500">
                                <Server className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest group-hover:text-orange-400">Cluster Usage</span>
                        </div>
                        <span className="text-4xl font-black text-gray-900 truncate block z-10 relative">
                            {loading ? <Skeleton className="w-24 h-10" /> : formatBytes(usedBytes)}
                        </span>
                        <div className="absolute bottom-0 left-0 h-1.5 w-full bg-gray-50/50">
                            <div className="h-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-1500 ease-out shadow-[0_0_8px_rgba(249,115,22,0.3)]" 
                                 style={{ width: `${usagePercent}%` }}></div>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-[2.5rem] border border-white/50 shadow-xl shadow-emerald-100/20 group hover:-translate-y-1 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                            <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest group-hover:text-emerald-500">Available</span>
                        </div>
                        <span className="text-4xl font-black text-emerald-600 truncate block">
                            {loading ? <Skeleton className="w-24 h-10" /> : formatBytes(availableBytes)}
                        </span>
                        <div className="mt-6 h-1 w-8 bg-emerald-100 rounded-full group-hover:w-full transition-all duration-700"></div>
                    </div>
                </div>

            <div className="animate-in slide-in-from-bottom-4 duration-500 relative">
                <FileList 
                    files={files} 
                    onDelete={handleDeleteFile} 
                    onDownload={handleDownload}
                    filters={filters}
                    setFilters={setFilters}
                    settings={settings}
                    selectedIds={selectedFileIds}
                    setSelectedIds={setSelectedFileIds}
                    onBulkDelete={handleBulkDelete}
                />
            </div>

            <CustomModal
                isOpen={isModalOpen}
                onClose={() => !isActionLoading && setIsModalOpen(false)}
                title={modalConfig.title}
                showFooter={false}
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
        </div>
    );
};

export default AdminFiles;
