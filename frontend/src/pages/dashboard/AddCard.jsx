import React, { useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { staggerItemBouncy } from '@/utils/motion';

const AddCard = ({ onClick }) => {
    const cardRef = useRef(null);
    const iconRef = useRef(null);
    const prefersReduced = useReducedMotion();

    const handleMouseMove = useCallback((e) => {
        if (prefersReduced || !cardRef.current || !iconRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const dx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const dy = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
        iconRef.current.style.transform = `translate(${dx * 6}px, ${dy * 6}px)`;
        iconRef.current.style.transition = 'transform 0.1s linear';
    }, [prefersReduced]);

    const handleMouseLeave = useCallback(() => {
        if (!iconRef.current) return;
        iconRef.current.style.transform = 'translate(0, 0)';
        iconRef.current.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
    }, []);

    return (
        <motion.button
            ref={cardRef}
            variants={staggerItemBouncy}
            layout
            whileHover={{ y: -2, transition: { type: 'spring', damping: 18, stiffness: 260 } }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="flex flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed transition-all group min-h-[180px]"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-canvas)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-primary)'; e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--c-primary)'; e.currentTarget.style.background = 'var(--c-surface)'; }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--c-border-strong)'; e.currentTarget.style.background = 'var(--c-canvas)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
            <motion.div
                ref={iconRef}
                className="w-12 h-12 rounded-[14px] flex items-center justify-center"
                style={{ background: 'var(--c-primary)', boxShadow: '0 4px 12px rgba(124,92,252,0.3)' }}
                whileHover={{ rotate: 90, scale: 1.1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 200 }}
            >
                <Plus className="w-5 h-5 text-white" />
            </motion.div>
            <span className="text-sm font-semibold tracking-tight text-indigo-600">Create new subject</span>
        </motion.button>
    );
};

export default AddCard;
