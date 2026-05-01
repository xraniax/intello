import MaterialService from '../services/material.service.js';
import asyncHandler from '../utils/asyncHandler.js';

class ChatController {
    /**
     * Proxies a chat request to the Python AI Engine via the Service layer.
     * 
     * Responsibilities:
     * - Parameter extraction (subjectId, question, history)
     * - Service invocation (includes subject ownership validation)
     * - Success/Error response mapping
     */
    static proxyChat = asyncHandler(async (req, res) => {
        const { subjectId, question, conversation_history } = req.body;

        if (!subjectId) {
            res.status(400);
            throw new Error('subjectId is required');
        }

        if (!question) {
            res.status(400);
            throw new Error('question is required');
        }

        // Call the service layer which handles subject validation and engine communication
        const result = await MaterialService.chat(
            req.user.id,
            subjectId,
            question,
            conversation_history || []
        );

        res.status(200).json({
            status: 'success',
            data: result
        });
    });
}

export default ChatController;
