import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, Flame, Layout, Target } from 'lucide-react';
import { PlannerOverview } from '../../types/planner.types';

interface PlannerHeroProps {
    overview: PlannerOverview;
    userName: string;
}

const PlannerHero: React.FC<PlannerHeroProps> = ({ overview, userName }) => {
    const todayTasks = overview.tasks.filter(t => t.status === 'PENDING').length;
    const activeGoals = overview.goals.filter(g => g.status === 'IN_PROGRESS').length;
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl"
            >
                <div className="relative z-10">
                    <h1 className="text-3xl md:text-4xl font-bold mb-2">
                        Good morning, {userName} <span className="animate-pulse">👋</span>
                    </h1>
                    <p className="text-indigo-100 text-lg mb-6 max-w-md">
                        You have {todayTasks} tasks to focus on today. Let's make it a productive one!
                    </p>
                    
                    <div className="flex flex-wrap gap-4">
                        <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-white/10">
                            <Sparkles className="w-5 h-5 text-yellow-300" />
                            <span className="font-semibold">Focus Score: 85</span>
                        </div>
                        <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-white/10">
                            <Flame className="w-5 h-5 text-orange-400" />
                            <span className="font-semibold">5 Day Streak</span>
                        </div>
                    </div>
                </div>
                
                {/* Abstract background shapes */}
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute right-10 bottom-0 w-40 h-40 bg-indigo-400/20 rounded-full blur-2xl"></div>
            </motion.div>

            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-slate-800 rounded-3xl p-8 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between"
            >
                <div>
                    <h3 className="text-slate-500 dark:text-slate-400 font-medium mb-1 uppercase tracking-wider text-xs">Workload Meter</h3>
                    <div className="flex items-end gap-2 mb-6">
                        <span className="text-4xl font-bold text-slate-900 dark:text-white">Medium</span>
                        <Layout className="w-6 h-6 text-indigo-500 mb-1" />
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tasks done
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white">12/15</span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full w-[80%]"></div>
                            </div>
                        </div>
                        
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-600 dark:text-slate-300 flex items-center gap-1">
                                    <Target className="w-4 h-4 text-amber-500" /> Active Goals
                                </span>
                                <span className="font-semibold text-slate-900 dark:text-white">{activeGoals}</span>
                            </div>
                            <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 rounded-full w-[60%]"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default PlannerHero;
