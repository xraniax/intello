import { create } from 'zustand';
import { materialService } from '../services/api';
import { COMPLETED, FAILED, PROCESSING, SUCCESS, normalizeStatus } from '../constants/statusConstants';
import { useUIStore } from './useUIStore';

const pollingIntervals = new Map();

export const useMaterialStore = create((set, get) => ({
    data: {
        materials: [],
        jobProgress: null // { jobId, materialId, stage, progress, message }
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
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('materials', true, 'Loading your materials...', false);
            set({ error: null });
            try {
                const res = await materialService.getHistory();
                const materials = res.data.data || [];
                set((state) => ({
                    ...state,
                    error: null,
                    data: { ...state.data, materials }
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
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('upload', true, 'Uploading document...', true);
            uiActions.clearError('upload');
            set({ error: null });

            try {
                const res = await materialService.upload(formData);
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

                return material;
            } catch (err) {
                const message = err.message || 'Upload failed';
                set((state) => ({
                    ...state,
                    error: message,
                    data: { ...state.data, jobProgress: null }
                }));
                uiActions.setError('upload', message);
                throw err;
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
            try {
                await materialService.cancel(materialId);
                set((state) => ({
                    ...state,
                    data: { ...state.data, jobProgress: null }
                }));
                await get().actions.fetchMaterials();
            } catch (err) {
                set({ error: err.message || 'Failed to cancel job' });
            }
        },

        startPolling: (materialId) => {
            // Prevent duplicated pollers when uploads are retried quickly.
            get().actions.clearPolling(materialId);

            const intervalId = setInterval(async () => {
                try {
                    const res = await materialService.sync(materialId);
                    const material = res.data.data;
                    const status = normalizeStatus(material.status);

                    if (status === COMPLETED || status === SUCCESS) {
                        get().actions.clearPolling(materialId);
                        set((state) => ({
                            ...state,
                            data: { ...state.data, jobProgress: null }
                        }));
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
                        // Map status or stage_message to granular stages
                        const stageMessage = material.stage_message || '';
                        let stage = status.toLowerCase();
                        let progress = status === PROCESSING ? 40 : 10;

                        if (stageMessage.toLowerCase().includes('ocr')) {
                            stage = 'ocr';
                            progress = 30;
                        } else if (stageMessage.toLowerCase().includes('chunk')) {
                            stage = 'chunking';
                            progress = 60;
                        } else if (stageMessage.toLowerCase().includes('embed')) {
                            stage = 'embedding';
                            progress = 90;
                        }

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
                    set({ error: err.message || 'Polling error' });
                }
            }, 3000);
            pollingIntervals.set(materialId, intervalId);
            return intervalId;
        }
    }
}));
