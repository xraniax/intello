import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const LoadingOverlay = ({ visible, message = 'Loading...' }) => {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-md"
                >
                    <div className="flex flex-col items-center gap-6 p-10 rounded-3xl bg-white shadow-2xl shadow-indigo-100 border border-indigo-50 animate-in zoom-in-95 duration-300">
                        <div className="relative">
                            <div className="w-16 h-16 rounded-full border-4 border-indigo-50"></div>
                            <Loader2 className="w-16 h-16 text-indigo-600 animate-spin absolute inset-0" />
                        </div>
                        <div className="flex flex-col items-center gap-2">
                             <h3 className="text-xl font-black text-gray-900 tracking-tight">{message}</h3>
                             <p className="text-sm font-medium text-gray-400">Please wait while we handle this...</p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default LoadingOverlay;
