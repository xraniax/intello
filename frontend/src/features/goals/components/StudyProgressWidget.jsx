import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Target, Flame, Clock, TrendingUp, Plus, ChevronRight, Trophy } from 'lucide-react';
import { goalService, formatDuration, getProgressColor } from '@/services/GoalService';
import GoalSettingModal from './GoalSettingModal';
import toast from 'react-hot-toast';

const StudyProgressWidget = ({ subjects = [] }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [expandedGoal, setExpandedGoal] = useState(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const response = await goalService.getStats();
            setStats(response.data.data);
        } catch (error) {
            console.error('Failed to fetch goal stats:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGoalCreated = () => {
        fetchStats();
    };

    const handleLogTime = async (goalId) => {
        const minutes = prompt('How many minutes did you study?', '30');
        if (!minutes || isNaN(minutes) || minutes < 1) return;

        try {
            await goalService.logTime(parseInt(minutes));
            toast.success(`${minutes} minutes logged!`);
            fetchStats();
        } catch (error) {
            toast.error('Failed to log time');
        }
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                    <div className="h-20 bg-gray-100 rounded-xl"></div>
                    <div className="h-20 bg-gray-100 rounded-xl"></div>
                </div>
            </div>
        );
    }

    const hasGoals = stats?.weeklyProgress?.length > 0;

    if (!hasGoals) {
        return (
            <>
                <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Study Goals</h3>
                            <p className="text-sm text-gray-500">Set targets to track your progress</p>
                        </div>
                        <div className="p-2 bg-indigo-100 rounded-lg">
                            <Target className="w-5 h-5 text-indigo-600" />
                        </div>
                    </div>
                    
                    <div className="text-center py-8">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <Trophy className="w-8 h-8 text-indigo-400" />
                        </div>
                        <p className="text-gray-600 mb-4">No study goals yet</p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Set Your First Goal
                        </button>
                    </div>
                </div>

                <GoalSettingModal
                    isOpen={showModal}
                    onClose={() => setShowModal(false)}
                    subjects={subjects}
                    onGoalCreated={handleGoalCreated}
                />
            </>
        );
    }

    return (
        <>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                {/* Header */}
                <div className="flex items-start justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Study Goals</h3>
                        <p className="text-sm text-gray-500">
                            {stats?.active_goals || 0} active goal{stats?.active_goals !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Add new goal"
                    >
                        <Plus className="w-5 h-5" />
                    </button>
                </div>

                {/* Stats Overview */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-3 bg-orange-50 rounded-xl">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Flame className="w-4 h-4 text-orange-500" />
                            <span className="text-lg font-bold text-gray-900">
                                {stats?.current_streak || 0}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">Day Streak</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded-xl">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-lg font-bold text-gray-900">
                                {formatDuration(stats?.weeklyProgress?.[0]?.current || 0)}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">This Week</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                        <div className="flex items-center justify-center gap-1 mb-1">
                            <TrendingUp className="w-4 h-4 text-green-500" />
                            <span className="text-lg font-bold text-gray-900">
                                {Math.round(stats?.avg_completion || 0)}%
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">Avg Progress</p>
                    </div>
                </div>

                {/* Progress Bars */}
                <div className="space-y-4">
                    {stats?.weeklyProgress?.slice(0, 3).map((goal) => (
                        <div
                            key={goal.id}
                            className="group cursor-pointer"
                            onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-700">
                                        {goal.title}
                                    </span>
                                    {goal.percentage >= 100 && (
                                        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                                            Done!
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className={`text-sm font-medium ${getProgressColor(goal.percentage)}`}>
                                        {goal.percentage}%
                                    </span>
                                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${
                                        expandedGoal === goal.id ? 'rotate-90' : ''
                                    }`} />
                                </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(100, goal.percentage)}%` }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                    className={`h-full rounded-full ${
                                        goal.percentage >= 100
                                            ? 'bg-green-500'
                                            : goal.percentage >= 50
                                                ? 'bg-blue-500'
                                                : 'bg-indigo-500'
                                    }`}
                                />
                            </div>

                            {/* Expanded Details */}
                            {expandedGoal === goal.id && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-3 p-3 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-500">
                                            {goal.type === 'study_time' 
                                                ? `${formatDuration(goal.current)} of ${formatDuration(goal.target)}`
                                                : `${goal.current} of ${goal.target} completed`
                                            }
                                        </span>
                                        {goal.streak > 0 && (
                                            <span className="flex items-center gap-1 text-orange-600">
                                                <Flame className="w-3 h-3" />
                                                {goal.streak} streak
                                            </span>
                                        )}
                                    </div>
                                    {goal.subject && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            Subject: {goal.subject}
                                        </p>
                                    )}
                                    {goal.type === 'study_time' && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleLogTime(goal.id);
                                            }}
                                            className="mt-2 w-full py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        >
                                            + Log Study Time
                                        </button>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    ))}
                </div>

                {/* View All Link */}
                {stats?.weeklyProgress?.length > 3 && (
                    <button className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                        View all {stats.weeklyProgress.length} goals
                    </button>
                )}
            </div>

            <GoalSettingModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                subjects={subjects}
                onGoalCreated={handleGoalCreated}
            />
        </>
    );
};

export default StudyProgressWidget;
