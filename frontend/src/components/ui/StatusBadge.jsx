import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { COMPLETED, PROCESSING, FAILED, SUCCESS, FAILURE, normalizeStatus } from '@/constants/statusConstants';

const StatusBadge = ({ status }) => {
    const normalized = normalizeStatus(status);

    const getStatusConfig = () => {
        switch (normalized) {
            case COMPLETED:
            case SUCCESS:
                return {
                    label: 'Completed',
                    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                    color: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                    tooltip: 'AI processing is complete. Your material is ready.'
                };
            case PROCESSING:
                return {
                    label: 'Processing',
                    icon: <RefreshCw className="w-3.5 h-3.5 animate-spin-slow" />,
                    color: 'bg-amber-50 text-amber-600 border-amber-100',
                    tooltip: 'AI is currently analyzing, chunking, and embedding this document.'
                };
            case FAILED:
            case FAILURE:
                return {
                    label: 'Failed',
                    icon: <AlertCircle className="w-3.5 h-3.5" />,
                    color: 'bg-red-50 text-red-600 border-red-100',
                    tooltip: 'Something went wrong during processing. Please try again.'
                };
            default:
                return {
                    label: status || 'Pending',
                    icon: <Clock className="w-3.5 h-3.5" />,
                    color: 'bg-gray-50 text-gray-500 border-gray-100',
                    tooltip: 'Waiting for processing to start.'
                };
        }
    };

    const config = getStatusConfig();

    return (
        <div className="group relative inline-block">
            <AnimatePresence mode="wait">
                <motion.span
                    key={normalized}
                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -5 }}
                    layout
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm transition-all duration-500 ${config.color}`}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                    {config.icon}
                    {config.label}
                </motion.span>
            </AnimatePresence>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50 shadow-xl">
                {config.tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
        </div>
    );
};

export default StatusBadge;
