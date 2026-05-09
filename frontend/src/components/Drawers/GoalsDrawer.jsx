import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Target, Plus, Filter, Search, MoreVertical, Edit2, Trash2, Play, Square,
    Clock, Flame, TrendingUp, Calendar, CheckCircle, X, ChevronDown, ChevronUp,
    History, Trophy, AlertCircle, BookOpen, Zap
} from 'lucide-react';
import { useAuth } from '@/hooks/AuthContext';
import { useSubjectStore } from '@/store/useSubjectStore';
import { useUIStore } from '@/store/useUIStore';
import { goalService, formatDuration, getProgressColor, goalTypeLabels, goalPeriodLabels } from '@/services/GoalService';
import { GoalSettingModal } from '@/features/goals';
import toast from 'react-hot-toast';

const GoalsDrawer = () => {
    const { user } = useAuth();
    const isOpen = useUIStore((state) => state.data.goalsDrawerOpen);
    const toggleDrawer = useUIStore((state) => state.actions.toggleGoalsDrawer);
    
    // Core state copied from Goals.jsx
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [sessionTimer, setSessionTimer] = useState(0);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGoal, setExpandedGoal] = useState(null);

    const subjects = useSubjectStore((state) => state.data.subjects);
    const fetchSubjects = useSubjectStore((state) => state.actions.fetchSubjects);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [goalsData, statsData, activeSessionData] = await Promise.all([
                goalService.getGoals(),
                goalService.getStats(),
                goalService.getActiveSession()
            ]);
            setGoals(goalsData);
            setStats(statsData);
            if (activeSessionData) {
                setActiveSession(activeSessionData);
                const elapsed = Math.floor((new Date() - new Date(activeSessionData.startedAt)) / 1000);
                setSessionTimer(elapsed);
            } else {
                setActiveSession(null);
                setSessionTimer(0);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Failed to load missions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
            fetchSubjects();
        }
    }, [isOpen]);

    useEffect(() => {
        let interval;
        if (activeSession) {
            interval = setInterval(() => {
                setSessionTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeSession]);

    const handleCreateGoal = () => {
        setEditingGoal(null);
        setShowModal(true);
    };

    const handleEditGoal = (goal) => {
        setEditingGoal(goal);
        setShowModal(true);
    };

    const handleToggleGoalStatus = async (goal) => {
        try {
            const newStatus = goal.status === 'active' ? 'paused' : 'active';
            await goalService.updateGoal(goal.id, { status: newStatus });
            toast.success(`Mission ${newStatus}`);
            fetchData();
        } catch (error) {
            toast.error('Failed to update mission');
        }
    };

    const handleDeleteGoal = async (id) => {
        if (!confirm('Are you sure you want to abort this mission?')) return;
        try {
            await goalService.deleteGoal(id);
            toast.success('Mission aborted');
            fetchData();
        } catch (error) {
            toast.error('Failed to abort mission');
        }
    };

    const handleStartSession = async (goalId) => {
        try {
            const session = await goalService.startSession(goalId);
            setActiveSession(session);
            setSessionTimer(0);
            toast.success('System Online: Studying now');
        } catch (error) {
            toast.error('Failed to start session');
        }
    };

    const handleEndSession = async () => {
        try {
            await goalService.endSession();
            setActiveSession(null);
            setSessionTimer(0);
            toast.success('Session Uploaded to Core');
            fetchData();
        } catch (error) {
            toast.error('Failed to end session');
        }
    };

    const handleQuickLog = async (goalId) => {
        const minutes = prompt('How many minutes did you focus?');
        if (!minutes || isNaN(minutes)) return;
        try {
            await goalService.logTime(goalId, parseInt(minutes));
            toast.success('Deep Work Logged');
            fetchData();
        } catch (error) {
            toast.error('Failed to log time');
        }
    };

    const filteredGoals = useMemo(() => {
        return goals.filter(goal => {
            if (filter === 'active' && goal.status !== 'active') return false;
            if (filter === 'completed' && goal.status !== 'completed') return false;
            if (searchQuery && !goal.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [goals, filter, searchQuery]);

    const formatTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const renderGoalCard = (goal) => {
        const isExpanded = expandedGoal === goal.id;
        const isActiveSession = activeSession?.goalId === goal.id;

        return (
            <motion.div
                key={goal.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className={`group relative overflow-hidden rounded-[2rem] border-2 transition-all duration-300 ${goal.status === 'active'
                        ? 'border-white bg-white/60 backdrop-blur-md shadow-lg hover:shadow-indigo-500/10'
                        : 'border-gray-100 bg-gray-50/50 opacity-60'
                    }`}
            >
                <div className="relative p-5">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h3 className={`font-black text-lg tracking-tight leading-tight mb-1 truncate ${goal.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                {goal.title}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ring-1 ${goal.goalType === 'study_time' ? 'bg-blue-50 text-blue-600 ring-blue-100' : 'bg-purple-50 text-purple-600 ring-purple-100'}`}>
                                    {goalTypeLabels[goal.goalType]}
                                </span>
                            </div>
                        </div>

                        <div className="relative group/menu">
                            <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all">
                                <MoreVertical className="w-4 h-4" />
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-100 rounded-2xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-[30] overflow-hidden p-1">
                                <button onClick={() => handleEditGoal(goal)} className="w-full px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2">
                                    <Edit2 className="w-3.5 h-3.5" /> Edit
                                </button>
                                <button onClick={() => handleDeleteGoal(goal.id)} className="w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
                                    <Trash2 className="w-3.5 h-3.5" /> Abort
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Progress</span>
                            <span className={`text-sm font-black ${getProgressColor(goal.completionPercentage)}`}>{goal.completionPercentage}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, goal.completionPercentage)}%` }}
                                className={`h-full rounded-full transition-all duration-500 ${goal.completionPercentage >= 100
                                        ? 'bg-gradient-to-r from-emerald-400 to-green-500'
                                        : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                                    }`}
                            />
                        </div>
                    </div>

                    {!isActiveSession && goal.status === 'active' && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleStartSession(goal.id)}
                            className="mt-4 w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-black transition-all"
                        >
                            <Play className="w-3 h-3 fill-current" />
                            Start Mission
                        </motion.button>
                    )}
                    
                    {isActiveSession && (
                        <div className="mt-4 p-2.5 bg-emerald-50 rounded-xl flex items-center justify-between border border-emerald-100">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-black text-emerald-700 uppercase tabular-nums">{formatTimer(sessionTimer)}</span>
                            </div>
                            <button onClick={handleEndSession} className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg">Complete</button>
                        </div>
                    )}
                </div>
            </motion.div>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleDrawer}
                        className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[60]"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full w-[400px] bg-gray-50/95 backdrop-blur-xl shadow-2xl z-[70] flex flex-col border-l border-white/20"
                    >
                        {/* Header */}
                        <div className="p-6 bg-white flex items-center justify-between border-b">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                        <Target className="w-4 h-4 text-white" />
                                    </div>
                                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Growth Engine</h2>
                                </div>
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">{stats?.active_goals || 0} Active Missions</p>
                            </div>
                            <button
                                onClick={toggleDrawer}
                                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search & Filter */}
                        <div className="p-4 bg-white/50 border-b space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search missions..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100/50 border border-transparent focus:border-indigo-200 focus:bg-white rounded-xl text-sm font-medium transition-all outline-none"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                {['all', 'active', 'completed'].map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setFilter(f)}
                                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                                            filter === f ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Goals List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                            {loading ? (
                                <div className="space-y-4 animate-pulse">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-40 bg-white/50 rounded-[2rem] border border-white" />
                                    ))}
                                </div>
                            ) : filteredGoals.length > 0 ? (
                                filteredGoals.map(renderGoalCard)
                            ) : (
                                <div className="text-center py-20 px-6">
                                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-100 shadow-sm">
                                        <Target className="w-8 h-8 text-gray-200" />
                                    </div>
                                    <h3 className="font-black text-gray-900">No missions found</h3>
                                    <p className="text-xs text-gray-500 mt-2">Initialize your first mission to start your evolution.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="p-6 bg-white border-t">
                            <button
                                onClick={handleCreateGoal}
                                className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                Launch New Mission
                            </button>
                        </div>
                    </motion.div>

                    <GoalSettingModal
                        isOpen={showModal}
                        onClose={() => {
                            setShowModal(false);
                            setEditingGoal(null);
                        }}
                        subjects={subjects}
                        initialData={editingGoal}
                        onGoalCreated={() => {
                            fetchData();
                            setShowModal(false);
                            setEditingGoal(null);
                        }}
                    />
                </>
            )}
        </AnimatePresence>
    );
};

export default GoalsDrawer;
