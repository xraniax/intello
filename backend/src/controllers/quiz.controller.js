import engineClient from '../services/engine.client.js';
import asyncHandler from '../utils/asyncHandler.js';

class QuizController {
    /**
     * Start an adaptive quiz session — returns first question without touching student model.
     * Proxies to engine POST /quiz/next.
     */
    static start = asyncHandler(async (req, res) => {
        const { subject_id, topic, language, top_k } = req.body;
        const user_id = String(req.user.id);

        const engineRes = await engineClient.post('/quiz/next', {
            user_id,
            subject_id,
            topic: topic || null,
            language: language || 'en',
            top_k: top_k || 5,
        });

        res.status(200).json({ status: 'success', data: engineRes.data });
    });

    /**
     * Submit an answer and receive the next adaptive question.
     * Proxies to engine POST /quiz/submit-answer (which updates student model via quiz_manager).
     */
    static submitAnswer = asyncHandler(async (req, res) => {
        const { subject_id, topic, is_correct, response_time, language, top_k } = req.body;
        const user_id = String(req.user.id);

        const engineRes = await engineClient.post('/quiz/submit-answer', {
            user_id,
            subject_id,
            topic: topic || null,
            is_correct: Boolean(is_correct),
            response_time: Number(response_time) || 0,
            language: language || 'en',
            top_k: top_k || 5,
        });

        res.status(200).json({ status: 'success', data: engineRes.data });
    });
}

export default QuizController;
