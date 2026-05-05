import api from '@/services/api';

/**
 * Goal Service
 * API client for study goals and progress tracking
 */
export const goalService = {
    // ── Goal CRUD ────────────────────────────────────────────────────────────
    
    /** Get all goals for the current user */
    getAll: (params = {}) => api.get('/goals', { params }),
    
    /** Get a single goal by ID */
    getOne: (id) => api.get(`/goals/${id}`),
    
    /** Create a new goal */
    create: (goalData) => api.post('/goals', goalData),
    
    /** Update a goal */
    update: (id, updates) => api.patch(`/goals/${id}`, updates),
    
    /** Delete a goal */
    delete: (id) => api.delete(`/goals/${id}`),
    
    // ── Goal Statistics ────────────────────────────────────────────────────────
    
    /** Get goal statistics for dashboard */
    getStats: () => api.get('/goals/stats'),
    
    /** Get current study streak */
    getStreak: () => api.get('/goals/streak'),
    
    // ── Study Sessions ───────────────────────────────────────────────────────
    
    /** Start a study session */
    startSession: (sessionData) => api.post('/goals/sessions/start', sessionData),
    
    /** End a study session */
    endSession: (sessionId, sessionData = {}) => 
        api.post(`/goals/sessions/${sessionId}/end`, sessionData),
    
    /** Get study session history */
    getHistory: (params = {}) => api.get('/goals/sessions/history', { params }),
    
    // ── AI Study Plan ────────────────────────────────────────────────────────

    /** Generate an AI study plan */
    generatePlan: (planData) => api.post('/goals/plan/generate', planData),

    /** Activate the generated study plan */
    activatePlan: (planData) => api.post('/goals/plan/activate', planData),
    
    // ── Quick Time Logging ────────────────────────────────────────────────────
    
    /** Quick log study time without session tracking */
    logTime: (minutes, subjectId = null) => 
        api.post('/goals/log-time', { minutes, subjectId }),
};

/**
 * Goal Presets
 * Common goal configurations for quick setup
 */
export const goalPresets = {
    /** Daily 30-minute study goal */
    daily30Min: {
        title: 'Daily Study (30 min)',
        description: 'Study for at least 30 minutes every day',
        goalType: 'study_time',
        goalPeriod: 'daily',
        targetValue: 30,
        reminderDays: [1, 2, 3, 4, 5, 6, 7],
        reminderTime: '18:00'
    },
    
    /** Weekly 5-hour study goal */
    weekly5Hours: {
        title: 'Weekly Study (5 hours)',
        description: 'Study for 5 hours total each week',
        goalType: 'study_time',
        goalPeriod: 'weekly',
        targetValue: 300, // 5 hours in minutes
        reminderDays: [1, 3, 5], // Mon, Wed, Fri
        reminderTime: '09:00'
    },
    
    /** Complete 3 materials per week */
    weekly3Materials: {
        title: 'Weekly Materials (3)',
        description: 'Complete 3 study materials each week',
        goalType: 'material_completion',
        goalPeriod: 'weekly',
        targetValue: 3,
        reminderDays: [7], // Sunday
        reminderTime: '10:00'
    },
    
    /** Take 2 quizzes per week */
    weekly2Quizzes: {
        title: 'Weekly Practice (2 quizzes)',
        description: 'Take 2 practice quizzes each week',
        goalType: 'quiz_completion',
        goalPeriod: 'weekly',
        targetValue: 2,
        reminderDays: [3, 6], // Wed, Sat
        reminderTime: '14:00'
    }
};

/**
 * Goal Type Labels
 */
export const goalTypeLabels = {
    study_time: 'Study Time',
    material_completion: 'Materials',
    quiz_completion: 'Quizzes',
    exam_score: 'Exam Score'
};

/**
 * Goal Period Labels
 */
export const goalPeriodLabels = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly'
};

/**
 * Format minutes as hours and minutes
 */
export const formatDuration = (minutes) => {
    if (!minutes || minutes <= 0) return '0 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/**
 * Get progress color based on percentage
 */
export const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'text-green-500';
    if (percentage >= 75) return 'text-blue-500';
    if (percentage >= 50) return 'text-yellow-500';
    if (percentage >= 25) return 'text-orange-500';
    return 'text-red-500';
};

/**
 * Day names for reminder configuration
 */
export const dayNames = [
    { value: 1, label: 'Mon', full: 'Monday' },
    { value: 2, label: 'Tue', full: 'Tuesday' },
    { value: 3, label: 'Wed', full: 'Wednesday' },
    { value: 4, label: 'Thu', full: 'Thursday' },
    { value: 5, label: 'Fri', full: 'Friday' },
    { value: 6, label: 'Sat', full: 'Saturday' },
    { value: 7, label: 'Sun', full: 'Sunday' }
];

export default goalService;
