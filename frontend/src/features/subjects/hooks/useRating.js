import { useEffect, useRef, useCallback } from 'react';
import { useRatingStore } from '@/store/useRatingStore';

/**
 * Engagement-aware rating trigger hook.
 *
 * Tracks how long a user has been on a material tab and auto-opens the rating
 * modal exactly once per user per material, only after the engagement threshold
 * is met AND no prior rating exists.
 *
 * @param {string|null} materialId  - UUID of the current material (null = inactive)
 * @param {object}      options
 * @param {number}      options.thresholdSeconds - seconds before popup fires (default 60)
 * @param {boolean}     options.active           - set false to pause tracking
 */
export function useRating(materialId, { thresholdSeconds = 60, active = true } = {}) {
    const { exists, actions } = useRatingStore();
    const timerRef      = useRef(null);
    const startTimeRef  = useRef(null);
    const elapsedRef    = useRef(0);
    const checkedRef    = useRef(null); // last materialId we checked

    // Check existence once per materialId
    useEffect(() => {
        if (!materialId || checkedRef.current === materialId) return;
        checkedRef.current = materialId;
        actions.checkExists(materialId);
    }, [materialId, actions]);

    // Engagement timer — starts / stops based on `active` prop
    useEffect(() => {
        if (!materialId || !active) {
            _pause();
            return;
        }

        // If the rating is already confirmed, never start the timer
        if (exists[materialId] === true) return;

        // If we haven't received the check result yet, wait
        if (exists[materialId] === undefined) return;

        _start();
        return _pause;

        function _start() {
            if (timerRef.current) return; // already running
            startTimeRef.current = Date.now();

            timerRef.current = setInterval(() => {
                const now   = Date.now();
                const delta = (now - startTimeRef.current) / 1000;
                elapsedRef.current = delta;

                if (elapsedRef.current >= thresholdSeconds) {
                    _pause();
                    actions.openModal(materialId);
                }
            }, 2000); // check every 2 s — low overhead
        }

        function _pause() {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [materialId, active, exists, thresholdSeconds, actions]);

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    /** Reset accumulated time when the user switches to a different material */
    useEffect(() => {
        elapsedRef.current  = 0;
        startTimeRef.current = Date.now();
    }, [materialId]);

    /** Imperative open — allows "Rate this material" button to open the modal */
    const openRatingModal = useCallback(() => {
        if (materialId) actions.openModal(materialId);
    }, [materialId, actions]);

    return {
        /** Elapsed seconds on this material (for passing to the modal) */
        engagementSeconds: Math.round(elapsedRef.current),
        openRatingModal,
        hasRated: exists[materialId] === true,
    };
}
