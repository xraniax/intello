import api from '@/services/api';

/**
 * QuizService — adaptive quiz API layer.
 *
 * Single entry point for all adaptive quiz interactions.
 * userId is injected server-side from JWT — never sent from the client.
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
        if (opts.isCorrect !== undefined) {
            return api.post('/quiz/submit-answer', {
                subject_id: subjectId,
                topic: topic || null,
                language,
                top_k: topK,
                is_correct: Boolean(opts.isCorrect),
                response_time: Number(opts.responseTime) || 0,
            });
        }

        return api.post('/quiz/start', {
            subject_id: subjectId,
            topic: topic || null,
            language,
            top_k: topK,
        });
    },
};

export default QuizService;
