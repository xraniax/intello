import { create } from 'zustand';
import { subjectService } from '../services/api';

export const useSubjectStore = create((set) => ({
    subjects: [],
    loading: false,
    selectedSubjectId: null,

    fetchSubjects: async () => {
        set({ loading: true });
        try {
            const res = await subjectService.getAll();
            set({ subjects: res.data.data, loading: false });
        } catch (err) {
            console.error('Failed to fetch subjects:', err);
            set({ loading: false });
        }
    },

    selectSubject: (id) => set({ selectedSubjectId: id }),

    createSubject: async (name, description) => {
        const res = await subjectService.create(name, description);
        set((state) => ({ subjects: [res.data.data, ...state.subjects] }));
        return res.data.data;
    }
}));
