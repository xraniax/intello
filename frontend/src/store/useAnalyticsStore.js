import { create } from 'zustand';
import AnalyticsService from '@/services/AnalyticsService';

const useAnalyticsStore = create((set, get) => ({
    data: {
        // keyed by subjectId
        dashboards: {},
        progress: {},
    },
    loading: {},
    errors: {},

    actions: {
        async fetchDashboard(subjectId, { refresh = false } = {}) {
            const key = `dashboard_${subjectId}`;
            set(s => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: null } }));
            try {
                const result = await AnalyticsService.getDashboard(subjectId, { refresh });
                set(s => ({
                    data: {
                        ...s.data,
                        dashboards: { ...s.data.dashboards, [subjectId]: result },
                    },
                    loading: { ...s.loading, [key]: false },
                }));
                return result;
            } catch (err) {
                set(s => ({
                    loading: { ...s.loading, [key]: false },
                    errors: { ...s.errors, [key]: err.message },
                }));
                throw err;
            }
        },

        async fetchProgress(subjectId, options = {}) {
            const key = `progress_${subjectId}`;
            set(s => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: null } }));
            try {
                const result = await AnalyticsService.getProgress(subjectId, options);
                set(s => ({
                    data: {
                        ...s.data,
                        progress: { ...s.data.progress, [subjectId]: result },
                    },
                    loading: { ...s.loading, [key]: false },
                }));
                return result;
            } catch (err) {
                set(s => ({
                    loading: { ...s.loading, [key]: false },
                    errors: { ...s.errors, [key]: err.message },
                }));
                throw err;
            }
        },

        getDashboard(subjectId) {
            return get().data.dashboards[subjectId] ?? null;
        },

        getProgress(subjectId) {
            return get().data.progress[subjectId] ?? null;
        },

        isLoading(key) {
            return get().loading[key] ?? false;
        },

        getError(key) {
            return get().errors[key] ?? null;
        },
    },
}));

export default useAnalyticsStore;
