import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Sparkles, PanelLeftClose, FileText, CheckCircle2, Lock, Layers, BrainCircuit, ChevronDown, Edit2, Upload } from 'lucide-react';
import { PROCESSING, normalizeStatus } from '@/constants/statusConstants';
import StatusBadge from '@/components/ui/StatusBadge';
import { requireAuth } from '@/utils/requireAuth';
import { useAuthStore } from '@/store/useAuthStore';

const SectionHeader = ({ label, count, isOpen, onToggle, styleObj = {} }) => (
    <button
        onClick={onToggle}
        className="flex items-center justify-between w-full mb-3 px-2 py-1 text-[10px] font-black uppercase tracking-[0.2em] group transition-all"
    >
        <div className="flex items-center gap-2">
            <motion.div
                animate={{ rotate: isOpen ? 0 : -90 }}
                transition={{ duration: 0.2, type: 'spring', stiffness: 300 }}
            >
                <ChevronDown className="w-4 h-4 group-hover:opacity-80 transition-opacity" style={{ color: styleObj.iconColor || 'var(--c-primary)' }} />
            </motion.div>
            <span style={{ color: styleObj.textColor || 'var(--c-text-muted)' }}>{label}</span>
        </div>
        <span className="py-1 px-2.5 rounded-full text-[10px] font-black border" style={{ background: styleObj.badgeBg || 'var(--c-surface-alt)', color: styleObj.badgeColor || 'var(--c-text-muted)', borderColor: 'rgba(0,0,0,0.05)' }}>{count}</span>
    </button>
);

