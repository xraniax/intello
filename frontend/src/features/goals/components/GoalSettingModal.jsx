import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, Clock, BookOpen, CheckCircle, Calendar, Bell } from 'lucide-react';
import { goalService, goalPresets, goalTypeLabels, goalPeriodLabels, dayNames } from '@/services/GoalService';
import toast from 'react-hot-toast';

const GoalSettingModal = ({ isOpen, onClose, subjects = [], onGoalCreated }) => {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        goalType: 'study_time',
        goalPeriod: 'weekly',
        targetValue: 60,
        subjectId: '',
        reminderTime: '',
        reminderDays: [1, 2, 3, 4, 5]
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep(1);
            setFormData({
                title: '',
                description: '',
                goalType: 'study_time',
                goalPeriod: 'weekly',
                targetValue: 60,
                subjectId: '',
                reminderTime: '',
                reminderDays: [1, 2, 3, 4, 5]
            });
        }
    }, [isOpen]);

    const applyPreset = (presetKey) => {
        const preset = goalPresets[presetKey];
        if (preset) {
            setFormData(prev => ({
                ...prev,
                ...preset,
                subjectId: prev.subjectId
            }));
            setStep(2);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleReminderDay = (day) => {
        setFormData(prev => ({
            ...prev,
            reminderDays: prev.reminderDays.includes(day)
                ? prev.reminderDays.filter(d => d !== day)
                : [...prev.reminderDays, day].sort()
        }));
    };

    const getTargetLabel = () => {
        switch (formData.goalType) {
            case 'study_time':
                return formData.goalPeriod === 'daily' ? 'Minutes per day' : 'Minutes per week';
            case 'material_completion':
                return formData.goalPeriod === 'daily' ? 'Materials per day' : 'Materials per week';
            case 'quiz_completion':
                return formData.goalPeriod === 'daily' ? 'Quizzes per day' : 'Quizzes per week';
            default:
                return 'Target value';
        }
    };

    const getTargetMin = () => formData.goalType === 'study_time' ? 15 : 1;
    const getTargetMax = () => formData.goalType === 'study_time' ? 600 : 50;
    const getTargetStep = () => formData.goalType === 'study_time' ? 15 : 1;

    const handleSubmit = async () => {
        if (!formData.title.trim()) {
            toast.error('Please enter a goal title');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                goalType: formData.goalType,
                goalPeriod: formData.goalPeriod,
                targetValue: parseInt(formData.targetValue),
                subjectId: formData.subjectId || null,
                reminderTime: formData.reminderTime || null,
                reminderDays: formData.reminderDays.length > 0 ? formData.reminderDays : null
            };

            const response = await goalService.create(payload);
            toast.success('Goal created successfully!');
            onGoalCreated?.(response.data.data);
            onClose();
        } catch (error) {
            toast.error(error.message || 'Failed to create goal');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/50"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 rounded-lg">
                                <Target className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900">
                                    {step === 1 ? 'Choose a Goal Template' : 'Customize Your Goal'}
                                </h2>
                                <p className="text-sm text-gray-500">
                                    {step === 1 ? 'Quick start with a preset or customize your own' : 'Set your target and schedule'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 max-h-[70vh] overflow-y-auto">
                        {step === 1 ? (
                            <div className="space-y-3">
                                {/* Preset Cards */}
                                <button
                                    onClick={() => applyPreset('daily30Min')}
                                    className="w-full p-4 text-left border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                                            <Clock className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900">Daily Study (30 min)</h3>
                                            <p className="text-sm text-gray-500 mt-1">Study for at least 30 minutes every day</p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                                <span className="px-2 py-1 bg-gray-100 rounded">Daily</span>
                                                <span className="px-2 py-1 bg-gray-100 rounded">30 min/day</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => applyPreset('weekly5Hours')}
                                    className="w-full p-4 text-left border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                                            <Clock className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900">Weekly Study (5 hours)</h3>
                                            <p className="text-sm text-gray-500 mt-1">Study for 5 hours total each week</p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                                <span className="px-2 py-1 bg-gray-100 rounded">Weekly</span>
                                                <span className="px-2 py-1 bg-gray-100 rounded">5 hours/week</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => applyPreset('weekly3Materials')}
                                    className="w-full p-4 text-left border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                                            <BookOpen className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900">Complete Materials (3/week)</h3>
                                            <p className="text-sm text-gray-500 mt-1">Complete 3 study materials each week</p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                                <span className="px-2 py-1 bg-gray-100 rounded">Weekly</span>
                                                <span className="px-2 py-1 bg-gray-100 rounded">3 materials/week</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => applyPreset('weekly2Quizzes')}
                                    className="w-full p-4 text-left border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all group"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className="p-3 bg-orange-100 rounded-lg group-hover:bg-orange-200 transition-colors">
                                            <CheckCircle className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="font-medium text-gray-900">Practice Quizzes (2/week)</h3>
                                            <p className="text-sm text-gray-500 mt-1">Take 2 practice quizzes each week</p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                                                <span className="px-2 py-1 bg-gray-100 rounded">Weekly</span>
                                                <span className="px-2 py-1 bg-gray-100 rounded">2 quizzes/week</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                <div className="relative py-4">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-gray-200"></div>
                                    </div>
                                    <div className="relative flex justify-center">
                                        <span className="px-3 bg-white text-sm text-gray-500">or</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setStep(2)}
                                    className="w-full p-4 text-left border-2 border-dashed border-gray-300 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/30 transition-all"
                                >
                                    <div className="flex items-center justify-center gap-2 text-gray-600">
                                        <Target className="w-5 h-5" />
                                        <span className="font-medium">Create Custom Goal</span>
                                    </div>
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Title */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Goal Title
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => handleInputChange('title', e.target.value)}
                                        placeholder="e.g., Master Calculus Chapter 3"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description (optional)
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => handleInputChange('description', e.target.value)}
                                        placeholder="What do you want to achieve?"
                                        rows={2}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                                    />
                                </div>

                                {/* Goal Type & Period */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Goal Type
                                        </label>
                                        <select
                                            value={formData.goalType}
                                            onChange={(e) => handleInputChange('goalType', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                        >
                                            {Object.entries(goalTypeLabels).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Time Period
                                        </label>
                                        <select
                                            value={formData.goalPeriod}
                                            onChange={(e) => handleInputChange('goalPeriod', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                        >
                                            {Object.entries(goalPeriodLabels).map(([key, label]) => (
                                                <option key={key} value={key}>{label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Target Value */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        {getTargetLabel()}
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min={getTargetMin()}
                                            max={getTargetMax()}
                                            step={getTargetStep()}
                                            value={formData.targetValue}
                                            onChange={(e) => handleInputChange('targetValue', parseInt(e.target.value))}
                                            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                        <div className="w-20 px-3 py-2 bg-gray-100 rounded-lg text-center font-medium text-gray-700">
                                            {formData.goalType === 'study_time' 
                                                ? `${formData.targetValue}m`
                                                : formData.targetValue
                                            }
                                        </div>
                                    </div>
                                </div>

                                {/* Subject */}
                                {subjects.length > 0 && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Subject (optional)
                                        </label>
                                        <select
                                            value={formData.subjectId}
                                            onChange={(e) => handleInputChange('subjectId', e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                                        >
                                            <option value="">All subjects</option>
                                            {subjects.map(subject => (
                                                <option key={subject.id} value={subject.id}>{subject.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Reminders */}
                                <div className="border-t border-gray-100 pt-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Bell className="w-4 h-4 text-gray-400" />
                                        <span className="text-sm font-medium text-gray-700">Reminders</span>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mb-3">
                                        <input
                                            type="time"
                                            value={formData.reminderTime}
                                            onChange={(e) => handleInputChange('reminderTime', e.target.value)}
                                            className="px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                        <span className="text-sm text-gray-500">
                                            {formData.reminderTime ? 'Remind me at this time' : 'No reminder set'}
                                        </span>
                                    </div>

                                    {formData.reminderTime && (
                                        <div className="flex flex-wrap gap-2">
                                            {dayNames.map(day => (
                                                <button
                                                    key={day.value}
                                                    onClick={() => toggleReminderDay(day.value)}
                                                    className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                                                        formData.reminderDays.includes(day.value)
                                                            ? 'bg-indigo-100 text-indigo-700 font-medium'
                                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {day.label}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                        {step === 2 ? (
                            <>
                                <button
                                    onClick={() => setStep(1)}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                                >
                                    Back
                                </button>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={loading || !formData.title.trim()}
                                        className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        {loading ? 'Creating...' : 'Create Goal'}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <span className="text-sm text-gray-400">
                                    Choose a preset or customize
                                </span>
                            </>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default GoalSettingModal;
