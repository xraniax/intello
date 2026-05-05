import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Target, Plus, Filter, Search, MoreVertical, Edit2, Trash2, Play, Square,
    Clock, Flame, TrendingUp, Calendar, CheckCircle, X, ChevronDown, ChevronUp,
    BarChart3, History, Trophy, AlertCircle, BookOpen, Zap
} from 'lucide-react';
import { useSubjectStore } from '@/store/useSubjectStore';
import { goalService, formatDuration, getProgressColor, goalTypeLabels, goalPeriodLabels } from '@/services/GoalService';
import { GoalSettingModal } from '@/features/goals';
import toast from 'react-hot-toast';

const Goals = () => {
    const navigate = useNavigate();
    const subjects = useSubjectStore(s => s.data.subjects);
    const fetchSubjects = useSubjectStore(s => s.actions.fetchSubjects);

    // State
    const [goals, setGoals] = useState([]);
    const [stats, setStats] = useState(null);
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingGoal, setEditingGoal] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [sessionTimer, setSessionTimer] = useState(0);
    const [filter, setFilter] = useState('all'); // all, active, completed
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedGoal, setExpandedGoal] = useState(null);
    const [activeTab, setActiveTab] = useState('goals'); // goals, history, stats

    // Fetch data on mount
    useEffect(() => {
        fetchData();
        fetchSubjects();
    }, []);

    // Session timer
    useEffect(() => {
        let interval;
        if (activeSession) {
            interval = setInterval(() => {
                setSessionTimer(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeSession]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [goalsRes, statsRes, historyRes] = await Promise.all([
                goalService.getAll(),
                goalService.getStats(),
                goalService.getHistory({ days: 30 })
            ]);
            setGoals(goalsRes.data.data || []);
            setStats(statsRes.data.data);
            setHistory(historyRes.data.data);
        } catch (error) {
            toast.error('Failed to load goals');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGoal = () => {
        setEditingGoal(null);
        setShowModal(true);
    };

    const handleEditGoal = (goal) => {
        setEditingGoal(goal);
        setShowModal(true);
    };

    const handleDeleteGoal = async (goalId) => {
        if (!window.confirm('Delete this goal? This cannot be undone.')) return;

        try {
            await goalService.delete(goalId);
            toast.success('Goal deleted');
            fetchData();
        } catch (error) {
            toast.error('Failed to delete goal');
        }
    };

    const handleStartSession = async (goalId) => {
        try {
            const response = await goalService.startSession({ goalId });
            setActiveSession({
                id: response.data.data.sessionId,
                goalId,
                startedAt: new Date()
            });
            setSessionTimer(0);
            toast.success('Study session started!');
        } catch (error) {
            toast.error('Failed to start session');
        }
    };

    const handleEndSession = async () => {
        if (!activeSession) return;

        try {
            await goalService.endSession(activeSession.id, {
                notes: '',
                materialsViewed: 0,
                questionsAnswered: 0
            });

            const minutes = Math.floor(sessionTimer / 60);
            toast.success(`Session ended! ${minutes} minutes logged.`);
            
            setActiveSession(null);
            setSessionTimer(0);
            fetchData();
        } catch (error) {
            toast.error('Failed to end session');
        }
    };

    const handleQuickLog = async (goalId) => {
        const minutes = prompt('How many minutes did you study?', '30');
        if (!minutes || isNaN(minutes) || minutes < 1) return;

        try {
            await goalService.logTime(parseInt(minutes));
            toast.success(`${minutes} minutes logged!`);
            fetchData();
        } catch (error) {
            toast.error('Failed to log time');
        }
    };

    const handleToggleGoalStatus = async (goal) => {
        const newStatus = goal.status === 'active' ? 'paused' : 'active';
        try {
            await goalService.update(goal.id, { status: newStatus });
            toast.success(`Goal ${newStatus}`);
            fetchData();
        } catch (error) {
            toast.error('Failed to update goal');
        }
    };

    // Filter goals
    const filteredGoals = goals.filter(goal => {
        if (filter === 'active' && goal.status !== 'active') return false;
        if (filter === 'completed' && goal.status !== 'completed') return false;
        if (searchQuery && !goal.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    // Format timer
    const formatTimer = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Render helpers
    const renderGoalCard = (goal) => {
        const isExpanded = expandedGoal === goal.id;
        const isActiveSession = activeSession?.goalId === goal.id;

        return (
            <motion.div
                key={goal.id}
                layout
                className={`bg-white rounded-xl border ${
                    goal.status === 'active' ? 'border-gray-200' : 'border-gray-100 bg-gray-50/50'
                } overflow-hidden`}
            >
                <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className={`font-medium truncate ${
                                    goal.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-900'
                                }`}>
                                    {goal.title}
                                </h3>
                                {goal.percentage >= 100 && (
                                    <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                                )}
                            </div>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {goalTypeLabels[goal.goalType]} • {goalPeriodLabels[goal.goalPeriod]}
                                {goal.subjectName && ` • ${goal.subjectName}`}
                            </p>
                        </div>

                        <div className="flex items-center gap-1 ml-2">
                            {/* Quick Actions */}
                            {goal.goalType === 'study_time' && goal.status === 'active' && (
                                <>
                                    {isActiveSession ? (
                                        <button
                                            onClick={handleEndSession}
                                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                                            title="End session"
                                        >
                                            <Square className="w-4 h-4" />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleStartSession(goal.id)}
                                            disabled={activeSession}
                                            className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                                            title="Start study session"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                    )}
                                </>
                            )}

                            <button
                                onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            <div className="relative group">
                                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                    <button
                                        onClick={() => handleEditGoal(goal)}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleToggleGoalStatus(goal)}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                    >
                                        {goal.status === 'active' ? (
                                            <><AlertCircle className="w-4 h-4" /> Pause</>
                                        ) : (
                                            <><Play className="w-4 h-4" /> Resume</>
                                        )}
                                    </button>
                                    <div className="border-t border-gray-100 my-1"></div>
                                    <button
                                        onClick={() => handleDeleteGoal(goal.id)}
                                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-600">
                                {goal.goalType === 'study_time'
                                    ? `${formatDuration(goal.currentValue)} of ${formatDuration(goal.targetValue)}`
                                    : `${goal.currentValue} of ${goal.targetValue}`
                                }
                            </span>
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-medium ${getProgressColor(goal.completionPercentage)}`}>
                                    {goal.completionPercentage}%
                                </span>
                                {goal.streakCount > 0 && (
                                    <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                                        <Flame className="w-3 h-3" />
                                        {goal.streakCount}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, goal.completionPercentage)}%` }}
                                className={`h-full rounded-full ${
                                    goal.completionPercentage >= 100
                                        ? 'bg-green-500'
                                        : goal.completionPercentage >= 50
                                            ? 'bg-blue-500'
                                            : 'bg-indigo-500'
                                }`}
                            />
                        </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                        {isExpanded && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="pt-4 mt-4 border-t border-gray-100 space-y-3">
                                    {goal.description && (
                                        <p className="text-sm text-gray-600">{goal.description}</p>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-gray-500">Started</p>
                                            <p className="font-medium text-gray-700">
                                                {new Date(goal.startDate).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 rounded-lg p-3">
                                            <p className="text-gray-500">Best Streak</p>
                                            <p className="font-medium text-gray-700">
                                                {goal.longestStreak} days
                                            </p>
                                        </div>
                                    </div>

                                    {goal.goalType === 'study_time' && !isActiveSession && (
                                        <button
                                            onClick={() => handleQuickLog(goal.id)}
                                            className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium"
                                        >
                                            + Log Study Time
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Active Session Bar */}
                {isActiveSession && (
                    <div className="px-4 py-3 bg-green-50 border-t border-green-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-green-800">
                                Studying now • {formatTimer(sessionTimer)}
                            </span>
                        </div>
                        <button
                            onClick={handleEndSession}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                        >
                            End
                        </button>
                    </div>
                )}
            </motion.div>
        );
    };

    const renderHistory = () => {
        if (!history?.recentSessions?.length) {
            return (
                <div className="text-center py-12">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No study sessions yet</p>
                    <p className="text-sm text-gray-400 mt-1">
                        Start a study session or log time to see your history
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-blue-700">
                            {formatDuration(history.totalMinutes)}
                        </p>
                        <p className="text-sm text-blue-600">Total (30 days)</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-green-700">
                            {history.recentSessions.length}
                        </p>
                        <p className="text-sm text-green-600">Sessions</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4 text-center">
                        <p className="text-2xl font-bold text-purple-700">
                            {history.dailyBreakdown.length}
                        </p>
                        <p className="text-sm text-purple-600">Active Days</p>
                    </div>
                </div>

                {/* Daily Chart */}
                {history.dailyBreakdown.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h4 className="font-medium text-gray-900 mb-4">Daily Study Time</h4>
                        <div className="flex items-end gap-1 h-32">
                            {history.dailyBreakdown.slice(0, 14).map((day, i) => {
                                const maxMinutes = Math.max(...history.dailyBreakdown.map(d => d.minutes));
                                const height = maxMinutes > 0 ? (day.minutes / maxMinutes) * 100 : 0;
                                return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                            className="w-full bg-blue-200 rounded-t hover:bg-blue-300 transition-colors relative group"
                                            style={{ height: `${Math.max(height, 4)}%` }}
                                        >
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                                                {formatDuration(day.minutes)}
                                            </div>
                                        </div>
                                        <span className="text-xs text-gray-400">
                                            {new Date(day.date).toLocaleDateString('en', { weekday: 'narrow' })}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Recent Sessions */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100">
                        <h4 className="font-medium text-gray-900">Recent Sessions</h4>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {history.recentSessions.slice(0, 10).map(session => (
                            <div key={session.id} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                    <p className="font-medium text-gray-900">
                                        {session.goal || session.subject || 'Study Session'}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {new Date(session.startedAt).toLocaleDateString()} • {session.type}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-gray-900">
                                        {formatDuration(session.duration)}
                                    </p>
                                    {session.notes && (
                                        <p className="text-xs text-gray-400 truncate max-w-[150px]">
                                            {session.notes}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderStats = () => {
        if (!stats) return null;

        return (
            <div className="space-y-6">
                {/* Overall Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white">
                        <p className="text-3xl font-bold">{stats.total_goals}</p>
                        <p className="text-sm opacity-90">Total Goals</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl p-4 text-white">
                        <p className="text-3xl font-bold">{stats.completed_goals}</p>
                        <p className="text-sm opacity-90">Completed</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-xl p-4 text-white">
                        <p className="text-3xl font-bold">{stats.current_streak || 0}</p>
                        <p className="text-sm opacity-90">Day Streak</p>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-4 text-white">
                        <p className="text-3xl font-bold">{stats.best_streak || 0}</p>
                        <p className="text-sm opacity-90">Best Streak</p>
                    </div>
                </div>

                {/* Weekly Progress */}
                {stats.weeklyProgress?.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h4 className="font-medium text-gray-900 mb-4">This Week's Progress</h4>
                        <div className="space-y-4">
                            {stats.weeklyProgress.map(goal => (
                                <div key={goal.id}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm text-gray-700">{goal.title}</span>
                                        <span className={`text-sm font-medium ${getProgressColor(goal.percentage)}`}>
                                            {goal.percentage}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${
                                                goal.percentage >= 100 ? 'bg-green-500' :
                                                goal.percentage >= 50 ? 'bg-blue-500' : 'bg-indigo-500'
                                            }`}
                                            style={{ width: `${Math.min(100, goal.percentage)}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Motivation Card */}
                <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                            <Trophy className="w-6 h-6 text-yellow-600" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-gray-900">Keep it up!</h4>
                            <p className="text-sm text-gray-600 mt-1">
                                You're making great progress. Consistent study habits lead to better retention and understanding.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto px-4 py-8">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-32 bg-gray-100 rounded-xl"></div>
                    <div className="h-64 bg-gray-100 rounded-xl"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Study Goals</h1>
                    <p className="text-gray-500 mt-1">
                        {stats?.active_goals || 0} active • {stats?.completed_goals || 0} completed
                    </p>
                </div>
                <button
                    onClick={handleCreateGoal}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    New Goal
                </button>
            </div>

            {/* Active Session Banner */}
            {activeSession && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        <div>
                            <p className="font-medium text-green-900">Study session in progress</p>
                            <p className="text-sm text-green-700">{formatTimer(sessionTimer)} elapsed</p>
                        </div>
                    </div>
                    <button
                        onClick={handleEndSession}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        End Session
                    </button>
                </motion.div>
            )}
            {/* Content */}
                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-2">
                            {['all', 'active', 'completed'].map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                        filter === f
                                            ? 'bg-gray-900 text-white'
                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search goals..."
                                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Goals Grid */}
                    {filteredGoals.length > 0 ? (
                        <div className="grid gap-4">
                            {filteredGoals.map(renderGoalCard)}
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">
                                {searchQuery ? 'No goals match your search' : 'No goals yet'}
                            </p>
                            {!searchQuery && (
                                <button
                                    onClick={handleCreateGoal}
                                    className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    Create your first goal
                                </button>
                            )}
                        </div>
                    )}

            {/* Modal */}
            <GoalSettingModal
                isOpen={showModal}
                onClose={() => {
                    setShowModal(false);
                    setEditingGoal(null);
                }}
                subjects={subjects}
                onGoalCreated={() => {
                    fetchData();
                    setShowModal(false);
                    setEditingGoal(null);
                }}
            />
        </div>
    );
};

export default Goals;
