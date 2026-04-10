import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const LoadingOverlay = ({ visible, message = 'Loading...', blocking = true }) => {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: blocking ? 0 : -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: blocking ? 0 : -20 }}
                    className={blocking
                        ? "fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-md"
                        : "fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none"
                    }
                >
                    {blocking ? (
                        <div className="flex flex-col items-center gap-6 p-10 rounded-3xl bg-white shadow-2xl shadow-indigo-100 border border-indigo-50 animate-in zoom-in-95 duration-300">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-indigo-50"></div>
                                <Loader2 className="w-16 h-16 text-indigo-600 animate-spin absolute inset-0" />
                            </div>
                            <div className="flex flex-col items-center gap-2 text-center">
                                <h3 className="text-xl font-black text-gray-900 tracking-tight">{message}</h3>
                                <p className="text-sm font-medium text-gray-400">Please wait while we handle this...</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-white/80 backdrop-blur-xl shadow-xl border border-indigo-50 pointer-events-auto">
                            <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                            <span className="text-sm font-bold text-gray-900">{message}</span>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LoadingOverlay;
