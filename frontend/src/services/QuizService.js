import api from '@/services/api';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * QuizService — adaptive quiz API layer.
 *
 * Single entry point for all adaptive quiz interactions.
 * user_id is read from the auth store and sent in every request body.
 * Falls back to 'anonymous' when the user is not authenticated.
 *
 * Both paths ultimately call engine /quiz/next or /quiz/submit-answer,
 * which delegate all logic to quiz_manager.py.
 */
export const QuizService = {
    /**
     * Fetch the next adaptive question.
     *
     * - No opts → start of session, no student model update.
     * - opts.isCorrect provided → record answer, update model, return next question.
     *
     * @param {string}      subjectId
     * @param {string|null} topic
     * @param {string}      language
     * @param {number}      topK
     * @param {{ isCorrect?: boolean, responseTime?: number }} opts
     */
    nextQuestion: (subjectId, topic = null, language = 'en', topK = 5, opts = {}) => {
        const userId = useAuthStore.getState().data.user?.id?.toString() ?? 'anonymous';

        if (opts.isCorrect !== undefined) {
            return api.post('/quiz/submit-answer', {
                user_id: userId,
                subject_id: subjectId,
                topic: topic || null,
                language,
                top_k: topK,
                is_correct: Boolean(opts.isCorrect),
                response_time: Number(opts.responseTime) || 0,
            });
        }

        return api.post('/quiz/next', {
            user_id: userId,
            subject_id: subjectId,
            topic: topic || null,
            language,
            top_k: topK,
        });
    },
};

export default QuizService;
