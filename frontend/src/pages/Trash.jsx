import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialService } from '@/services/MaterialService';
import { Trash2, RotateCcw, File as FileIcon, ArrowLeft, AlertTriangle, X, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, differenceInDays, differenceInHours } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getExpiryInfo(expiresAt) {
    if (!expiresAt) return null;
    const now = new Date();
    const exp = new Date(expiresAt);
    const daysLeft = differenceInDays(exp, now);
    const hoursLeft = differenceInHours(exp, now);

    if (hoursLeft <= 0) return { label: 'Expired', urgent: true, critical: true, pct: 100 };
    if (daysLeft < 1)   return { label: `${hoursLeft}h left`, urgent: true, critical: true, pct: 95 };
    if (daysLeft <= 3)  return { label: `${daysLeft}d left`, urgent: true, critical: false, pct: 85 };
    if (daysLeft <= 7)  return { label: `${daysLeft}d left`, urgent: false, critical: false, pct: 60 };
    return { label: `${daysLeft}d left`, urgent: false, critical: false, pct: 30 };
}

// ─── Confirmation modal ───────────────────────────────────────────────────────

const ConfirmModal = ({ title, message, confirmLabel, onConfirm, onCancel, danger = true }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${danger ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center mb-2">{title}</h3>
            <p className="text-sm text-gray-500 font-medium text-center mb-7 leading-relaxed">{message}</p>
            <div className="flex flex-col gap-2.5">
                <button
                    onClick={onConfirm}
                    className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider text-white transition-all hover:scale-[1.02] active:scale-[0.98] ${danger ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200' : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200'}`}
                >
                    {confirmLabel}
                </button>
                <button
                    onClick={onCancel}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                    Cancel
                </button>
            </div>
        </div>
    </div>
);

// ─── Expiry badge ─────────────────────────────────────────────────────────────

const ExpiryBadge = ({ expiresAt }) => {
    const info = getExpiryInfo(expiresAt);
    if (!info) return null;

    const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all';
    const color = info.critical
        ? 'bg-red-50 text-red-600 border border-red-100 shadow-sm'
        : info.urgent
        ? 'bg-amber-50 text-amber-600 border border-amber-100'
        : 'bg-indigo-50 text-indigo-600 border border-indigo-100';

    return (
        <span className={`${base} ${color}`}>
            <Clock className="w-3 h-3" />
            {info.label}
        </span>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const Trash = () => {
    const navigate = useNavigate();
    const [trashItems, setTrashItems]         = useState([]);
    const [ttlDays, setTtlDays]               = useState(30);
    const [loading, setLoading]               = useState(true);
    const [actionId, setActionId]             = useState(null);
    const [emptyingTrash, setEmptyingTrash]   = useState(false);
    const [modal, setModal]                   = useState(null);

    useEffect(() => {
        fetchSettings();
        fetchTrash();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await MaterialService.getSettings();
            if (res.data?.data?.trash_ttl_days) {
                setTtlDays(res.data.data.trash_ttl_days);
            }
        } catch { /* non-critical */ }
    };

    const fetchTrash = async () => {
        setLoading(true);
        try {
            const res = await MaterialService.getTrash();
            setTrashItems(res.data.data);
        } catch {
            toast.error('Failed to load trash');
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (id, title) => {
        setActionId(id);
        try {
            await MaterialService.restore(id);
            toast.success(`"${title}" restored`);
            setTrashItems(prev => prev.filter(i => i.id !== id));
        } catch {
            toast.error('Failed to restore');
        } finally {
            setActionId(null);
        }
    };

    const handlePermanentDelete = async () => {
        const { id, title } = modal;
        setModal(null);
        setActionId(id);
        try {
            await MaterialService.permanentDelete(id);
            toast.success(`"${title}" permanently deleted`);
            setTrashItems(prev => prev.filter(i => i.id !== id));
        } catch {
            toast.error('Failed to delete');
        } finally {
            setActionId(null);
        }
    };

    const handleEmptyTrash = async () => {
        setModal(null);
        setEmptyingTrash(true);
        try {
            const res = await MaterialService.emptyTrash();
            toast.success(res.data.message || 'Trash emptied');
            setTrashItems([]);
        } catch {
            toast.error('Failed to empty trash');
        } finally {
            setEmptyingTrash(false);
        }
    };

    const urgentCount = trashItems.filter(i => {
        const info = getExpiryInfo(i.expires_at);
        return info?.urgent;
    }).length;

    return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-10 animate-in fade-in duration-500">

            {/* Back */}
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all shadow-sm mb-8 active:scale-95"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
            </button>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-10">
                <div>
                    <div className="flex items-center gap-2 text-rose-500 font-bold text-[11px] uppercase tracking-[0.2em] mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        System Archive
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight">
                        My <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-orange-500 drop-shadow-sm">Trash</span>
                    </h1>
                    <p className="text-gray-400 font-medium mt-2 text-sm max-w-sm leading-relaxed">
                        Materials are permanently deleted after{' '}
                        <span className="font-bold text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded-md border border-gray-100">{ttlDays} days</span> in trash.
                    </p>
                </div>

                {trashItems.length > 0 && (
                    <button
                        onClick={() => setModal({ type: 'all' })}
                        disabled={emptyingTrash}
                        className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm bg-white text-rose-600 border border-rose-100 shadow-[0_2px_10px_-3px_rgba(225,29,72,0.1)] hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all disabled:opacity-50 shrink-0 hover:-translate-y-0.5 active:scale-95"
                    >
                        {emptyingTrash ? (
                            <div className="w-4 h-4 border-2 border-rose-300 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        Empty Trash
                    </button>
                )}
            </div>

            {/* Urgent warning banner */}
            <AnimatePresence>
                {urgentCount > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                        animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-amber-50 to-amber-100/50 border border-amber-200 rounded-2xl text-amber-800 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-200/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                            <Clock className="w-5 h-5 shrink-0 text-amber-500" />
                            <p className="text-sm font-bold">
                                {urgentCount} item{urgentCount !== 1 ? 's' : ''} will be permanently deleted soon — restore them now if you need them.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            {loading ? (
                <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-24 flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-rose-100 border-t-rose-500 rounded-full animate-spin mb-5" />
                    <p className="text-sm font-black text-gray-400 uppercase tracking-widest">Scanning Archive</p>
                </div>
            ) : trashItems.length === 0 ? (
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full py-28 bg-white border border-gray-100 rounded-[2rem] text-center shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col items-center"
                >
                    <div className="relative mb-8 group">
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-100/50 to-transparent blur-2xl rounded-full scale-150 transition-transform group-hover:scale-[1.7] duration-500" />
                        <div className="relative w-24 h-24 bg-gradient-to-br from-white to-gray-50 border border-gray-100 shadow-xl shadow-gray-200/50 rounded-[2rem] flex items-center justify-center text-gray-300 transition-transform group-hover:-translate-y-2 duration-500">
                            <Trash2 className="w-10 h-10 drop-shadow-sm" />
                        </div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 tracking-tight mb-2">Trash is completely empty</h3>
                    <p className="text-sm text-gray-400 font-bold max-w-[260px] leading-relaxed">
                        Nothing to see here right now. Deleted items will be stored here temporarily.
                    </p>
                </motion.div>
            ) : (
                <motion.div 
                    layout
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
                >
                    <AnimatePresence>
                        {trashItems.map((item) => {
                            const busy = actionId === item.id;
                            const expInfo = getExpiryInfo(item.expires_at);
                            const rowUrgent = expInfo?.critical;

                            return (
                                <motion.div
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
                                    transition={{ duration: 0.25 }}
                                    key={item.id}
                                    className={`relative group bg-white border rounded-3xl p-5 flex flex-col transition-all duration-300 ${
                                        rowUrgent 
                                        ? 'border-red-100 shadow-[0_8px_20px_-6px_rgba(239,68,68,0.1)] hover:border-red-200 hover:shadow-[0_8px_25px_-4px_rgba(239,68,68,0.15)]' 
                                        : 'border-gray-100 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.03)] hover:border-gray-200 hover:shadow-[0_12px_25px_-4px_rgba(0,0,0,0.05)]'
                                    } hover:-translate-y-1.5`}
                                >
                                    {/* Card Header: Icon and Expiry */}
                                    <div className="flex items-start justify-between mb-5">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-transform group-hover:scale-105 duration-300 ${
                                            rowUrgent 
                                            ? 'bg-gradient-to-br from-red-50 to-red-100/50 text-red-500 border-red-100' 
                                            : 'bg-gradient-to-br from-gray-50 to-gray-100/50 text-gray-500 border-gray-100'
                                        }`}>
                                            <FileIcon className="w-5 h-5" />
                                        </div>
                                        {item.expires_at && <ExpiryBadge expiresAt={item.expires_at} />}
                                    </div>
                                    
                                    {/* Card Content: Title and Subject */}
                                    <div className="flex-1 min-h-0 mb-6">
                                        <h3 className="text-[17px] font-black text-gray-800 mb-2 line-clamp-2 leading-snug" title={item.title}>
                                            {item.title}
                                        </h3>
                                        <div className="flex flex-wrap text-sm gap-2 mt-auto">
                                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-50/80 border border-gray-100 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest text-nowrap shrink-0">
                                                {item.type}
                                            </span>
                                            {item.subject_name && (
                                                <span className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/50 border border-indigo-50 rounded-lg text-[10px] font-black text-indigo-500 uppercase tracking-widest truncate max-w-full">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                                    <span className="truncate">{item.subject_name}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Card Footer: Actions */}
                                    <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Deleted At</span>
                                            <span className="text-[11px] font-bold text-gray-600">
                                                {item.deleted_at ? format(new Date(item.deleted_at), 'MMM dd, yyyy') : '—'}
                                            </span>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setModal({ type: 'item', id: item.id, title: item.title })}
                                                disabled={busy}
                                                className="w-10 h-10 rounded-xl bg-white border border-gray-100 text-gray-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 hover:border-rose-100 transition-all disabled:opacity-40 shadow-sm"
                                                title="Delete Forever"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleRestore(item.id, item.title)}
                                                disabled={busy}
                                                className="flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-indigo-500 text-white font-bold text-xs shadow-[0_4px_12px_-4px_rgba(99,102,241,0.4)] hover:bg-indigo-600 hover:shadow-[0_6px_15px_-4px_rgba(99,102,241,0.5)] transition-all disabled:opacity-40 flex-1 hover:-translate-y-0.5"
                                            >
                                                {busy ? (
                                                    <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-white rounded-full animate-spin shrink-0" />
                                                ) : (
                                                    <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                                )}
                                                Restore
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* Global Context Footer */}
            {trashItems.length > 0 && !loading && (
                <div className="mt-8 relative py-4 flex flex-col sm:flex-row items-center justify-center gap-4 animate-in fade-in fill-mode-both delay-300">
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-gray-100/60 border-dashed" />
                    </div>
                    <div className="relative px-6 bg-gray-50 flex items-center gap-3">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-3 py-1 bg-white rounded-full border border-gray-100 shadow-sm">
                            {trashItems.length} item{trashItems.length !== 1 ? 's' : ''} in trash
                        </p>
                    </div>
                </div>
            )}

            {/* Confirmation modals */}
            {modal?.type === 'item' && (
                <ConfirmModal
                    title="Delete permanently?"
                    message={`"${modal.title}" will be gone forever. This cannot be undone.`}
                    confirmLabel="Delete Forever"
                    onConfirm={handlePermanentDelete}
                    onCancel={() => setModal(null)}
                />
            )}
            {modal?.type === 'all' && (
                <ConfirmModal
                    title="Empty entire trash?"
                    message="All trashed materials will be permanently deleted. This cannot be undone."
                    confirmLabel="Empty Trash"
                    onConfirm={handleEmptyTrash}
                    onCancel={() => setModal(null)}
                />
            )}
        </div>
    );
};

export default Trash;
