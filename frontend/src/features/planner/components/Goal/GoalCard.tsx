import React from 'react';
import { motion } from 'framer-motion';
import { Target, Calendar, ChevronRight, MoreVertical } from 'lucide-react';
import { Goal } from '../../types/planner.types';

interface GoalCardProps {
    goal: Goal;
}

const GoalCard: React.FC<GoalCardProps> = ({ goal }) => {
    const progress = 65; // Dummy progress calculation for now
    
    return (
        <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group"
        >
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg">
                    <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                    <MoreVertical className="w-5 h-5" />
                </button>
            </div>
            
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 line-clamp-1">{goal.title}</h4>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 line-clamp-1">{goal.description}</p>
            
            <div className="space-y-3">
                <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <Calendar className="w-3 h-3" />
                        <span>ETA: {goal.end_date || 'TBD'}</span>
                    </div>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{progress}%</span>
                </div>
                
                <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-indigo-500 rounded-full"
                    />
                </div>
                
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center mt-2 group-hover:pt-3 transition-all">
                    <span className="text-xs text-slate-400 italic">2 milestones left</span>
                    <button className="text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 text-xs font-bold opacity-0 group-hover:opacity-100 transition-all">
                        Details <ChevronRight className="w-3 h-3" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

export default GoalCard;
