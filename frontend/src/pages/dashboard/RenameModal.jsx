import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit3 } from 'lucide-react';

const RenameModal = ({ target, onClose, onSave }) => {
    const [name, setName] = useState(target?.name || '');
    const [desc, setDesc] = useState(target?.description || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await onSave(name.trim(), desc.trim());
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {target && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50"
                        style={{ background: 'rgba(13,11,30,0.5)', backdropFilter: 'blur(8px)' }}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="bg-white rounded-3xl p-6 w-full max-w-sm pointer-events-auto"
                            style={{ boxShadow: 'var(--shadow-2xl)' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-2 mb-5">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--c-primary-ultra)', color: 'var(--c-primary)' }}>
                                    <Edit3 className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-[15px]" style={{ color: 'var(--c-text)' }}>Edit Subject</span>
                            </div>
                            <div className="space-y-3 mb-6">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Subject Name</label>
                                    <input
                                        autoFocus
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                                        className="input-field w-full"
                                        placeholder="Subject name…"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5 block">Description</label>
                                    <textarea
                                        value={desc}
                                        onChange={e => setDesc(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                                        className="input-field w-full min-h-[80px] py-3 text-sm leading-relaxed resize-none custom-scrollbar"
                                        placeholder="Add a short description…"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button onClick={onClose} className="btn btn-sm btn-outline">Cancel</button>
                                <motion.button
                                    whileTap={{ scale: 0.93 }}
                                    onClick={handleSave}
                                    disabled={!name.trim() || saving}
                                    className="btn btn-sm btn-solid"
                                >
                                    {saving ? 'Saving…' : 'Save'}
                                </motion.button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

export default RenameModal;
