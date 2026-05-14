import { create } from 'zustand';
import RatingService from '@/services/RatingService';

/**
 * Zustand store for material ratings.
 *
 * Keyed maps use materialId as the key so state from multiple open tabs
 * coexists without collisions.
 *
 * Shape:
 *   ratings:      { [materialId]: rating | null }  — user's own saved rating
 *   exists:       { [materialId]: bool | undefined } — quick existence flag
 *   pendingCheck: Set<materialId>                  — in-flight check requests
 *   modalOpen:    materialId | null                — which modal is showing
 */

export const useRatingStore = create((set, get) => ({
    ratings: {},
    exists: {},
    pendingCheck: new Set(),
    modalOpen: null,

    actions: {
        /** Fetch and cache whether a rating exists. Safe to call multiple times. */
        checkExists: async (materialId) => {
            const state = get();
            if (state.exists[materialId] !== undefined) return state.exists[materialId];
            if (state.pendingCheck.has(materialId)) return;

            set((s) => ({ pendingCheck: new Set([...s.pendingCheck, materialId]) }));
            try {
                const res = await RatingService.checkExists(materialId);
                const flag = res.data?.data?.exists ?? false;
                set((s) => ({
                    exists: { ...s.exists, [materialId]: flag },
                    pendingCheck: new Set([...s.pendingCheck].filter((id) => id !== materialId)),
                }));
                return flag;
            } catch {
                set((s) => ({
                    pendingCheck: new Set([...s.pendingCheck].filter((id) => id !== materialId)),
                }));
                return false;
            }
        },

        /** Load the user's full rating object for a material. */
        loadRating: async (materialId) => {
            try {
                const res = await RatingService.getMyRating(materialId);
                const rating = res.data?.data?.rating ?? null;
                set((s) => ({
                    ratings: { ...s.ratings, [materialId]: rating },
                    exists:  { ...s.exists,  [materialId]: !!rating },
                }));
                return rating;
            } catch {
                return null;
            }
        },

        /** Called after a successful submit to update local state. */
        setRating: (materialId, rating) =>
            set((s) => ({
                ratings: { ...s.ratings, [materialId]: rating },
                exists:  { ...s.exists,  [materialId]: true },
            })),

        openModal:  (materialId) => set({ modalOpen: materialId }),
        closeModal: () => set({ modalOpen: null }),
    },
}));
