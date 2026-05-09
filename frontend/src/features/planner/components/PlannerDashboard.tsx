import React from 'react';
import { motion } from 'framer-motion';
import { usePlannerOverview } from '../hooks/usePlanner';
import { usePlannerStore } from '../store/usePlannerStore';
import PlannerHero from './Dashboard/PlannerHero';
import PlannerGoals from './Goal/GoalCard'; // simplified for this component
import PlannerKanban from './Task/PlannerKanban';
import PlannerCalendar from './Calendar/PlannerCalendar';
import PlannerHabits from './Habit/PlannerHabits';
import AIPlannerChat from './Dashboard/AIPlannerChat';
import QuickAddModal from './Common/QuickAddModal';
import { useAuth } from '../../../hooks/AuthContext';
import { LayoutDashboard, Calendar, Columns, Flame, Target, Plus } from 'lucide-react';
import GoalCard from './Goal/GoalCard';

const PlannerDashboard: React.FC = () => {
    const { data: overview, isLoading } = usePlannerOverview();
    const { currentTab, setCurrentTab, setQuickAddModal } = usePlannerStore();
    const { user } = useAuth();

    if (isLoading || !overview) {
        return (
            <div className="p-8 space-y-8 animate-pulse">
                <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
                    <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
                    <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-3xl" />
                </div>
            </div>
        );
    }

    const tabs = [
        { id: 'dashboard' as const, label: 'Overview', icon: <LayoutDashboard size={18} /> },
        { id: 'goals' as const, label: 'Goals', icon: <Target size={18} /> },
        { id: 'tasks' as const, label: 'Kanban', icon: <Columns size={18} /> },
        { id: 'calendar' as const, label: 'Calendar', icon: <Calendar size={18} /> },
        { id: 'habits' as const, label: 'Habits', icon: <Flame size={18} /> },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
            <QuickAddModal />
            
            {/* Header / Sub-Navbar */}
            <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 py-4 flex justify-between items-center z-10 shrink-0">
                <div className="flex items-center gap-8">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mr-4">Planner</h2>
                    <nav className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setCurrentTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    currentTab === tab.id 
                                    ? 'bg-white dark:bg-slate-600 text-indigo-600 dark:text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        ))}
                    </nav>
                </div>
                
                <button 
                    onClick={() => setQuickAddModal(true)}
                    className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all"
                >
                    <Plus size={18} />
                    <span>Quick Add</span>
                </button>
            </header>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
                <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
                    <div className="flex-1 min-w-0">
                        {currentTab === 'dashboard' && (
                            <div className="space-y-8 pb-12">
                                <PlannerHero overview={overview} userName={user?.name || 'Student'} />
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <section>
                                        <div className="flex justify-between items-center mb-6 px-1">
                                            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Active Goals</h3>
                                            <button onClick={() => setCurrentTab('goals')} className="text-sm font-bold text-indigo-600 underline">View all</button>
                                        </div>
                                        <div className="grid grid-cols-1 gap-4">
                                            {overview.goals.slice(0, 2).map(goal => (
                                                <GoalCard key={goal.id} goal={goal} />
                                            ))}
                                        </div>
                                    </section>
                                    
                                    <section>
                                        <PlannerHabits habits={overview.habits.slice(0, 3)} />
                                    </section>
                                </div>
                            </div>
                        )}
                        
                        {currentTab === 'goals' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                                {overview.goals.map(goal => (
                                    <GoalCard key={goal.id} goal={goal} />
                                ))}
                            </div>
                        )}
                        
                        {currentTab === 'tasks' && (
                            <div className="h-[calc(100vh-200px)] pb-12">
                                <PlannerKanban tasks={overview.tasks} />
                            </div>
                        )}
                        
                        {currentTab === 'calendar' && (
                            <div className="h-[calc(100vh-200px)] pb-12">
                                <PlannerCalendar schedule={overview.schedule} />
                            </div>
                        )}
                        
                        {currentTab === 'habits' && (
                            <div className="max-w-3xl mx-auto pb-12">
                                <PlannerHabits habits={overview.habits} />
                            </div>
                        )}
                    </div>
                    
                    {/* AI Assistant Sidebar (sticky) */}
                    <aside className="w-full lg:w-96 shrink-0 mb-12">
                        <div className="sticky top-8">
                            <AIPlannerChat />
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

export default PlannerDashboard;
