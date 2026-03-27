import { create } from 'zustand';
import { subjectService } from '../services/api';
import { useUIStore } from './useUIStore';

export const useSubjectStore = create((set, get) => ({
    data: {
        subjects: [],
        selectedSubjectId: null
    },
    error: null,
    actions: {
        clearError: () => set({ error: null }),

        fetchSubjects: async () => {
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('subjects', true, 'Loading subjects...', false);
            set({ error: null });
            try {
                const res = await subjectService.getAll();
                const subjects = res.data.data || [];
                set((state) => ({
                    ...state,
                    error: null,
                    data: { ...state.data, subjects }
                }));
                return subjects;
            } catch (err) {
                set({ error: err.message || 'Failed to fetch subjects' });
                throw err;
            } finally {
                uiActions.setLoading('subjects', false);
            }
        },

        selectSubject: (id) =>
            set((state) => ({
                ...state,
                data: { ...state.data, selectedSubjectId: id }
            })),

        createSubject: async (name, description) => {
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('createSubject', true, 'Creating subject...', true);
            uiActions.clearError('createSubject');
            set({ error: null });
            try {
                const res = await subjectService.create(name, description);
                const subject = res.data.data;
                set((state) => ({
                    ...state,
                    error: null,
                    data: { ...state.data, subjects: [subject, ...state.data.subjects] }
                }));
                return subject;
            } catch (err) {
                const message = err.message || 'Failed to create subject';
                set({ error: message });
                uiActions.setError('createSubject', message);
                throw err;
            } finally {
                uiActions.setLoading('createSubject', false);
            }
        }
    }
}));
