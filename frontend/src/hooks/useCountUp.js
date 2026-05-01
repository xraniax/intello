import { useState, useEffect, useRef } from 'react';

/**
 * useCountUp — animates a number from 0 → target using RAF
 * @param {number} target  - the final value
 * @param {number} duration - animation duration in ms
 * @param {any[]}  deps    - re-trigger when these change
 */
export const useCountUp = (target, duration = 700, deps = []) => {
    const [value, setValue] = useState(0);
    const rafRef = useRef(null);
    const startRef = useRef(null);

    useEffect(() => {
        if (typeof target !== 'number' || isNaN(target)) return;

        // Respect prefers-reduced-motion
        const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReduced) { setValue(target); return; }

        const startVal = 0;
        const diff = target - startVal;

        const tick = (timestamp) => {
            if (!startRef.current) startRef.current = timestamp;
            const elapsed = timestamp - startRef.current;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out-expo
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setValue(Math.round(startVal + diff * eased));
            if (progress < 1) rafRef.current = requestAnimationFrame(tick);
        };

        startRef.current = null;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);

        return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target, duration, ...deps]);

    return value;
};
