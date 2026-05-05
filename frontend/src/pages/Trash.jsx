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
        <div className="relative min-h-screen w-full bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 px-4 py-10 sm:px-6 md:px-8 animate-in fade-in duration-500 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-80">
                <div className="absolute -left-28 top-24 h-56 w-56 rounded-full bg-rose-300/25 blur-3xl" />
                <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-indigo-300/20 blur-3xl" />
                <div className="absolute left-1/2 top-[18rem] h-72 w-72 -translate-x-1/2 rounded-full bg-amber-200/20 blur-3xl" />
                <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-slate-200/70 to-transparent" />
            </div>

            <div className="relative mx-auto flex w-full max-w-[1920px] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between mb-10">
                <div className="space-y-5 rounded-[2rem] border border-slate-200/80 bg-white/80 p-6 shadow-[0_30px_60px_-40px_rgba(15,23,42,0.36)] backdrop-blur-xl">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-indigo-700 hover:shadow-md active:scale-95"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to dashboard
                    </button>

                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.24em] text-rose-700 shadow-sm shadow-rose-100/70">
                            <span className="inline-flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                            System archive
                        </div>
                        <div className="space-y-3">
                            <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900">
                                <span className="bg-gradient-to-r from-rose-500 via-fuchsia-500 to-indigo-600 bg-clip-text text-transparent">Trash</span>
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-slate-600">
                                Deleted materials remain in trash for{' '}
                                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-900 border border-slate-200">
                                    {ttlDays} days
                                </span>{' '}
                                before permanent removal.
                            </p>
                        </div>
                    </div>
                </div>

                {trashItems.length > 0 && (
                    <div className="flex flex-col gap-3 sm:items-end">
                        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
                            {trashItems.length} item{trashItems.length !== 1 ? 's' : ''} in trash
                        </div>
                        <button
                            onClick={() => setModal({ type: 'all' })}
                            disabled={emptyingTrash}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-rose-600 border border-rose-100 shadow-sm transition hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
                        >
                            {emptyingTrash ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-rose-300 border-t-transparent" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                            Empty trash
                        </button>
                    </div>
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
                        <div className="relative overflow-hidden rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-amber-100 to-rose-50/90 px-5 py-4 shadow-sm">
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-amber-200/40 blur-3xl" />
                            <div className="relative flex items-center gap-3 text-amber-900">
                                <Clock className="h-5 w-5 shrink-0 text-amber-700" />
                                <p className="text-sm font-semibold leading-6">
                                    {urgentCount} item{urgentCount !== 1 ? 's' : ''} will be permanently deleted soon — restore them now if you need them.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content */}
            {loading ? (
                <div className="rounded-[2rem] border border-slate-200 bg-white p-24 text-center shadow-sm">
                    <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-rose-500" />
                    <p className="text-sm font-black uppercase tracking-[0.28em] text-slate-400">Scanning archive</p>
                </div>
            ) : trashItems.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-rose-50 p-20 text-center shadow-sm"
                >
                    <div className="relative mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-slate-200 bg-slate-50 text-rose-500 shadow-inner">
                        <Trash2 className="h-11 w-11" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Trash is empty</h3>
                    <p className="mx-auto max-w-[26rem] text-sm leading-7 text-slate-600">
                        There is nothing in trash right now. Deleted items will appear here for a limited time before they are permanently removed.
                    </p>
                </motion.div>
            ) : (
                <motion.div layout className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                                    exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
                                    transition={{ duration: 0.25 }}
                                    key={item.id}
                                    className={`group relative flex flex-col overflow-hidden rounded-3xl border bg-white p-5 transition duration-300 ${
                                        rowUrgent
                                            ? 'border-rose-100 shadow-[0_10px_30px_-15px_rgba(239,68,68,0.18)] hover:border-rose-200'
                                            : 'border-slate-200 shadow-[0_8px_24px_-16px_rgba(15,23,42,0.08)] hover:border-slate-300'
                                    } hover:-translate-y-1.5`}
                                >
                                    <div className="flex items-start justify-between gap-3 mb-5">
                                        <div className={`flex h-12 w-12 items-center justify-center rounded-3xl border shadow-sm transition ${
                                            rowUrgent
                                                ? 'border-rose-100 bg-red-50 text-rose-500'
                                                : 'border-slate-200 bg-slate-50 text-slate-500'
                                        }`}>
                                            <FileIcon className="h-5 w-5" />
                                        </div>
                                        {item.expires_at && <ExpiryBadge expiresAt={item.expires_at} />}
                                    </div>

                                    <div className="flex-1 min-h-0 mb-6">
                                        <h3 className="line-clamp-2 text-[17px] font-black leading-tight text-slate-900" title={item.title}>
                                            {item.title}
                                        </h3>
                                        <div className="mt-4 flex flex-wrap gap-2 text-sm">
                                            <span className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                                                {item.type}
                                            </span>
                                            {item.subject_name && (
                                                <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-2xl border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-indigo-600">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                                                    <span className="truncate">{item.subject_name}</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-400">Deleted at</p>
                                            <p className="text-sm font-semibold text-slate-700">
                                                {item.deleted_at ? format(new Date(item.deleted_at), 'MMM dd, yyyy') : '—'}
                                            </p>
                                        </div>
                                        <div className="flex w-full gap-2 sm:w-auto">
                                            <button
                                                onClick={() => setModal({ type: 'item', id: item.id, title: item.title })}
                                                disabled={busy}
                                                title="Delete forever"
                                                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleRestore(item.id, item.title)}
                                                disabled={busy}
                                                className="inline-flex min-w-[110px] items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-xs font-bold uppercase tracking-[0.18em] text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                                            >
                                                {busy ? (
                                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-indigo-200 border-t-white" />
                                                ) : (
                                                    <RotateCcw className="h-3.5 w-3.5" />
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
                <div className="mt-8 relative py-4">
                    <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200/80" aria-hidden="true" />
                    <div className="relative mx-auto inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 shadow-sm">
                        {trashItems.length} item{trashItems.length !== 1 ? 's' : ''} in trash
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
