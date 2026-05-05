import readline from 'readline';
import MaterialService from '../services/material.service.js';
import ChatSession from '../models/chatSession.model.js';
import ChatMessage from '../models/chatMessage.model.js';
import Subject from '../models/subject.model.js';
import engineClient from '../services/engine.client.js';
import asyncHandler from '../utils/asyncHandler.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ChatController {
    // ─── Standard (non-streaming) chat ────────────────────────────────────────

    static proxyChat = asyncHandler(async (req, res) => {
        const { subjectId, question, conversation_history, materialIds, sessionId } = req.body;

        if (!subjectId) { res.status(400); throw new Error('subjectId is required'); }
        if (!question) { res.status(400); throw new Error('question is required'); }

        const result = await MaterialService.chat(
            req.user.id,
            subjectId,
            question,
            conversation_history || [],
            materialIds || []
        );

        // Persist to session if one is active
        if (sessionId && UUID_PATTERN.test(sessionId)) {
            const session = await ChatSession.findById(sessionId, req.user.id);
            if (session) {
                await ChatMessage.create(session.id, 'user', question);
                await ChatMessage.create(
                    session.id, 'assistant',
                    result.answer || '',
                    result.sources || [],
                    result.confidence || 0
                );
                await ChatSession.touch(session.id, req.user.id);
            }
        }

        res.status(200).json({ status: 'success', data: result });
    });

    // ─── Streaming chat (SSE) ─────────────────────────────────────────────────

    static streamChat = asyncHandler(async (req, res) => {
        const { subjectId, question, conversation_history, materialIds, sessionId } = req.body;

        if (!subjectId) { res.status(400); throw new Error('subjectId is required'); }
        if (!question?.trim()) { res.status(400); throw new Error('question is required'); }

        // Verify subject ownership
        const subject = await Subject.findById(subjectId, req.user.id);
        if (!subject) { res.status(404); throw new Error('Subject not found or access denied'); }

        // Resolve or auto-create session
        let session;
        if (sessionId && UUID_PATTERN.test(sessionId)) {
            session = await ChatSession.findById(sessionId, req.user.id);
            if (!session) { res.status(404); throw new Error('Session not found'); }
        } else {
            const title = question.trim().slice(0, 80);
            session = await ChatSession.create(req.user.id, subjectId, title);
        }

        // Persist user message
        const userMsg = await ChatMessage.create(session.id, 'user', question.trim());

        // Set SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Announce session so the client knows IDs upfront
        res.write(`data: ${JSON.stringify({
            type: 'session',
            session: { id: session.id, title: session.title, created_at: session.created_at },
            userMessageId: userMsg.id
        })}\n\n`);

        const sanitizedHistory = (conversation_history || [])
            .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
            .map(m => ({ role: m.role, content: m.content.trim() }))
            .slice(-20);

        const validMaterialIds = (Array.isArray(materialIds) ? materialIds : [])
            .filter(id => typeof id === 'string' && UUID_PATTERN.test(id));

        let engineStream;
        let accumulatedContent = '';
        let finalSources = [];
        let finalConfidence = 0;
        let streamEnded = false;

        const finalize = async () => {
            if (streamEnded) return;
            streamEnded = true;

            try {
                const aiMsg = await ChatMessage.create(
                    session.id, 'assistant',
                    accumulatedContent || '',
                    finalSources,
                    finalConfidence,
                    false
                );
                await ChatSession.touch(session.id, req.user.id);

                if (!res.writableEnded) {
                    res.write(`data: ${JSON.stringify({
                        type: 'done',
                        messageId: aiMsg.id,
                        sessionId: session.id,
                        sources: finalSources,
                        confidence: finalConfidence
                    })}\n\n`);
                    res.end();
                }
            } catch (e) {
                console.error('[ChatController] finalize error:', e.message);
                if (!res.writableEnded) res.end();
            }
        };

        try {
            engineStream = await engineClient.post('/chat/stream', {
                subject_id: subjectId,
                question: question.trim(),
                conversation_history: sanitizedHistory,
                material_ids: validMaterialIds,
                top_k: 8,
                language: 'en',
            }, { responseType: 'stream', timeout: 300000 });

        } catch (engineErr) {
            console.error('[ChatController] Engine stream connect error:', engineErr.message);
            const errMsg = 'AI engine is temporarily unavailable.';
            await ChatMessage.create(session.id, 'assistant', errMsg, [], 0, true);
            await ChatSession.touch(session.id, req.user.id);
            if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({ type: 'error', message: errMsg })}\n\n`);
                res.end();
            }
            return;
        }

        const rl = readline.createInterface({ input: engineStream.data, crlfDelay: Infinity });

        rl.on('line', (line) => {
            if (!line.startsWith('data: ')) return;
            const raw = line.slice(6).trim();
            if (!raw || raw === '[DONE]') return;

            try {
                const event = JSON.parse(raw);

                if (event.type === 'token' && typeof event.text === 'string') {
                    accumulatedContent += event.text;
                    if (!res.writableEnded) {
                        res.write(`data: ${JSON.stringify({ type: 'token', text: event.text })}\n\n`);
                    }
                } else if (event.type === 'done') {
                    finalSources = event.sources || [];
                    finalConfidence = event.confidence || 0;
                } else if (event.type === 'error') {
                    if (!res.writableEnded) {
                        res.write(`data: ${JSON.stringify({ type: 'error', message: event.message })}\n\n`);
                    }
                }
            } catch (_) {}
        });

        rl.on('close', () => finalize());
        rl.on('error', () => finalize());

        // Client disconnected before stream finished — save partial response
        req.on('close', async () => {
            if (streamEnded) return;
            streamEnded = true;
            if (engineStream?.data?.destroy) engineStream.data.destroy();
            rl.close();
            if (accumulatedContent) {
                try {
                    await ChatMessage.create(session.id, 'assistant', accumulatedContent, [], 0);
                    await ChatSession.touch(session.id, req.user.id);
                } catch (e) {
                    console.error('[ChatController] partial save error:', e.message);
                }
            }
        });
    });

    // ─── Session CRUD ─────────────────────────────────────────────────────────

    static getSessions = asyncHandler(async (req, res) => {
        const { subjectId } = req.query;
        if (!subjectId) { res.status(400); throw new Error('subjectId is required'); }

        const sessions = await ChatSession.findBySubject(req.user.id, subjectId);
        res.status(200).json({ status: 'success', data: sessions });
    });

    static createSession = asyncHandler(async (req, res) => {
        const { subjectId, title } = req.body;
        if (!subjectId) { res.status(400); throw new Error('subjectId is required'); }

        const subject = await Subject.findById(subjectId, req.user.id);
        if (!subject) { res.status(404); throw new Error('Subject not found'); }

        const session = await ChatSession.create(req.user.id, subjectId, title || 'New Chat');
        res.status(201).json({ status: 'success', data: session });
    });

    static renameSession = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { title } = req.body;
        if (!title?.trim()) { res.status(400); throw new Error('title is required'); }

        const updated = await ChatSession.updateTitle(id, req.user.id, title.trim());
        if (!updated) { res.status(404); throw new Error('Session not found'); }

        res.status(200).json({ status: 'success', data: updated });
    });

    static deleteSession = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const deleted = await ChatSession.delete(id, req.user.id);
        if (!deleted) { res.status(404); throw new Error('Session not found'); }

        res.status(200).json({ status: 'success', message: 'Session deleted' });
    });

    // ─── Message retrieval ────────────────────────────────────────────────────

    static getMessages = asyncHandler(async (req, res) => {
        const { id } = req.params;

        const session = await ChatSession.findById(id, req.user.id);
        if (!session) { res.status(404); throw new Error('Session not found'); }

        const messages = await ChatMessage.findBySession(id);
        res.status(200).json({ status: 'success', data: messages });
    });

    // ─── Message actions ──────────────────────────────────────────────────────

    static updateFeedback = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { sessionId, feedback } = req.body;

        if (!sessionId || !['up', 'down', null].includes(feedback)) {
            res.status(400); throw new Error('sessionId and valid feedback required');
        }

        const session = await ChatSession.findById(sessionId, req.user.id);
        if (!session) { res.status(404); throw new Error('Session not found'); }

        const updated = await ChatMessage.updateFeedback(id, sessionId, feedback);
        if (!updated) { res.status(404); throw new Error('Message not found'); }

        res.status(200).json({ status: 'success', data: updated });
    });

    static updateBookmark = asyncHandler(async (req, res) => {
        const { id } = req.params;
        const { sessionId, bookmarked } = req.body;

        if (!sessionId || typeof bookmarked !== 'boolean') {
            res.status(400); throw new Error('sessionId and bookmarked boolean required');
        }

        const session = await ChatSession.findById(sessionId, req.user.id);
        if (!session) { res.status(404); throw new Error('Session not found'); }

        const updated = await ChatMessage.updateBookmark(id, sessionId, bookmarked);
        if (!updated) { res.status(404); throw new Error('Message not found'); }

        res.status(200).json({ status: 'success', data: updated });
    });

    static getBookmarks = asyncHandler(async (req, res) => {
        const { subjectId } = req.query;
        if (!subjectId) { res.status(400); throw new Error('subjectId is required'); }

        const subject = await Subject.findById(subjectId, req.user.id);
        if (!subject) { res.status(404); throw new Error('Subject not found or access denied'); }

        const bookmarks = await ChatMessage.findBookmarkedBySubject(req.user.id, subjectId);
        res.status(200).json({ status: 'success', data: bookmarks });
    });
}

export default ChatController;
