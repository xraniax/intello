import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    Target, Plus, Search, MoreVertical, Edit2, Trash2, Play,
    Clock, TrendingUp, CheckCircle, Zap, History, Trophy, BookOpen
} from 'lucide-react';
import { useAuth } from '@/hooks/AuthContext';
import { useSubjectStore } from '@/store/useSubjectStore';
import { goalService, formatDuration, getProgressColor, goalTypeLabels } from '@/services/GoalService';
import { GoalSettingModal } from '@/features/goals';
import toast from 'react-hot-toast';

const Goals = () => {
    const { user } = useAuth();
    const subjects = useSubjectStore((state) => state.data.subjects);
    const fetchSubjects = useSubjectStore((state) => state.actions.fetchSubjects);

    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [sessionTimer, setSessionTimer] = useState(0);
    const [filter, setFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = async () => {
        try {
            setLoading(true);
            const [goalsData, statsData, activeSessionData] = await Promise.all([
                goalService.getGoals(),
                goalService.getStats(),
                goalService.getActiveSession(),
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
        } catch {
            toast.error('Failed to load missions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        fetchSubjects();
    }, []);

    useEffect(() => {
        if (!activeSession) return;
        const interval = setInterval(() => setSessionTimer(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [activeSession]);

    const formatTimer = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

    const handleCreateGoal = () => { setEditingGoal(null); setShowModal(true); };
    const handleEditGoal = (goal) => { setEditingGoal(goal); setShowModal(true); };

    const handleToggleStatus = async (goal) => {
        try {
            const newStatus = goal.status === 'active' ? 'paused' : 'active';
            await goalService.updateGoal(goal.id, { status: newStatus });
            toast.success(`Mission ${newStatus}`);
            fetchData();
        } catch { toast.error('Failed to update mission'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('Abort this mission?')) return;
        try {
            await goalService.deleteGoal(id);
            toast.success('Mission aborted');
            fetchData();
        } catch { toast.error('Failed to abort mission'); }
    };

    const handleStartSession = async (goalId) => {
        try {
            const session = await goalService.startSession(goalId);
            setActiveSession(session);
            setSessionTimer(0);
            toast.success('System Online: Studying now');
        } catch { toast.error('Failed to start session'); }
    };

    const handleEndSession = async () => {
        try {
            await goalService.endSession();
            setActiveSession(null);
            setSessionTimer(0);
            toast.success('Session Uploaded to Core');
            fetchData();
        } catch { toast.error('Failed to end session'); }
    };

    const filteredGoals = useMemo(() => goals.filter(goal => {
        if (filter === 'active' && goal.status !== 'active') return false;
        if (filter === 'completed' && goal.status !== 'completed') return false;
        if (searchQuery && !goal.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    }), [goals, filter, searchQuery]);

    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ background: 'var(--c-canvas)' }}>
            <div className="max-w-4xl mx-auto px-8 py-10">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                                <Target className="w-5 h-5 text-white" />
                            </div>
                            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Growth Engine</h1>
                        </div>
                        <p className="text-sm text-gray-400 font-medium ml-[52px]">
                            {stats?.active_goals || 0} active missions
                        </p>
                    </div>

                    {/* Stats row */}
                    {stats && (
                        <div className="hidden sm:flex items-center gap-4">
                            <div className="text-center px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-xl font-black text-indigo-600">{stats.total_goals ?? 0}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</p>
                            </div>
                            <div className="text-center px-4 py-2 bg-white rounded-2xl border border-gray-100 shadow-sm">
                                <p className="text-xl font-black text-emerald-600">{stats.completed_goals ?? 0}</p>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Done</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Search & Filter */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search missions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 focus:border-indigo-300 rounded-2xl text-sm font-medium transition-all outline-none shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl p-1 shadow-sm">
                        {['all', 'active', 'completed'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all ${
                                    filter === f ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Goals grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-44 bg-white/60 rounded-[2rem] border border-white" />
                        ))}
                    </div>
                ) : filteredGoals.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {filteredGoals.map(goal => {
                            const isActiveSession = activeSession?.goalId === goal.id;
                            return (
                                <motion.div
                                    key={goal.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    whileHover={{ y: -4, scale: 1.01 }}
                                    className={`group relative overflow-hidden rounded-[2rem] border-2 transition-all duration-300 ${
                                        goal.status === 'active'
                                            ? 'border-white bg-white/70 backdrop-blur-md shadow-lg hover:shadow-indigo-500/10'
                                            : 'border-gray-100 bg-gray-50/50 opacity-60'
                                    }`}
                                >
                                    <div className="relative p-5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className={`font-black text-lg tracking-tight leading-tight mb-1 truncate ${goal.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                                    {goal.title}
                                                </h3>
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ring-1 ${goal.goalType === 'study_time' ? 'bg-blue-50 text-blue-600 ring-blue-100' : 'bg-purple-50 text-purple-600 ring-purple-100'}`}>
                                                    {goalTypeLabels[goal.goalType]}
                                                </span>
                                            </div>

                                            <div className="relative group/menu">
                                                <button className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all">
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-100 rounded-2xl shadow-2xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-30 overflow-hidden p-1">
                                                    <button onClick={() => handleEditGoal(goal)} className="w-full px-3 py-2 text-left text-xs font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg flex items-center gap-2">
                                                        <Edit2 className="w-3.5 h-3.5" /> Edit
                                                    </button>
                                                    <button onClick={() => handleDelete(goal.id)} className="w-full px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2">
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
                                                    className={`h-full rounded-full ${goal.completionPercentage >= 100 ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
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
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 px-6">
                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-5 border border-gray-100 shadow-sm">
                            <Target className="w-10 h-10 text-gray-200" />
                        </div>
                        <h3 className="font-black text-xl text-gray-900 mb-2">No missions found</h3>
                        <p className="text-sm text-gray-400 mb-6">Launch your first mission to start your evolution.</p>
                        <button
                            onClick={handleCreateGoal}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm shadow-lg shadow-indigo-100 hover:scale-[1.02] transition-transform"
                        >
                            <Plus className="w-4 h-4" />
                            Launch Mission
                        </button>
                    </div>
                )}
            </div>

            {/* FAB */}
            {!loading && filteredGoals.length > 0 && (
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCreateGoal}
                    className="fixed bottom-8 right-8 flex items-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm shadow-2xl shadow-indigo-200 z-20"
                >
                    <Plus className="w-4 h-4" />
                    New Mission
                </motion.button>
            )}

            <GoalSettingModal
                isOpen={showModal}
                onClose={() => { setShowModal(false); setEditingGoal(null); }}
                subjects={subjects}
                initialData={editingGoal}
                onGoalCreated={() => { fetchData(); setShowModal(false); setEditingGoal(null); }}
            />
        </div>
    );
};

export default Goals;
