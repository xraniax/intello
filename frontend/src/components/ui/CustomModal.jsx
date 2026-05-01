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
    showFooter = true,
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
                    className="relative w-full max-w-md rounded-[2.5rem] flex flex-col max-h-[90vh] overflow-hidden border shadow-2xl"
                    style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)' }}
                >
                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Header Icon & Title */}
                        <div className="p-8 pb-0 flex flex-col items-center text-center">
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-sm`}
                                style={{
                                    background: type === 'warning' ? 'var(--c-danger-ultra)' : type === 'prompt' ? 'var(--c-primary-light)' : 'var(--c-accent-light)',
                                    color: type === 'warning' ? 'var(--c-danger)' : type === 'prompt' ? 'var(--c-primary)' : 'var(--c-accent)',
                                }}
                            >
                                {type === 'warning' ? <AlertCircle className="w-8 h-8" /> :
                                 type === 'prompt' ? <HelpCircle className="w-8 h-8" /> :
                                 <Info className="w-8 h-8" />}
                            </div>
                            <h2 className="text-2xl font-black mb-2 leading-tight" style={{ color: 'var(--c-text)' }}>
                                {title}
                            </h2>
                            <p className="font-medium px-4" style={{ color: 'var(--c-text-secondary)' }}>
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
                    {showFooter && (
                        <div className="p-6 backdrop-blur-sm border-t flex flex-col sm:flex-row gap-3" style={{ background: 'var(--c-surface-alt)', borderColor: 'var(--c-border-soft)' }}>
                            <button
                                onClick={onClose}
                                className="btn-secondary flex-1 py-4 text-sm font-bold uppercase tracking-widest rounded-2xl"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isLoading || (type === 'prompt' && !inputValue.trim())}
                                className={`btn-primary flex-1 py-4 text-sm font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-lg ${
                                    type === 'warning' ? 'btn-danger border-red-500 text-white shadow-red-200/50' : 'shadow-[var(--c-primary-light)]'
                                }`}
                                style={type === 'warning' ? { background: 'var(--c-danger)' } : {}}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                ) : (
                                    confirmText
                                )}
                            </button>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default CustomModal;
