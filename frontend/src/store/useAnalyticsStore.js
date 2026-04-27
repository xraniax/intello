import { create } from 'zustand';
import AnalyticsService from '@/services/AnalyticsService';

const useAnalyticsStore = create((set, get) => ({
    data: {
        dashboards: {},   // keyed by subjectId
        progress: {},     // keyed by subjectId
        global: null,     // global dashboard
        insights: [],
    },
    loading: {},
    errors: {},

    actions: {
        // ── Subject-scoped ──────────────────────────────────────────────────────

        async fetchDashboard(subjectId, { refresh = false } = {}) {
            const key = `dashboard_${subjectId}`;
            set(s => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: null } }));
            try {
                const result = await AnalyticsService.getDashboard(subjectId, { refresh });
                set(s => ({
                    data: { ...s.data, dashboards: { ...s.data.dashboards, [subjectId]: result } },
                    loading: { ...s.loading, [key]: false },
                }));
                return result;
            } catch (err) {
                set(s => ({ loading: { ...s.loading, [key]: false }, errors: { ...s.errors, [key]: err.message } }));
                throw err;
            }
        },

        async fetchProgress(subjectId, options = {}) {
            const key = `progress_${subjectId}`;
            set(s => ({ loading: { ...s.loading, [key]: true }, errors: { ...s.errors, [key]: null } }));
            try {
                const result = await AnalyticsService.getProgress(subjectId, options);
                set(s => ({
                    data: { ...s.data, progress: { ...s.data.progress, [subjectId]: result } },
                    loading: { ...s.loading, [key]: false },
                }));
                return result;
            } catch (err) {
                set(s => ({ loading: { ...s.loading, [key]: false }, errors: { ...s.errors, [key]: err.message } }));
                throw err;
            }
        },

        // ── Global ──────────────────────────────────────────────────────────────

        async fetchGlobal() {
            set(s => ({ loading: { ...s.loading, global: true }, errors: { ...s.errors, global: null } }));
            try {
                const result = await AnalyticsService.getGlobalDashboard();
                set(s => ({
                    data: { ...s.data, global: result, insights: result.insights ?? [] },
                    loading: { ...s.loading, global: false },
                }));
                return result;
            } catch (err) {
                set(s => ({ loading: { ...s.loading, global: false }, errors: { ...s.errors, global: err.message } }));
                throw err;
            }
        },

        async dismissInsight(insightId) {
            await AnalyticsService.dismissInsight(insightId);
            set(s => ({
                data: {
                    ...s.data,
                    insights: s.data.insights.filter((ins) => ins.id !== insightId),
                    global: s.data.global
                        ? { ...s.data.global, insights: (s.data.global.insights ?? []).filter((ins) => ins.id !== insightId) }
                        : s.data.global,
                },
            }));
        },

        // ── Getters ─────────────────────────────────────────────────────────────

        getDashboard(subjectId) { return get().data.dashboards[subjectId] ?? null; },
        getProgress(subjectId)  { return get().data.progress[subjectId]   ?? null; },
        isLoading(key)          { return get().loading[key]  ?? false; },
        getError(key)           { return get().errors[key]   ?? null; },
    },
}));

export default useAnalyticsStore;
