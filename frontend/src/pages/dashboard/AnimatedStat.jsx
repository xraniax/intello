import React from 'react';
import { motion } from 'framer-motion';
import { useCountUp } from '@/hooks/useCountUp';

const AnimatedStat = ({ value, label, icon: Icon, color, bg }) => {
    const displayed = useCountUp(value, 800);
    return (
        <div className="flex flex-col gap-3 p-4 rounded-2xl relative overflow-hidden group hover-lift" style={{ background: 'var(--c-surface)', border: `1px solid ${bg}`, boxShadow: 'var(--shadow-xs)' }}>
            <div className="absolute top-0 right-0 -mr-4 -mt-4 w-20 h-20 rounded-full opacity-0 group-hover:opacity-20 pointer-events-none transition-opacity duration-500" style={{ background: bg }} />
            <div className="flex justify-between items-start">
                <span className="text-[11px] font-bold uppercase tracking-wider relative z-10" style={{ color: 'var(--c-text-muted)' }}>{label}</span>
                <div className="p-1.5 rounded-[10px] relative z-10" style={{ background: bg }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                </div>
            </div>
            <motion.span
                key={value}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 18, stiffness: 220 }}
                className="text-[28px] font-black leading-none font-serif tracking-tight relative z-10"
                style={{ color: 'var(--c-text)' }}
            >
                {displayed}
            </motion.span>
        </div>
    );
};

export default AnimatedStat;
