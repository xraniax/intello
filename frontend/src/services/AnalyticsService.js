import api from './api.js';

const AnalyticsService = {

    // ── Write ──────────────────────────────────────────────────────────────────

    async recordQuizAttempt(payload) {
        const { data } = await api.post('/analytics/quiz-attempt', payload);
        return data.data;
    },

    async recordFlashcardReview(payload) {
        const { data } = await api.post('/analytics/flashcard-review', payload);
        return data.data;
    },

    async recordExamAttempt(payload) {
        const { data } = await api.post('/analytics/exam-attempt', payload);
        return data.data;
    },

    // ── Read ───────────────────────────────────────────────────────────────────

    async getDashboard(subjectId, { refresh = false } = {}) {
        const { data } = await api.get(`/analytics/${subjectId}/dashboard`, {
            params: refresh ? { refresh: 'true' } : {},
        });
        return data.data;
    },

    async getSummary(subjectId) {
        const { data } = await api.get(`/analytics/${subjectId}/summary`);
        return data.data;
    },

    async getBulkSummaries(subjectIds) {
        const { data } = await api.post('/analytics/summaries', { subjectIds });
        return data.data;
    },

    async getConcepts(subjectId, { sort = 'crs', order = 'desc', state = null, minInteractions = 0 } = {}) {
        const params = { sort, order, minInteractions };
        if (state) params.state = state;
        const { data } = await api.get(`/analytics/${subjectId}/concepts`, { params });
        return data.data;
    },

    async getWeakConcepts(subjectId, { limit = 10, state = null } = {}) {
        const params = { limit };
        if (state) params.state = state;
        const { data } = await api.get(`/analytics/${subjectId}/concepts/weak`, { params });
        return data.data;
    },

    async getConceptDetail(subjectId, conceptName) {
        const { data } = await api.get(`/analytics/${subjectId}/concepts/${encodeURIComponent(conceptName)}`);
        return data.data;
    },

    async getProgress(subjectId, { from = null, to = null, granularity = 'week', sources = null } = {}) {
        const params = { granularity };
        if (from) params.from = from;
        if (to) params.to = to;
        if (sources) params.sources = Array.isArray(sources) ? sources.join(',') : sources;
        const { data } = await api.get(`/analytics/${subjectId}/progress`, { params });
        return data.data;
    },

    async getProgressConcepts(subjectId, { from = null, to = null, granularity = 'week' } = {}) {
        const params = { granularity };
        if (from) params.from = from;
        if (to) params.to = to;
        const { data } = await api.get(`/analytics/${subjectId}/progress/concepts`, { params });
        return data.data;
    },

    async getProgressExams(subjectId, { from = null, to = null } = {}) {
        const params = {};
        if (from) params.from = from;
        if (to) params.to = to;
        const { data } = await api.get(`/analytics/${subjectId}/progress/exams`, { params });
        return data.data;
    },
};

export default AnalyticsService;
