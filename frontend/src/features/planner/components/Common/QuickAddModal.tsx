import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, CheckSquare, Flame, Plus } from 'lucide-react';
import { usePlannerStore } from '../../store/usePlannerStore';
import { usePlannerGoals, usePlannerTasks, usePlannerHabits } from '../../hooks/usePlanner';

const QuickAddModal: React.FC = () => {
    const { isQuickAddModalOpen, quickAddType, setQuickAddModal } = usePlannerStore();
    const [title, setTitle] = React.useState('');
    const [description, setDescription] = React.useState('');
    
    const { createGoalMutation } = usePlannerGoals();
    const { createTaskMutation } = usePlannerTasks();
    const { createHabitMutation } = usePlannerHabits();

    if (!isQuickAddModalOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (quickAddType === 'goal') {
                await createGoalMutation.mutateAsync({ title, description });
            } else if (quickAddType === 'task') {
                await createTaskMutation.mutateAsync({ title, description });
            } else if (quickAddType === 'habit') {
                await createHabitMutation.mutateAsync({ title, description });
            }
            setQuickAddModal(false);
            setTitle('');
            setDescription('');
        } catch (error) {
            console.error('Failed to add item:', error);
        }
    };

    const types = [
        { id: 'goal' as const, label: 'Goal', icon: <Target size={18} />, color: 'bg-amber-100 text-amber-600' },
        { id: 'task' as const, label: 'Task', icon: <CheckSquare size={18} />, color: 'bg-indigo-100 text-indigo-600' },
        { id: 'habit' as const, label: 'Habit', icon: <Flame size={18} />, color: 'bg-orange-100 text-orange-600' },
    ];

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setQuickAddModal(false)}
                    className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                />
                
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative z-10"
                >
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Quick Add</h2>
                        <button 
                            onClick={() => setQuickAddModal(false)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="flex gap-3">
                            {types.map(t => (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => setQuickAddModal(true, t.id)}
                                    className={`flex-1 p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
                                        quickAddType === t.id 
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                                        : 'border-transparent bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className={`p-2 rounded-xl ${t.color}`}>
                                        {t.icon}
                                    </div>
                                    <span className="text-xs font-bold">{t.label}</span>
                                </button>
                            ))}
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Title</label>
                                <input 
                                    autoFocus
                                    placeholder={`Enter your ${quickAddType} title...`}
                                    className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Description (Optional)</label>
                                <textarea 
                                    placeholder="Add some details..."
                                    className="w-full bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[100px] dark:text-white"
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>
                        </div>
                        
                        <button 
                            type="submit"
                            disabled={createGoalMutation.isPending || createTaskMutation.isPending || createHabitMutation.isPending}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold py-4 rounded-2xl shadow-lg shadow-indigo-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            <Plus size={20} />
                            {createGoalMutation.isPending || createTaskMutation.isPending || createHabitMutation.isPending 
                                ? 'Creating...' 
                                : `Add ${quickAddType}`}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default QuickAddModal;
