import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Sparkles, PanelLeftClose, FileText, CheckCircle2, Lock, Layers, BrainCircuit } from 'lucide-react';
import { PROCESSING, normalizeStatus } from '@/constants/statusConstants';
import StatusBadge from '@/components/ui/StatusBadge';
import { requireAuth } from '@/utils/requireAuth';
import { useAuthStore } from '@/store/useAuthStore';

const FilePanel = ({
    materials,
    selectedMaterials,
    toggleSelection,
    onDelete,
    onGenerate,
    onOpenUpload,
    onCollapse,
    isPublic
}) => {
    const user = useAuthStore((state) => state.data.user);

    return (
        <div className="panel-inner h-full flex flex-col">
            {/* Panel Header */}
            <div className="panel-header flex-shrink-0 glass-panel sticky top-0 z-10 transition-all border-b border-gray-100/50 shadow-sm">
                <div className="flex items-center justify-between w-full">
                    <span className="panel-title font-black uppercase tracking-[0.1em] text-gray-900">Subject Materials</span>
                </div>

                <button
                    onClick={onCollapse}
                    className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Hide panel"
                >
                    <PanelLeftClose className="w-4 h-4" />
                </button>
            </div>

            {/* Quick Upload Action */}
            <div className="px-4 py-4 border-b border-gray-100 bg-gray-50/30">
                <button
                    className="w-full py-4 px-4 bg-white border-2 border-dashed border-indigo-100 rounded-2xl flex flex-col items-center justify-center gap-1 group hover:border-indigo-400 hover:bg-indigo-50/50 transition-all duration-300 shadow-sm hover:shadow-md"
                    onClick={() => requireAuth(onOpenUpload)}
                >
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                        {(isPublic && !user) ? <Lock className="w-5 h-5 text-indigo-400" /> : <Sparkles className="w-5 h-5 text-indigo-500" />}
                    </div>
                    <span className="text-xs font-black text-indigo-600 uppercase tracking-widest mt-1">Grow Your Space</span>
                    <span className="text-[10px] text-gray-400 font-medium">Add PDF or Text Source</span>
                </button>
            </div>

            {/* Document List (Scrollable Area) */}
            <div className="panel-body flex-1 overflow-y-auto min-h-0 pt-2 space-y-6">

                {/* Uploads Section */}
                <div className="file-list px-4">
                    <div className="flex items-center justify-between mb-3 px-1 text-xs font-black uppercase tracking-widest text-gray-400">
                        <span>Uploads</span>
                        <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full">{materials.filter(m => m.type === 'upload').length}</span>
                    </div>

                    {materials.filter(m => m.type === 'upload').length === 0 ? (
                        <div className="text-center p-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No Source Files</p>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {materials.filter(m => m.type === 'upload').map((m, index) => {
                                const isProcessing = normalizeStatus(m.status) === PROCESSING;
                                const isSelected = selectedMaterials.includes(m.id);
                                const isNew = m.created_at && (Date.now() - new Date(m.created_at).getTime() < 15000);

                                return (
                                    <motion.div
                                        key={m.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{
                                            opacity: 1,
                                            y: 0,
                                            transition: { delay: index * 0.05 }
                                        }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className={`group relative bg-white border rounded-2xl p-4 transition-all duration-300 cursor-pointer mb-3 flex items-start gap-3 ${isNew
                                                ? 'border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] ring-1 ring-indigo-400'
                                                : isSelected
                                                    ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/10'
                                                    : isProcessing
                                                        ? 'border-indigo-200 bg-indigo-50/10 cursor-wait opacity-80'
                                                        : 'border-gray-100 hover:border-indigo-200 hover:shadow-md'
                                            }`}
                                        onClick={() => !isProcessing && window.dispatchEvent(new CustomEvent('open-material', { detail: { id: m.id, type: m.type } }))}
                                    >
                                        <div
                                            className={`mt-1 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer hover:scale-110 z-10 ${isSelected ? 'bg-indigo-500 text-white shadow-md shadow-indigo-200' : 'bg-gray-100 hover:bg-indigo-100 text-gray-500 hover:text-indigo-500'
                                                }`}
                                            onClick={(e) => { e.stopPropagation(); !isProcessing && toggleSelection(m.id); }}
                                            title={isSelected ? "Deselect for Generation" : "Select for Generation"}
                                        >
                                            {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-50" />}
                                        </div>
                                        <div className="min-w-0 flex-grow">
                                            <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                <h4 className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-gray-700'}`}>
                                                    {m.title}
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    {isNew && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-indigo-500 text-white animate-pulse">New</span>}
                                                    <StatusBadge status={m.status} />
                                                </div>
                                            </div>
                                            <p className="text-[9px] text-indigo-400 uppercase font-black tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                Opens in Document Tab
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                                    {new Date(m.created_at).toLocaleDateString()}
                                                </span>
                                                <div className="flex gap-2 transition-all ml-auto">
                                                    {!isProcessing && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); requireAuth(() => onGenerate(m.id)); }}
                                                            className="p-1.5 text-indigo-500 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                            title={(isPublic && !user) ? 'Login required' : 'Generate Insight'}
                                                        >
                                                            {(isPublic && !user) ? <Lock className="w-3.5 h-3.5 opacity-50" /> : <Sparkles className="w-3.5 h-3.5" />}
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); requireAuth(() => onDelete(m.id, m.title)); }}
                                                        className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-all ${isProcessing ? 'opacity-40' : 'opacity-0 group-hover:opacity-100'}`}
                                                        title={(isPublic && !user) ? 'Login required' : 'Delete'}
                                                    >
                                                        {(isPublic && !user) ? <Lock className="w-3.5 h-3.5 opacity-50" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>

                {/* Generated Materials Section */}
                <div className="file-list px-4 pb-6">
                    <div className="flex items-center justify-between mb-3 px-1 text-xs font-black uppercase tracking-widest text-purple-400">
                        <span>Generated Materials</span>
                        <span className="bg-purple-50 text-purple-500 py-0.5 px-2 rounded-full">{materials.filter(m => m.type !== 'upload').length}</span>
                    </div>

                    {materials.filter(m => m.type !== 'upload').length === 0 ? (
                        <div className="text-center p-6 border border-dashed border-purple-100 rounded-xl bg-purple-50/30">
                            <Sparkles className="w-6 h-6 text-purple-300 mx-auto mb-2" />
                            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">No AI Insights Yet</p>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {materials.filter(m => m.type !== 'upload').map((m, index) => {
                                const isProcessing = normalizeStatus(m.status) === PROCESSING;
                                const isNew = m.created_at && (Date.now() - new Date(m.created_at).getTime() < 15000);

                                const TYPE_CONFIG = {
                                    'summary': { color: 'indigo', icon: FileText, bg: 'bg-indigo-50/40', border: 'border-indigo-100', iconBg: 'bg-indigo-100', iconText: 'text-indigo-600', text: 'text-indigo-900', hoverBorder: 'hover:border-indigo-300', shadow: 'hover:shadow-indigo-100/50' },
                                    'quiz': { color: 'emerald', icon: CheckCircle2, bg: 'bg-emerald-50/40', border: 'border-emerald-100', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', text: 'text-emerald-900', hoverBorder: 'hover:border-emerald-300', shadow: 'hover:shadow-emerald-100/50' },
                                    'flashcards': { color: 'purple', icon: Layers, bg: 'bg-purple-50/40', border: 'border-purple-100', iconBg: 'bg-purple-100', iconText: 'text-purple-600', text: 'text-purple-900', hoverBorder: 'hover:border-purple-300', shadow: 'hover:shadow-purple-100/50' },
                                    'exam': { color: 'amber', icon: BrainCircuit, bg: 'bg-amber-50/40', border: 'border-amber-100', iconBg: 'bg-amber-100', iconText: 'text-amber-600', text: 'text-amber-900', hoverBorder: 'hover:border-amber-300', shadow: 'hover:shadow-amber-100/50' },
                                };

                                const config = TYPE_CONFIG[m.type] || { color: 'gray', icon: Sparkles, bg: 'bg-gray-50/40', border: 'border-gray-100', iconBg: 'bg-gray-100', iconText: 'text-gray-600', text: 'text-gray-900', hoverBorder: 'hover:border-gray-300', shadow: 'hover:shadow-gray-100/50' };
                                const Icon = config.icon;

                                return (
                                    <motion.div
                                        key={m.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{
                                            opacity: 1,
                                            y: 0,
                                            transition: { delay: index * 0.05 }
                                        }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className={`group relative border transition-all duration-300 cursor-pointer mb-3 flex items-start gap-3 rounded-2xl p-4 ${config.bg} ${config.border} ${config.hoverBorder} hover:shadow-md ${config.shadow} ${isNew
                                                ? 'shadow-[0_0_15px_rgba(168,85,247,0.3)] ring-1 ring-purple-400'
                                                : ''
                                            }`}
                                        onClick={() => !isProcessing && window.dispatchEvent(new CustomEvent('open-material', { detail: { id: m.id, type: m.type } }))}
                                    >
                                        <div className={`mt-1 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${config.iconBg} ${config.iconText}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-grow">
                                            <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                <h4 className={`text-sm font-bold truncate capitalize ${config.text}`}>
                                                    {m.title || m.type.replace('_', ' ')}
                                                </h4>
                                                <div className="flex items-center gap-2">
                                                    {isNew && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest bg-purple-500 text-white animate-pulse">New</span>}
                                                    <StatusBadge status={m.status} />
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between mt-1">
                                                <p className={`text-[9px] uppercase font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity ${config.iconText}`}>
                                                    Open {m.type.replace('_', ' ')}
                                                </p>
                                                <span className="text-[10px] opacity-40 font-medium whitespace-nowrap">
                                                    {new Date(m.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 transition-all ml-auto mt-2 justify-end">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); requireAuth(() => onDelete(m.id, m.title)); }}
                                                    className={`p-1.5 text-gray-400 hover:text-red-500 hover:bg-white rounded-lg transition-all ${isProcessing ? 'opacity-40' : 'opacity-0 group-hover:opacity-100'}`}
                                                    title={(isPublic && !user) ? 'Login required' : 'Delete'}
                                                >
                                                    {(isPublic && !user) ? <Lock className="w-3.5 h-3.5 opacity-50" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    )}
                </div>

            </div>
        </div>
    );
};

export default FilePanel;
