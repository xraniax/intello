import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Layers, Clock, MoreHorizontal, ChevronRight, Edit3, Trash2 } from 'lucide-react';
import { staggerItemBouncy, popIn } from '@/utils/motion';
import { useTilt } from '@/hooks/useTilt';
import { accentFor, timeSince } from './dashboardUtils';

const SubjectCard = React.memo(({ subject, onDelete, onRename }) => {
    const navigate  = useNavigate();
    const accent    = accentFor(subject.id);
    const [menu, setMenu] = useState(false);
    const menuRef   = useRef(null);
    const since     = timeSince(subject.last_activity_at || subject.updated_at);
    const { ref: tiltRef, onMouseMove, onMouseLeave } = useTilt(7, 200);

    useEffect(() => {
        if (!menu) return;
        const h = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, [menu]);

    return (
        <motion.div
            ref={tiltRef}
            variants={staggerItemBouncy}
            layout
            className="group relative flex flex-col rounded-[24px] overflow-hidden cursor-pointer transition-all duration-300"
            style={{
                background: 'white',
                border: `2px solid ${accent.hex}15`,
                boxShadow: `0 4px 12px rgba(0,0,0,0.05)`,
                transformStyle: 'preserve-3d',
                willChange: 'transform',
            }}
            onMouseMove={onMouseMove}
            onMouseLeave={(e) => {
                onMouseLeave(e);
                e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,0.05)`;
                e.currentTarget.style.borderColor = `${accent.hex}15`;
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 12px 32px ${accent.hex}20`;
                e.currentTarget.style.borderColor = `${accent.hex}40`;
            }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate(`/subjects/${subject.id}`)}
        >
            {/* Clean top accent bar */}
            <div className="h-1 w-full flex-shrink-0" style={{ background: accent.bg }} />

            <div className="flex flex-col flex-1 p-5 gap-4">
                <div className="flex items-start justify-between gap-2">
                    <motion.div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: accent.light }}
                        whileHover={{
                            rotate: [0, -10, 10, 0],
                            scale: 1.1,
                        }}
                    >
                        <BookOpen className="w-5 h-5" style={{ color: accent.text }} />
                    </motion.div>

                    <div ref={menuRef} className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <motion.button
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => setMenu(v => !v)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                            style={{ color: 'var(--c-text-muted)', background: 'var(--c-surface-alt)' }}
                        >
                            <MoreHorizontal className="w-4 h-4" />
                        </motion.button>
                        <AnimatePresence>
                            {menu && (
                                <motion.div
                                    {...popIn}
                                    className="absolute right-0 top-9 z-20 w-40 rounded-2xl overflow-hidden py-1"
                                    style={{
                                        background: 'var(--c-surface)',
                                        border: '1.5px solid var(--c-border)',
                                        boxShadow: 'var(--shadow-xl)',
                                    }}
                                >
                                    <button
                                        onClick={() => { onRename(subject); setMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-left transition-colors"
                                        style={{ color: 'var(--c-text)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-surface-alt)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Edit3 className="w-3.5 h-3.5" style={{ color: 'var(--c-primary)' }} />
                                        Rename
                                    </button>
                                    <button
                                        onClick={() => { onDelete(subject.id); setMenu(false); }}
                                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] font-medium text-left transition-colors"
                                        style={{ color: 'var(--c-danger)' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'var(--c-danger-light)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Delete
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <h3
                        className="font-bold text-[18px] leading-tight mb-2 truncate tracking-tight"
                        style={{ color: 'var(--c-text)' }}
                    >
                        {subject.name}
                    </h3>
                    {subject.description && (
                        <p className="text-[13px] line-clamp-2 leading-relaxed opacity-70" style={{ color: 'var(--c-text-secondary)' }}>
                            {subject.description}
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <div
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                        style={{ background: accent.light, color: accent.text }}
                    >
                        <Layers className="w-3 h-3" />
                        {subject.material_count ?? 0} items
                    </div>
                    {since && (
                        <div className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--c-text-placeholder)' }}>
                            <Clock className="w-3 h-3" />
                            {since}
                        </div>
                    )}
                </div>
            </div>

            <motion.div
                className="absolute bottom-4 right-4 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: accent.bg, boxShadow: `0 4px 12px ${accent.hex}40` }}
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
                <ChevronRight className="w-3.5 h-3.5 text-white" />
            </motion.div>
        </motion.div>
    );
});
SubjectCard.displayName = 'SubjectCard';

export default SubjectCard;
