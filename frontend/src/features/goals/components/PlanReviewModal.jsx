import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Check, RefreshCw, BookOpen, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PlanReviewModal = ({ isOpen, onClose, plan, onActivate, isActivating }) => {
    const [editableSessions, setEditableSessions] = useState(plan?.content?.sessions || []);

    // Effect to update local sessions when plan arrives
    React.useEffect(() => {
        if (plan?.content?.sessions) {
            setEditableSessions(plan.content.sessions);
        }
    }, [plan]);

    if (!isOpen || !plan) return null;

    const handleDurationChange = (index, delta) => {
        const newSessions = [...editableSessions];
        newSessions[index].duration_minutes = Math.max(15, newSessions[index].duration_minutes + delta);
        setEditableSessions(newSessions);
    };

    const handleActivate = () => {
        const finalizedPlan = {
            ...plan,
            content: {
                ...plan.content,
                sessions: editableSessions
            }
        };
        onActivate(finalizedPlan);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pb-20 sm:pb-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header bg */}
                        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none" />

                        {/* Header */}
                        <div className="relative border-b border-gray-100 p-6 flex flex-col gap-4 shrink-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                        <Calendar className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Your Study Plan</h2>
                                        <p className="text-sm text-gray-500 font-medium">AI-generated schedule based on your goals</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Summary alert */}
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="text-sm font-semibold text-indigo-900">Plan Summary</h4>
                                    <p className="text-sm text-indigo-700 mt-1 leading-relaxed">
                                        {plan.content?.summary || "Here is a structured breakdown for your week."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Sessions Content */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 relative z-10 space-y-4">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-gray-400" />
                                Weekly Schedule Overview
                            </h3>

                            <div className="space-y-3">
                                {editableSessions.map((session, i) => (
                                    <motion.div
                                        key={`${session.day_of_week}-${i}`}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        className="p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors group flex items-start gap-4"
                                    >
                                        <div className="w-20 shrink-0">
                                            <span className="text-sm font-bold text-gray-900">{session.day_of_week}</span>
                                            <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium mt-1">
                                                <Clock className="w-3 h-3" />
                                                {session.duration_minutes}m
                                            </div>
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                                                <BookOpen className="w-4 h-4 text-purple-500" />
                                                {session.focus_topic}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1 max-w-sm truncate">
                                                {session.goal_id ? "Linked to active goal" : "General study"}
                                            </p>
                                        </div>

                                        <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-200 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleDurationChange(i, -15)}
                                                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white rounded-md transition-all shadow-sm"
                                            >
                                                -
                                            </button>
                                            <span className="text-xs font-semibold px-2 w-10 text-center">{session.duration_minutes}m</span>
                                            <button
                                                onClick={() => handleDurationChange(i, 15)}
                                                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-white rounded-md transition-all shadow-sm"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                                {editableSessions.length === 0 && (
                                    <div className="text-center py-8 text-gray-500 text-sm">
                                        No study sessions defined in this plan.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-gray-100 p-6 flex items-center justify-end gap-3 shrink-0 bg-gray-50/50">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                Cancel
                            </button>
                            
                            <button
                                onClick={handleActivate}
                                disabled={isActivating}
                                className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                            >
                                {isActivating ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Check className="w-4 h-4" />
                                )}
                                Agree & Activate Plan
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PlanReviewModal;
