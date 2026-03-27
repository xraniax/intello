import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const JobProgress = ({ job }) => {
    if (!job) return null;

    const { stage, progress, message } = job;
    const isError = stage === 'failed';
    const isSuccess = stage === 'success';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="fixed bottom-8 right-8 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-indigo-50 p-5 overflow-hidden"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        {isError ? (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        ) : isSuccess ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : (
                            <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                        )}
                        <span className="text-xs font-black uppercase tracking-widest text-gray-400">
                            {stage || 'Processing'}
                        </span>
                    </div>
                    <span className="text-sm font-black text-indigo-600">{progress}%</span>
                </div>

                <h4 className="text-sm font-bold text-gray-900 mb-3 leading-tight">{message}</h4>

                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                            isError ? 'bg-red-500' : isSuccess ? 'bg-emerald-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                        }`}
                    ></motion.div>
                </div>

                {/* Subtle Background Glow */}
                <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-50 rounded-full blur-3xl opacity-50 -z-10"></div>
            </motion.div>
        </AnimatePresence>
    );
};

export default JobProgress;
