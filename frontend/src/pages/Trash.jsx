import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MaterialService } from '@/services/MaterialService';
import { Trash2, RotateCcw, File as FileIcon, ArrowLeft, AlertTriangle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

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
                    className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider text-white transition-all hover:scale-[1.02] active:scale-[0.98] ${danger ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100' : 'bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-100'}`}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

const Trash = () => {
    const navigate = useNavigate();
    const [trashItems, setTrashItems]         = useState([]);
    const [loading, setLoading]               = useState(true);
    const [actionId, setActionId]             = useState(null); // id of item being acted on
    const [emptyingTrash, setEmptyingTrash]   = useState(false);
    const [modal, setModal]                   = useState(null); // { type: 'item'|'all', id?, title? }

    useEffect(() => { fetchTrash(); }, []);

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

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-10 animate-in fade-in duration-500">

            {/* Back */}
            <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all shadow-sm mb-8"
            >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
            </button>

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-10">
                <div>
                    <div className="flex items-center gap-2 text-red-500 font-bold text-[11px] uppercase tracking-[0.2em] mb-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        System Archive
                    </div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                        My <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-500">Trash</span>
                    </h1>
                    <p className="text-gray-400 font-medium mt-1.5 text-sm">
                        Deleted materials — restore them or remove them permanently.
                    </p>
                </div>

                {trashItems.length > 0 && (
                    <button
                        onClick={() => setModal({ type: 'all' })}
                        disabled={emptyingTrash}
                        className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-red-50 text-red-600 border border-red-100 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all shadow-sm disabled:opacity-50 shrink-0"
                    >
                        {emptyingTrash ? (
                            <div className="w-4 h-4 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4" />
                        )}
                        Empty Trash
                    </button>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-20 flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-red-100 border-t-red-500 rounded-full animate-spin mb-5" />
                    <p className="text-sm font-black text-gray-500 uppercase tracking-widest">Loading…</p>
                </div>
            ) : trashItems.length === 0 ? (
                <div className="w-full py-28 bg-white border border-dashed border-gray-200 rounded-3xl text-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 mx-auto mb-5 border border-gray-100">
                        <Trash2 className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-gray-700 mb-1.5">Trash is empty</h3>
                    <p className="text-sm text-gray-400 font-medium">Deleted materials will appear here.</p>
                </div>
            ) : (
                <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[680px]">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/60">
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Material</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Subject</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Deleted</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {trashItems.map((item) => {
                                    const busy = actionId === item.id;
                                    return (
                                        <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-400 flex items-center justify-center border border-red-100 shrink-0">
                                                        <FileIcon className="w-5 h-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-gray-800 truncate">{item.title}</p>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.type}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center gap-1.5">
                                                    <div className="w-2 h-2 rounded-full bg-purple-300 shrink-0" />
                                                    <span className="text-xs font-bold text-gray-600 truncate max-w-[120px]">
                                                        {item.subject_name || 'Imported'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <p className="text-xs font-bold text-gray-500">
                                                    {item.deleted_at ? format(new Date(item.deleted_at), 'MMM dd, yyyy') : '—'}
                                                </p>
                                                <p className="text-[10px] text-gray-400">
                                                    {item.deleted_at ? format(new Date(item.deleted_at), 'HH:mm') : ''}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                    <button
                                                        onClick={() => handleRestore(item.id, item.title)}
                                                        disabled={busy}
                                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-40"
                                                    >
                                                        {busy ? <div className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                                        Restore
                                                    </button>
                                                    <button
                                                        onClick={() => setModal({ type: 'item', id: item.id, title: item.title })}
                                                        disabled={busy}
                                                        className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 text-red-500 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all disabled:opacity-40"
                                                    >
                                                        <X className="w-3 h-3" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-6 py-3 border-t border-gray-50 bg-gray-50/30">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
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
