import api, { API_URL, authFetch } from '@/services/api';

/**
 * MaterialService
 * Orchestrates all material-related API interactions including uploads, 
 * generation, streaming, and lifecycle management (trash/recovery).
 */

export const MaterialService = {
    // Retrieval & Collections - now support pagination params
    getHistory: (params = {}) => api.get('/materials/history', { params }),
    getTrash: (params = {}) => api.get('/materials/trash', { params }),
    getSettings: () => api.get('/materials/settings'),
    getOne: (id) => api.get(`/materials/${id}`),

    // Lifecycle Actions
    upload: (data) => {
        const config = data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        return api.post('/materials/upload', data, config);
    },
    rename: (id, title) => api.patch(`/materials/${id}`, { title }),
    delete: (id) => api.delete(`/materials/${id}`),
    restore: (id) => api.post(`/materials/${id}/restore`),
    permanentDelete: (id) => api.delete(`/materials/${id}/permanent`),
    emptyTrash: () => api.delete('/materials/trash'),
    cancel: (id) => api.post(`/materials/${id}/cancel`),

    // AI Generation & Streaming
    generate: (materialIds, taskType, subjectId, genOptions) =>
        api.post('/materials/generate-combined', { materialIds, taskType, subjectId, genOptions }),

    generateStream: async (materialIds, taskType, subjectId, genOptions, signal) => {
        const response = await authFetch(`${API_URL}/materials/generate-combined/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
            },
            body: JSON.stringify({ materialIds, taskType, subjectId, genOptions }),
            signal,
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(detail || `Stream failed with status ${response.status}`);
        }

        return response;
    },

    sync: (id, signal) => api.get(`/materials/${id}/sync`, { signal }),

    chat: (materialIds, question) => api.post('/materials/chat-combined', { materialIds, question }),

    unifiedChat: (subjectId, question, history, materialIds = []) => 
        api.post('/chat', { subjectId, question, conversation_history: history, materialIds }),


    /**
     * streamMaterial — Standardized cancellable async primitive for AI streams.
     */
    stream: async (id, signal, onChunk, onComplete, onError) => {
        const url = `${API_URL}/materials/${id}/stream`;

        try {
            const response = await authFetch(url, {
                headers: { Accept: 'text/event-stream' },
                signal,
            });

            if (!response.ok) {
                onError(new Error(`Stream failed with status ${response.status}`));
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            // Buffer accumulates raw bytes across chunk boundaries before splitting on \n\n
            let sseBuffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (signal.aborted) return;
                if (done) break;

                sseBuffer += decoder.decode(value, { stream: true });

                // Split on double-newline to extract complete SSE events
                const events = sseBuffer.split('\n\n');
                sseBuffer = events.pop() ?? '';

                for (const eventBlock of events) {
                    for (const line of eventBlock.split('\n')) {
                        if (signal.aborted) return;
                        const trimmed = line.trim();
                        // Skip SSE comments (keep-alive) and non-data lines
                        if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) continue;

                        const jsonStr = trimmed.slice(5).trim();
                        if (!jsonStr) continue;

                        try {
                            const parsed = JSON.parse(jsonStr);
                            const status = String(parsed?.status || '').toUpperCase();
                            const isTerminalStatus = status === 'SUCCESS' || status === 'FAILURE' || status === 'REVOKED';
                            const isContentChunk = parsed.is_final || status === 'SUCCESS' || status === 'FAILURE';

                            if (parsed.chunk && isContentChunk) onChunk(parsed.chunk);

                            // Defensive terminal detection:
                            // some stream producers may send terminal statuses even if is_final is omitted.
                            if (parsed.is_final || isTerminalStatus) {
                                onComplete();
                                return;
                            }
                        } catch { /* malformed JSON in this line — skip */ }
                    }
                }
            }
            onComplete();
        } catch (err) {
            if (err.name === 'AbortError') return;
            onError(err);
        }
    },

    // Exams (System Insights)
    generateExam: (payload) => api.post('/exams/generate', payload),
    saveAttempt: (payload) => api.post('/exams/attempts/save', payload),
    getAttempt: (examId) => api.get(`/exams/attempts/${examId}`),
    submitExam: (payload) => api.post('/exams/submit', payload),
};

export default MaterialService;
