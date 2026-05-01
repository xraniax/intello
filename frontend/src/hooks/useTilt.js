import { useRef, useCallback } from 'react';

/**
 * useTilt — cursor-aware 3D card tilt with glow tracking
 * Returns { ref, onMouseMove, onMouseLeave } to spread onto the card element.
 *
 * @param {number} maxDeg   - max rotation degrees (default 8)
 * @param {number} glowSize - glow radius in px (default 180)
 */
export const useTilt = (maxDeg = 8, glowSize = 180) => {
    const ref = useRef(null);
    const prefersReduced = typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false;

    const onMouseMove = useCallback((e) => {
        if (prefersReduced || !ref.current) return;
        const rect = ref.current.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / (rect.width / 2);   // -1 … +1
        const dy = (e.clientY - cy) / (rect.height / 2);  // -1 … +1

        const rotateX = (-dy * maxDeg).toFixed(2);
        const rotateY = (dx * maxDeg).toFixed(2);

        // Glow position relative to card (percentage)
        const glowX = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
        const glowY = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);

        ref.current.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-6px)`;
        ref.current.style.transition = 'transform 0.08s linear';

        // Update CSS custom props for glow overlay
        ref.current.style.setProperty('--glow-x', `${glowX}%`);
        ref.current.style.setProperty('--glow-y', `${glowY}%`);
        ref.current.style.setProperty('--glow-opacity', '1');
    }, [maxDeg, prefersReduced]);

    const onMouseLeave = useCallback(() => {
        if (!ref.current) return;
        ref.current.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) translateY(0)';
        ref.current.style.transition = 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)';
        ref.current.style.setProperty('--glow-opacity', '0');
    }, []);

    return { ref, onMouseMove, onMouseLeave };
};
