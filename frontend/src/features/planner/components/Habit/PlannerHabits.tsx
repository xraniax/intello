import React from 'react';
import { motion } from 'framer-motion';
import { Flame, CheckCircle2, Circle, MoreVertical, Plus } from 'lucide-react';
import { Habit } from '../../types/planner.types';

interface PlannerHabitsProps {
    habits: Habit[];
}

const HabitItem: React.FC<{ habit: Habit }> = ({ habit }) => {
    // Generate last 7 days status (dummy)
    const last7Days = [true, true, false, true, true, true, false];
    
    return (
        <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${habit.current_streak > 3 ? 'bg-orange-100 text-orange-600' : 'bg-indigo-100 text-indigo-600'}`}>
                    <Flame size={20} className={habit.current_streak > 3 ? 'animate-bounce' : ''} />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 dark:text-white">{habit.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-bold text-orange-500">{habit.current_streak} day streak</span>
                        <span>•</span>
                        <span>{habit.frequency}</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-2">
                <div className="flex gap-1 mr-4">
                    {last7Days.map((done, i) => (
                        <div 
                            key={i} 
                            className={`w-2 h-6 rounded-full ${done ? 'bg-indigo-500' : 'bg-slate-100 dark:bg-slate-700'}`}
                            title={`Day ${i+1}`}
                        />
                    ))}
                </div>
                <button className="p-2 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-slate-400">
                    <CheckCircle2 size={24} className="text-slate-200 dark:text-slate-600 hover:text-indigo-500" />
                </button>
            </div>
        </div>
    );
};

const PlannerHabits: React.FC<PlannerHabitsProps> = ({ habits }) => {
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Daily Habits</h3>
                <button className="flex items-center gap-1 text-sm font-bold text-indigo-600 hover:text-indigo-700">
                    <Plus size={16} /> New Habit
                </button>
            </div>
            
            <div className="grid grid-cols-1 gap-4">
                {habits.map(habit => (
                    <HabitItem key={habit.id} habit={habit} />
                ))}
                
                {habits.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <p className="text-slate-500 dark:text-slate-400">No habits tracked yet. Start building your routine!</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlannerHabits;
