import api from '@/services/api';

const RatingService = {
    /** Submit or update a rating */
    submit: (payload) => api.post('/ratings', payload),

    /** true if the user has already rated this material */
    checkExists: (materialId) => api.get(`/ratings/check/${materialId}`),

    /** The authenticated user's own rating for a material (or null) */
    getMyRating: (materialId) => api.get(`/ratings/${materialId}`),

    /** Material-level analytics (admin) */
    getMaterialAnalytics: (materialId) => api.get(`/ratings/${materialId}/analytics`),

    /** All materials in a subject with their rating summaries (admin) */
    getSubjectAnalytics: (subjectId) => api.get(`/ratings/subject/${subjectId}/analytics`),

    /** Platform-wide admin overview */
    getAdminOverview: (params = {}) => api.get('/ratings/admin/overview', { params }),

    /** Valid issue flag keys */
    getValidFlags: () => api.get('/ratings/meta/flags'),
};

export default RatingService;
