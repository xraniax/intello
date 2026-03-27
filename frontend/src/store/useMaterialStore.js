import { create } from 'zustand';
import { materialService } from '../services/api';

const pollingIntervals = new Map();

export const useMaterialStore = create((set, get) => ({
    materials: [],
    loading: false,
    jobProgress: null, // { jobId, stage, progress, message }

    setJobProgress: (progress) => set({ jobProgress: progress }),
    
    clearJobProgress: () => set({ jobProgress: null }),

    fetchMaterials: async () => {
        set({ loading: true });
        try {
            const res = await materialService.getHistory();
            set({ materials: res.data.data, loading: false });
        } catch (err) {
            console.error('Failed to fetch materials:', err);
            set({ loading: false });
        }
    },

    uploadMaterial: async (formData) => {
        set({ 
            jobProgress: { stage: 'uploading', progress: 10, message: 'Uploading file...' } 
        });

        try {
            const res = await materialService.upload(formData);
            const material = res.data.data;
            const status = String(material.status || '').toUpperCase();
            
            if (material.job_id && status === 'PROCESSING') {
                get().startPolling(material.id);
            } else {
                set({ jobProgress: null });
                get().fetchMaterials();
            }
            return material;
        } catch (err) {
            set({ jobProgress: null });
            throw err;
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

    startPolling: (materialId) => {
        // Prevent duplicated pollers when uploads are retried quickly.
        get().clearPolling(materialId);

        const intervalId = setInterval(async () => {
            try {
                const res = await materialService.sync(materialId);
                const material = res.data.data;
                const status = (material.status || '').toUpperCase();
                
                if (status === 'COMPLETED' || status === 'SUCCESS') {
                    get().clearPolling(materialId);
                    set({ jobProgress: null });
                    get().fetchMaterials();
                } else if (status === 'FAILED') {
                    get().clearPolling(materialId);
                    set({ 
                        jobProgress: { 
                            stage: 'failed', 
                            progress: 100, 
                            message: material.error_message || 'Processing failed' 
                        } 
                    });
                    // Clear after a delay
                    setTimeout(() => set({ jobProgress: null }), 5000);
                } else {
                    // Update progress based on status/stage
                    set({ 
                        jobProgress: { 
                            jobId: material.job_id,
                            stage: status.toLowerCase(),
                            progress: status === 'PROCESSING' ? 50 : 80,
                            message: material.stage_message || 'AI is cultivating your material...'
                        }
                    });
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        }, 3000);
        pollingIntervals.set(materialId, intervalId);
        return intervalId;
    }
}));
