import React from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, ArrowRight, Zap, BookOpen, Clock } from 'lucide-react';

const AIRecommendations: React.FC = () => {
    const recommendations = [
        {
            id: 1,
            title: "Study Block Optimized",
            description: "Based on your focus sessions, 10:00 AM is your peak productivity time. Move 'Calculus' session here?",
            type: "schedule",
            icon: <Clock size={16} />,
            color: "text-amber-500 bg-amber-50"
        },
        {
            id: 2,
            title: "Concept Mastery",
            description: "You've spent less time on 'Quantum Mechanics' this week. Add a 30min review session?",
            type: "goal",
            icon: <BookOpen size={16} />,
            color: "text-indigo-500 bg-indigo-50"
        },
        {
            id: 3,
            title: "Focus Tip",
            description: "You tend to lose focus after 50 minutes. Try the 50/10 Pomodoro technique today.",
            type: "tip",
            icon: <Zap size={16} />,
            color: "text-emerald-500 bg-emerald-50"
        }
    ];

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 h-full shadow-sm">
            <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-indigo-600 rounded-lg">
                    <Lightbulb className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Smart Insights</h3>
            </div>
            
            <div className="space-y-4">
                {recommendations.map((rec, i) => (
                    <motion.div 
                        key={rec.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 group cursor-pointer hover:border-indigo-300 transition-all"
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <div className={`p-1.5 rounded-md ${rec.color}`}>
                                {rec.icon}
                            </div>
                            <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">{rec.title}</span>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{rec.description}</p>
                        <button className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:gap-2 transition-all">
                            Apply Suggestion <ArrowRight size={14} />
                        </button>
                    </motion.div>
                ))}
            </div>
            
            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                <p className="text-[10px] text-slate-400 text-center italic">
                    AI insights are based on your study patterns and goal progress.
                </p>
            </div>
        </div>
    );
};

export default AIRecommendations;