const FilePanel = ({
    materials,
    selectedMaterials,
    toggleSelection,
    onDelete,
    onRename,
    onGenerate,
    onOpenUpload,
    onCollapse,
    isPublic
}) => {
    const user = useAuthStore((state) => state.data.user);
    const [uploadsOpen, setUploadsOpen] = useState(() => {
        const saved = localStorage.getItem('cognify_panel_uploads_open');
        return saved !== null ? JSON.parse(saved) : true;
    });
    const [generatedOpen, setGeneratedOpen] = useState(() => {
        const saved = localStorage.getItem('cognify_panel_generated_open');
        return saved !== null ? JSON.parse(saved) : true;
    });

    useEffect(() => {
        localStorage.setItem('cognify_panel_uploads_open', JSON.stringify(uploadsOpen));
    }, [uploadsOpen]);

    useEffect(() => {
        localStorage.setItem('cognify_panel_generated_open', JSON.stringify(generatedOpen));
    }, [generatedOpen]);

    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState("");
    const editInputRef = useRef(null);

    useEffect(() => {
        if (editingId && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const startRename = (e, m) => {
        e.stopPropagation();
        setEditingId(m.id);
        setEditValue(m.title || m.type.replace('_', ' '));
    };

    const commitRename = () => {
        if (editingId && editValue.trim() !== "") {
            onRename(editingId, editValue);
        }
        setEditingId(null);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            commitRename();
        } else if (e.key === 'Escape') {
            setEditingId(null);
        }
    };

    const uploads = materials.filter(m => m.type === 'upload');
    const generated = materials.filter(m => m.type !== 'upload');

    return (
        <div className="panel-inner h-full flex flex-col" style={{ background: 'var(--c-canvas)' }}>
            {/* Panel Header */}
            <div className="panel-header flex-shrink-0 px-6 py-5 bg-white/80 backdrop-blur-md sticky top-0 z-10 transition-all border-b-2 border-indigo-50 shadow-sm">
                <div className="flex items-center justify-between w-full">
                    <span className="panel-title font-black uppercase tracking-[0.2em] text-[10px] text-gray-400">Subject Materials</span>
                    <button
                        onClick={onCollapse}
                        className="p-2 rounded-2xl transition-all hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 hover:scale-110 active:scale-90"
                        title="Hide panel"
                    >
                        <PanelLeftClose className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Quick Upload Action */}
            <div className="px-5 py-5 border-b-2 border-indigo-50/50 bg-indigo-50/20">
                <button
                    className="w-full py-6 px-4 bg-white border-4 border-white rounded-[2rem] flex flex-col items-center justify-center gap-1 group transition-all duration-300 shadow-sm hover:shadow-xl hover:shadow-purple-900/5 hover:-translate-y-1 active:scale-95"
                    onClick={() => requireAuth(onOpenUpload)}
                >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform bg-gradient-to-br from-purple-100 to-indigo-100 text-purple-600 shadow-inner">
                        {(isPublic && !user) ? <Lock className="w-6 h-6" /> : <Upload className="w-6 h-6" />}
                    </div>
                    <span className="text-xs font-black uppercase tracking-[0.2em] mt-3 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Upload Source</span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1 opacity-60">Add PDF or Text Content</span>
                </button>
            </div>

            {/* Document List (Scrollable Area) */}
            <div className="panel-body flex-1 overflow-y-auto min-h-0 pt-4 space-y-2">

                {/* Uploads Section */}
                <div className="file-list px-4 pt-2">
                    <SectionHeader
                        label="Uploads"
                        count={uploads.length}
                        isOpen={uploadsOpen}
                        onToggle={() => setUploadsOpen(o => !o)}
                    />

                    <AnimatePresence initial={false}>
                        {uploadsOpen && (
                            <motion.div
                                key="uploads-body"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.22, ease: 'easeInOut' }}
                                style={{ overflow: 'hidden' }}
                            >
                                {uploads.length === 0 ? (
                                    <div className="text-center p-4 border border-dashed rounded-xl mb-2" style={{ borderColor: 'var(--c-border)', background: 'var(--c-surface-alt)' }}>
                                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-text-muted)' }}>No Source Files</p>
                                    </div>
                                ) : (
                                    <AnimatePresence initial={false}>
                                        {uploads.map((m, index) => {
                                            const isProcessing = normalizeStatus(m.status) === PROCESSING;
                                            const isSelected = selectedMaterials.includes(m.id);
                                            const isNew = m.created_at && (Date.now() - new Date(m.created_at).getTime() < 15000);

                                            return (
                                                <motion.div
                                                    key={m.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className={`group relative p-5 transition-all duration-300 cursor-pointer mb-4 flex items-start gap-4 rounded-[2rem] border-4 ${isNew
                                                        ? 'border-purple-400 shadow-lg shadow-purple-200'
                                                        : isSelected
                                                            ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-900/5'
                                                            : isProcessing
                                                                ? 'cursor-wait opacity-80 border-transparent bg-gray-50'
                                                                : 'border-white bg-white hover:border-purple-200 hover:shadow-xl hover:shadow-purple-900/5 hover:-translate-y-1'
                                                        }`}
                                                    onClick={() => !isProcessing && window.dispatchEvent(new CustomEvent('open-material', { detail: { id: m.id, type: m.type } }))}
                                                >
                                                    <div
                                                        className={`mt-1 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer hover:scale-110 z-10`}
                                                        style={{
                                                            background: isSelected ? 'var(--c-primary)' : 'var(--c-surface-alt)',
                                                            color: isSelected ? 'white' : 'var(--c-text-muted)'
                                                        }}
                                                        onClick={(e) => { e.stopPropagation(); !isProcessing && toggleSelection(m.id); }}
                                                        title={isSelected ? "Deselect for Generation" : "Select for Generation"}
                                                    >
                                                        {isSelected ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-50" />}
                                                    </div>
                                                    <div className="min-w-0 flex-grow">
                                                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                            {editingId === m.id ? (
                                                                <input
                                                                    ref={editInputRef}
                                                                    value={editValue}
                                                                    onChange={e => setEditValue(e.target.value)}
                                                                    onBlur={commitRename}
                                                                    onKeyDown={handleKeyDown}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className="text-sm font-bold border-b-2 focus:outline-none bg-transparent w-full"
                                                                    style={{ color: 'var(--c-text)', borderColor: 'var(--c-primary)' }}
                                                                />
                                                            ) : (
                                                                <h4 className={`text-sm font-bold truncate`} style={{ color: isSelected ? 'var(--c-primary)' : 'var(--c-text)' }}>{m.title}</h4>
                                                            )}
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                {isNew && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white animate-pulse" style={{ background: 'var(--c-primary)' }}>New</span>}
                                                                <StatusBadge status={m.status} />
                                                            </div>
                                                        </div>
                                                        <p className="text-[9px] uppercase font-black tracking-widest mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--c-primary)' }}>
                                                            Opens in Document Tab
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[10px] font-medium flex items-center gap-1" style={{ color: 'var(--c-text-muted)' }}>
                                                                {new Date(m.created_at).toLocaleDateString()}
                                                            </span>
                                                            <div className="flex gap-2 transition-all ml-auto">
                                                                {!isProcessing && (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); requireAuth(() => onGenerate(m.id)); }}
                                                                        className="p-1.5 hover:bg-white rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                                        style={{ color: 'var(--c-primary)' }}
                                                                        title={(isPublic && !user) ? 'Login required' : 'Generate Insight'}
                                                                    >
                                                                        {(isPublic && !user) ? <Lock className="w-3.5 h-3.5 opacity-50" /> : <Sparkles className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); requireAuth(() => onDelete(m.id, m.title)); }}
                                                                    className={`p-1.5 hover:text-red-500 hover:bg-white rounded-lg transition-all ${isProcessing ? 'opacity-40' : 'opacity-0 group-hover:opacity-100'}`}
                                                                    style={{ color: 'var(--c-text-muted)' }}
                                                                    title={(isPublic && !user) ? 'Login required' : 'Delete'}
                                                                >
                                                                    {(isPublic && !user) ? <Lock className="w-3.5 h-3.5 opacity-50" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { requireAuth(() => startRename(e, m)); }}
                                                                    className={`p-1.5 hover:bg-white rounded-lg transition-all ${isProcessing ? 'opacity-40' : 'opacity-0 group-hover:opacity-100'}`}
                                                                    style={{ color: 'var(--c-text-muted)' }}
                                                                    title={(isPublic && !user) ? 'Login required' : 'Rename'}
                                                                >
                                                                    {(isPublic && !user) ? <Lock className="w-3.5 h-3.5 opacity-50" /> : <Edit2 className="w-3.5 h-3.5" />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Generated Materials Section */}
                <div className="file-list px-4 pb-6 mt-4">
                    <SectionHeader
                        label="Generated Materials"
                        count={generated.length}
                        isOpen={generatedOpen}
                        onToggle={() => setGeneratedOpen(o => !o)}
                        styleObj={{
                            iconColor: 'var(--c-accent)',
                            textColor: 'var(--c-accent)',
                            badgeBg: 'var(--c-accent-light)',
                            badgeColor: 'var(--c-accent)'
                        }}
                    />

                    <AnimatePresence initial={false}>
                        {generatedOpen && (
                            <motion.div
                                key="generated-body"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.22, ease: 'easeInOut' }}
                                style={{ overflow: 'hidden' }}
                            >
                                {generated.length === 0 ? (
                                    <div className="text-center p-6 border border-dashed rounded-[1.25rem] mb-2" style={{ borderColor: 'rgba(6, 182, 212, 0.2)', background: 'var(--c-accent-light)' }}>
                                        <Sparkles className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--c-accent)' }} />
                                        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--c-accent)' }}>No AI Insights Yet</p>
                                    </div>
                                ) : (
                                    <AnimatePresence initial={false}>
                                        {generated.map((m, index) => {
                                            const isProcessing = normalizeStatus(m.status) === PROCESSING;
                                            const isNew = m.created_at && (Date.now() - new Date(m.created_at).getTime() < 15000);

                                            const TYPE_CONFIG = {
                                                'summary': { icon: FileText, color: 'var(--c-accent)', bg: 'var(--c-accent-light)', borderColor: 'rgba(6, 182, 212, 0.2)' },
                                                'quiz': { icon: CheckCircle2, color: 'var(--c-success)', bg: 'var(--c-success-light)', borderColor: 'rgba(34, 197, 94, 0.2)' },
                                                'flashcards': { icon: Layers, color: 'var(--c-primary)', bg: 'var(--c-primary-light)', borderColor: 'rgba(124, 92, 252, 0.2)' },
                                                'exam': { icon: BrainCircuit, color: 'var(--c-warning)', bg: 'var(--c-warning-light)', borderColor: 'rgba(245, 158, 11, 0.2)' },
                                            };

                                            const config = TYPE_CONFIG[m.type] || { icon: Sparkles, color: 'var(--c-text-secondary)', bg: 'var(--c-surface-alt)', borderColor: 'var(--c-border)' };
                                            const Icon = config.icon;

                                            return (
                                                <motion.div
                                                    key={m.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
                                                    exit={{ opacity: 0, height: 0 }}
                                                    className={`group relative border transition-all duration-300 cursor-pointer mb-3 flex items-start gap-3 rounded-[1.25rem] p-4 hover:shadow-md ${isNew ? 'ring-1' : ''}`}
                                                    style={{ 
                                                        background: 'var(--c-surface)', 
                                                        borderColor: isNew ? config.color : config.borderColor,
                                                        boxShadow: isNew ? `0 0 15px ${config.borderColor}` : 'var(--shadow-sm)'
                                                    }}
                                                    onClick={() => !isProcessing && window.dispatchEvent(new CustomEvent('open-material', { detail: { id: m.id, type: m.type } }))}
                                                >
                                                    <div className={`mt-1 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all`} style={{ background: config.bg, color: config.color }}>
                                                        <Icon className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-grow">
                                                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                                                            {editingId === m.id ? (
                                                                <input
                                                                    ref={editInputRef}
                                                                    value={editValue}
                                                                    onChange={e => setEditValue(e.target.value)}
                                                                    onBlur={commitRename}
                                                                    onKeyDown={handleKeyDown}
                                                                    onClick={e => e.stopPropagation()}
                                                                    className={`text-sm font-bold border-b-2 focus:outline-none bg-transparent w-full`}
                                                                    style={{ color: 'var(--c-text)', borderColor: config.color }}
                                                                />
                                                            ) : (
                                                                <h4 className={`text-sm font-bold truncate capitalize`} style={{ color: 'var(--c-text)' }}>
                                                                    {m.title || m.type.replace('_', ' ')}
                                                                </h4>
                                                            )}
                                                            <div className="flex items-center gap-2">
                                                                {isNew && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white animate-pulse" style={{ background: config.color }}>New</span>}
                                                                <StatusBadge status={m.status} />
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center justify-between mt-1">
                                                            <p className={`text-[9px] uppercase font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity`} style={{ color: config.color }}>
                                                                Open {m.type.replace('_', ' ')}
                                                            </p>
                                                            <span className="text-[10px] opacity-40 font-medium whitespace-nowrap" style={{ color: 'var(--c-text-muted)' }}>
                                                                {new Date(m.created_at).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                        <div className="flex gap-2 transition-all ml-auto mt-2 justify-end">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); requireAuth(() => onDelete(m.id, m.title)); }}
                                                                className={`p-1.5 hover:text-red-500 hover:bg-white rounded-lg transition-all ${isProcessing ? 'opacity-40' : 'opacity-0 group-hover:opacity-100'}`}
                                                                style={{ color: 'var(--c-text-muted)' }}
                                                                title={(isPublic && !user) ? 'Login required' : 'Delete'}
                                                            >
                                                                {(isPublic && !user) ? <Lock className="w-3.5 h-3.5 opacity-50" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                            </button>
                                                            <button
                                                                onClick={(e) => { requireAuth(() => startRename(e, m)); }}
                                                                className={`p-1.5 hover:bg-white rounded-lg transition-all ${isProcessing ? 'opacity-40' : 'opacity-0 group-hover:opacity-100'}`}
                                                                style={{ color: 'var(--c-text-muted)' }}
                                                                title={(isPublic && !user) ? 'Login required' : 'Rename'}
                                                            >
                                                                {(isPublic && !user) ? <Lock className="w-3.5 h-3.5 opacity-50" /> : <Edit2 className="w-3.5 h-3.5" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* System Trash Shortcut - Fixed at bottom */}
            <div className="px-4 py-3 border-t flex-shrink-0" style={{ borderColor: 'var(--c-border-soft)', background: 'var(--c-surface-alt)' }}>
                <button
                    onClick={() => window.location.href = '/trash'}
                    className="w-full py-3 px-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] hover:text-red-500 hover:bg-red-50/50 rounded-xl transition-all duration-300 group"
                    style={{ color: 'var(--c-text-muted)' }}
                >
                    <Trash2 className="w-3.5 h-3.5 group-hover:animate-bounce transition-colors" />
                    <span>View System Trash</span>
                </button>
            </div>
        </div>
    );
};

export default FilePanel;
