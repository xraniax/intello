import { create } from 'zustand';
import { subjectService } from '../features/subjects/services/SubjectService';
import { useUIStore } from './useUIStore';
import toast from 'react-hot-toast';
import { requireAuth } from '../utils/requireAuth';

export const useSubjectStore = create((set, get) => ({
    data: {
        subjects: [],
        selectedSubjectId: null,
        isPublic: false
    },
    error: null,
    actions: {
        clearError: () => set({ error: null }),

        fetchSubjects: async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                set((state) => ({ ...state, data: { ...state.data, subjects: [], isPublic: true }, error: null }));
                return [];
            }
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('subjects', true, 'Loading subjects...', false);
            set({ error: null });
            try {
                const res = await subjectService.getAll();
                const subjects = res.data.data || [];
                set((state) => ({
                    ...state,
                    error: null,
                    data: { ...state.data, subjects, isPublic: false }
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

        createSubject: (name, description) => requireAuth(async () => {
            const uiActions = useUIStore.getState().actions;
            uiActions.setLoading('createSubject', true, 'Creating subject...', false); // Non-blocking
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
                toast.success('Subject created!');
                return subject;
            } catch (err) {
                const message = err.message || 'Failed to create subject';
                const fieldErrors = err.validationErrors || {};
                set({ error: message });
                uiActions.setError('createSubject', message);
                throw { message, fieldErrors };
            } finally {
                uiActions.setLoading('createSubject', false);
            }
        })
    }
}));
