import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, HelpCircle, Info } from 'lucide-react';

const CustomModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'confirm', // 'confirm', 'prompt', 'info', 'warning'
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    defaultValue = '',
    placeholder = 'Enter value...',
    isLoading = false,
    children
}) => {
    const [inputValue, setInputValue] = useState(defaultValue);

    useEffect(() => {
        if (isOpen) {
            setInputValue(defaultValue);
        }
    }, [isOpen, defaultValue]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const handleConfirm = () => {
        if (type === 'prompt') {
            onConfirm(inputValue);
        } else {
            onConfirm();
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
                />

                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-purple-50"
                >
                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Header Icon & Title */}
                        <div className="p-8 pb-0 flex flex-col items-center text-center">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${
                                type === 'warning' ? 'bg-red-50 text-red-500' :
                                type === 'prompt' ? 'bg-indigo-50 text-indigo-500' :
                                'bg-purple-50 text-purple-500'
                            }`}>
                                {type === 'warning' ? <AlertCircle className="w-8 h-8" /> :
                                 type === 'prompt' ? <HelpCircle className="w-8 h-8" /> :
                                 <Info className="w-8 h-8" />}
                            </div>
                            <h2 className="text-2xl font-black text-gray-900 mb-2 leading-tight">
                                {title}
                            </h2>
                            <p className="text-gray-500 font-medium px-4">
                                {message}
                            </p>
                        </div>

                        {/* Body / Prompt Input / Children */}
                        <div className="px-8 py-6">
                            {children ? (
                                children
                            ) : (
                                type === 'prompt' && (
                                    <input
                                        type="text"
                                        className="input-field py-4 text-lg font-medium"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder={placeholder}
                                        autoFocus
                                        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                                    />
                                )
                            )}
                        </div>
                    </div>

                    {/* Footer Actions (Sticky at bottom) */}
                    <div className="p-6 bg-gray-50/80 backdrop-blur-sm border-t border-gray-100 flex flex-col sm:flex-row gap-3">
                        <button
                            onClick={onClose}
                            className="btn-secondary flex-1 py-4 text-sm font-bold uppercase tracking-widest rounded-2xl"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={isLoading || (type === 'prompt' && !inputValue.trim())}
                            className={`btn-primary flex-1 py-4 text-sm font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-purple-200/50 ${
                                type === 'warning' ? 'bg-red-500 border-red-500 text-white hover:bg-red-600 shadow-red-200/50' : ''
                            }`}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                confirmText
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CustomModal;
