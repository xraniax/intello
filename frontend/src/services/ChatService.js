import api from '@/services/api';
import { API_URL, authFetch } from '@/services/api';

/**
 * ChatService
 * Handles all chat-related API interactions: sessions, messages, streaming.
 */
export const ChatService = {
    // ─── Sessions ─────────────────────────────────────────────────────────────

    getSessions: (subjectId) =>
        api.get('/chat/sessions', { params: { subjectId } }),

    createSession: (subjectId, title = 'New Chat') =>
        api.post('/chat/sessions', { subjectId, title }),

    renameSession: (id, title) =>
        api.patch(`/chat/sessions/${id}`, { title }),

    deleteSession: (id) =>
        api.delete(`/chat/sessions/${id}`),

    // ─── Messages ─────────────────────────────────────────────────────────────

    getMessages: (sessionId) =>
        api.get(`/chat/sessions/${sessionId}/messages`),

    updateFeedback: (messageId, sessionId, feedback) =>
        api.patch(`/chat/messages/${messageId}/feedback`, { sessionId, feedback }),

    updateBookmark: (messageId, sessionId, bookmarked) =>
        api.patch(`/chat/messages/${messageId}/bookmark`, { sessionId, bookmarked }),

    getBookmarks: (subjectId) =>
        api.get('/chat/bookmarks', { params: { subjectId } }),

    // ─── Streaming chat ────────────────────────────────────────────────────────

    /**
     * streamChat — opens an SSE connection to POST /chat/stream.
     *
     * Calls:
     *   onSession({ session, userMessageId })  — immediately after connection
     *   onToken(text)                           — each streamed token
     *   onDone({ messageId, sessionId, sources, confidence })
     *   onError(message)
     */
    streamChat: async ({
        sessionId,
        subjectId,
        question,
        history = [],
        materialIds = [],
        signal,
        onSession,
        onToken,
        onDone,
        onError,
    }) => {
        const response = await authFetch(`${API_URL}/chat/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId,
                subjectId,
                question,
                conversation_history: history,
                materialIds,
            }),
            signal,
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.message || `Stream failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Split on double-newline (SSE event boundary)
            const parts = buffer.split('\n\n');
            buffer = parts.pop(); // last part may be incomplete

            for (const part of parts) {
                const lines = part.split('\n');
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim();
                    if (!raw || raw === '[DONE]') continue;

                    try {
                        const event = JSON.parse(raw);
                        if (event.type === 'session') onSession?.(event);
                        else if (event.type === 'token') onToken?.(event.text);
                        else if (event.type === 'done') onDone?.(event);
                        else if (event.type === 'error') onError?.(event.message);
                    } catch (_) {}
                }
            }
        }

        // Flush any remaining buffer
        if (buffer) {
            const lines = buffer.split('\n');
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const raw = line.slice(6).trim();
                if (!raw) continue;
                try {
                    const event = JSON.parse(raw);
                    if (event.type === 'session') onSession?.(event);
                    else if (event.type === 'token') onToken?.(event.text);
                    else if (event.type === 'done') onDone?.(event);
                    else if (event.type === 'error') onError?.(event.message);
                } catch (_) {}
            }
        }
    },
};

export default ChatService;
