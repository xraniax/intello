import api from '@/services/api';

export const subjectService = {
    // Subject Management
    getAll: () => api.get('/subjects'),
    getOne: (id) => api.get(`/subjects/${id}`),
    create: (name, description) => api.post('/subjects', { name, description }),
    rename: (id, name) => api.patch(`/subjects/${id}`, { name }),
    delete: (id) => api.delete(`/subjects/${id}`),

    // Subject Materials (Documents)
    getMaterials: (subjectId) => api.get('/materials/history', { params: { subjectId } }),
    deleteMaterial: (id) => api.delete(`/materials/${id}`),
    uploadMaterial: (data) => {
        const config = data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {};
        return api.post('/materials/upload', data, config);
    },
    getHistory: () => api.get('/materials/history'),
    cancel: (id) => api.post(`/materials/${id}/cancel`),
    getSettings: () => api.get('/materials/settings'),


    // AI Interactions
    chat: (materialIds, question) => api.post('/materials/chat-combined', { materialIds, question }),
    generate: (materialIds, taskType, subjectId, genOptions) => api.post('/materials/generate-combined', { materialIds, taskType, subjectId, genOptions }),
    sync: (id) => api.get(`/materials/${id}/sync`),
    streamMaterial: (id, onChunk, onComplete, onError) => {
        const token = localStorage.getItem('token');
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
        const url = `${API_URL}/materials/${id}/stream`;

        const controller = new AbortController();

        fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: controller.signal
        }).then(response => {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            function process() {
                reader.read().then(({ done, value }) => {
                    if (done) {
                        onComplete();
                        return;
                    }

                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const jsonStr = line.replace('data: ', '').trim();
                            if (!jsonStr) continue;

                            try {
                                const data = JSON.parse(jsonStr);
                                if (data.chunk) onChunk(data.chunk);
                                if (data.is_final) {
                                    onComplete();
                                    controller.abort();
                                    return;
                                }
                            } catch (e) {
                                // Handle partial JSON
                            }
                        }
                    }
                    process();
                }).catch(err => {
                    if (err.name !== 'AbortError') onError(err);
                });
            }
            process();
        }).catch(err => {
            if (err.name !== 'AbortError') onError(err);
        });

        return () => controller.abort();
    },
    // Exams
    generateExam: (payload) => api.post('/exams/generate', payload),
    saveAttempt: (payload) => api.post('/exams/attempts/save', payload),
    getAttempt: (examId) => api.get(`/exams/attempts/${examId}`),
    submitExam: (payload) => api.post('/exams/submit', payload),
};

export default subjectService;
