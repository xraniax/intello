import { create } from 'zustand';
import { subjectService } from '../features/subjects/services/SubjectService';
import { COMPLETED, FAILED, PROCESSING, SUCCESS, normalizeStatus } from '../constants/statusConstants';
import toast from 'react-hot-toast';
import { useUIStore } from './useUIStore';
import { useAuthStore } from './useAuthStore';

const pollingIntervals = new Map();

export const useMaterialStore = create((set, get) => ({
    data: {
        materials: [],
        jobProgress: null, // { jobId, materialId, stage, progress, message, result }
        isPublic: false
    },
    error: null,
    actions: {
        setJobProgress: (progress) =>
            set((state) => ({
                ...state,
                data: { ...state.data, jobProgress: progress }
            })),

        clearJobProgress: () =>
            set((state) => ({
                ...state,
                data: { ...state.data, jobProgress: null }
            })),

        fetchMaterials: async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                set((state) => ({ ...state, data: { ...state.data, materials: [], isPublic: true }, error: null }));
                return [];
            }
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('materials', true, 'Loading your materials...', false);
            set({ error: null });
            try {
                const res = await subjectService.getHistory();
                const materials = res.data.data || [];
                set((state) => ({
                    ...state,
                    error: null,
                    data: { ...state.data, materials, isPublic: false }
                }));
                return materials;
            } catch (err) {
                set({ error: err.message || 'Failed to fetch materials' });
                throw err;
            } finally {
                uiActions.setLoading('materials', false);
            }
        },

        uploadMaterial: async (formData) => {
            const user = useAuthStore.getState().data.user;
            if (!user) {
                useUIStore.getState().actions.setModal('authPrompt');
                return;
            }
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('upload', true, 'Uploading document...', false);
            uiActions.clearError('upload');
            set({ error: null });

            try {
                const res = await subjectService.uploadMaterial(formData);
                const material = res.data.data;
                const status = normalizeStatus(material.status);

                if (material.job_id && status === PROCESSING) {
                    get().actions.startPolling(material.id);
                } else {
                    set((state) => ({
                        ...state,
                        data: { ...state.data, jobProgress: null }
                    }));
                    await get().actions.fetchMaterials();
                }

                toast.success('Document seeded! AI is cultivating your material...');
                return material;
            } catch (err) {
                const message = err.message || 'Upload failed';
                const fieldErrors = err.validationErrors || {};
                set((state) => ({
                    ...state,
                    error: message,
                    data: { ...state.data, jobProgress: null }
                }));
                uiActions.setError('upload', message);
                throw { message, fieldErrors };
            } finally {
                uiActions.setLoading('upload', false);
            }
        },

        clearPolling: (materialId) => {
            const intervalId = pollingIntervals.get(materialId);
            if (intervalId) {
                clearInterval(intervalId);
                pollingIntervals.delete(materialId);
            }
        },

        clearAllPolling: () => {
            for (const intervalId of pollingIntervals.values()) {
                clearInterval(intervalId);
            }
            pollingIntervals.clear();
        },

        cancelJob: async (materialId) => {
            const user = useAuthStore.getState().data.user;
            if (!user) {
                useUIStore.getState().actions.setModal('authPrompt');
                return;
            }
            try {
                await subjectService.cancel(materialId);
                set((state) => ({
                    ...state,
                    data: { ...state.data, jobProgress: null }
                }));
                await get().actions.fetchMaterials();
            } catch (err) {
                set({ error: err.message || 'Failed to cancel job' });
            }
        },

        startPolling: async (materialId) => {
            if (pollingIntervals.has(materialId)) return;

            const startTime = Date.now();
            const MAX_POLLING_MS = 600000; // 10 minutes timeout

            const intervalId = setInterval(async () => {
                if (Date.now() - startTime > MAX_POLLING_MS) {
                    console.warn(`[MaterialStore] Polling timeout for ${materialId}`);
                    get().actions.clearPolling(materialId);
                    set((state) => ({
                        ...state,
                        data: {
                            ...state.data,
                            jobProgress: {
                                stage: FAILED.toLowerCase(),
                                progress: 100,
                                message: 'Generation session timed out. Please try again.'
                            }
                        }
                    }));
                    return;
                }

                try {
                    const response = await subjectService.sync(materialId);
                    if (!response?.data?.data) return;

                    const material = response.data.data;
                    const status = normalizeStatus(material.status);

                    if (status === COMPLETED || status === SUCCESS) {
                        get().actions.clearPolling(materialId);
                        
                        if (material.type !== 'document') {
                            const result = material.ai_generated_content || material.content;
                            set((state) => ({
                                ...state,
                                data: {
                                    ...state.data,
                                    jobProgress: {
                                        stage: 'success',
                                        progress: 100,
                                        message: 'Refining knowledge complete!',
                                        result: result,
                                        materialId: materialId
                                    }
                                }
                            }));
                        }
                        await get().actions.fetchMaterials();
                    } else if (status === FAILED) {
                        get().actions.clearPolling(materialId);
                        set((state) => ({
                            ...state,
                            data: {
                                ...state.data,
                                jobProgress: {
                                    stage: FAILED.toLowerCase(),
                                    progress: 100,
                                    message: material.error_message || 'Processing failed'
                                }
                            }
                        }));
                        setTimeout(() => {
                            set((state) => ({
                                ...state,
                                data: { ...state.data, jobProgress: null }
                            }));
                        }, 5000);
                    } else {
                        const stageMessage = material.stage_message || '';
                        let stage = status.toLowerCase();
                        let progress = status === PROCESSING ? 40 : 10;

                        if (stageMessage.toLowerCase().includes('ocr')) { stage = 'ocr'; progress = 30; }
                        else if (stageMessage.toLowerCase().includes('chunk')) { stage = 'chunking'; progress = 60; }
                        else if (stageMessage.toLowerCase().includes('embed')) { stage = 'embedding'; progress = 90; }

                        set((state) => ({
                            ...state,
                            data: {
                                ...state.data,
                                jobProgress: {
                                    jobId: material.job_id,
                                    materialId: material.id,
                                    stage,
                                    progress,
                                    message: stageMessage || 'AI is cultivating your material...'
                                }
                            }
                        }));
                    }
                } catch (err) {
                    console.error('[MaterialStore] Polling loop error:', err);
                    const msg = err.message === 'cyclic object value' 
                        ? 'Circular data error during sync' 
                        : (err.message || 'Polling error');
                    set({ error: msg });
                }
            }, 3000);
            pollingIntervals.set(materialId, intervalId);
            return intervalId;
        }
    }
}));
