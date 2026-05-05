import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useUIStore } from '@/store/useUIStore';

const MIN_PCT = 12;
const PANEL_TRANSITION = 'width 0.32s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease';

// Grip dots — 4 vertically stacked dots that are always softly visible
const GripDots = () => (
    <div className="flex flex-col items-center gap-[4px]">
        {[0,1,2,3].map(i => (
            <div key={i} className="w-[3px] h-[3px] rounded-full" style={{ background: 'currentColor' }} />
        ))}
    </div>
);

const Separator = ({ idx, activeIdx, onMouseDown }) => {
    const isActive  = activeIdx === idx;
    const [hovered, setHovered] = useState(false);
    const lit = isActive || hovered;

    return (
        <div
            className="hidden md:flex items-center justify-center flex-shrink-0 cursor-col-resize"
            style={{ width: 28, margin: '0 -14px', position: 'relative', zIndex: 30 }}
            onMouseDown={onMouseDown}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {/* Vertical rule — always softly present */}
            <div
                className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px"
                style={{
                    background: lit ? 'var(--c-primary)' : 'var(--c-border-soft)',
                    opacity: lit ? 0.7 : 0.4,
                    transition: 'opacity 0.15s, background 0.15s',
                }}
            />
            {/* Grip pill */}
            <div
                className="relative flex items-center justify-center rounded-full"
                style={{
                    width: 20,
                    height: 48,
                    background: lit ? 'var(--grad-primary)' : 'var(--c-border)',
                    color: lit ? '#fff' : 'var(--c-text-muted)',
                    opacity: lit ? 1 : 0.6,
                    transform: isActive ? 'scaleX(1.1) scaleY(1.05)' : 'scaleX(1)',
                    boxShadow: isActive
                        ? '0 0 0 4px rgba(124, 92, 252, 0.25), 0 0 12px rgba(124, 92, 252, 0.4)'
                        : hovered
                        ? '0 0 0 2px rgba(124, 92, 252, 0.15)'
                        : 'none',
                    transition: 'all 0.2s var(--ease-spring)',
                }}
            >
                <GripDots />
            </div>
        </div>
    );
};

const WorkspaceLayout = ({
    leftPanel,
    middlePanel,
    rightPanel,
    leftPanelCollapsed,
    rightPanelCollapsed
}) => {
    // Widths are the *stored* percentages [left, middle, right]
    // during drag we mutate widthsRef and write directly to the DOM — no React re-renders
    const [widths, setWidths] = useState([22, 50, 28]);
    const widthsRef = useRef([22, 50, 28]);

    const containerRef = useRef(null);
    const leftRef    = useRef(null);
    const midRef     = useRef(null);
    const rightRef   = useRef(null);

    const [isMobile, setIsMobile] = useState(
        () => typeof window !== 'undefined' && window.innerWidth < 768
    );
    useEffect(() => {
        const h = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);

    const activePanel = useUIStore((s) => s.data.activeWorkspacePanel);

    // Computes effective pixel-percentages respecting collapse flags
    const computeEffective = useCallback((w) => {
        const lw = leftPanelCollapsed  ? 0 : w[0];
        const rw = rightPanelCollapsed ? 0 : w[2];
        return [lw, 100 - lw - rw, rw];
    }, [leftPanelCollapsed, rightPanelCollapsed]);

    // Push widths straight to the DOM — zero React involvement
    const applyToDom = useCallback((w) => {
        const [lw, mw, rw] = computeEffective(w);
        if (leftRef.current)  leftRef.current.style.width  = `${lw}%`;
        if (midRef.current)   midRef.current.style.width   = `${mw}%`;
        if (rightRef.current) rightRef.current.style.width = `${rw}%`;
    }, [computeEffective]);

    // Whenever collapse state changes, re-sync DOM from current stored widths
    useEffect(() => {
        applyToDom(widthsRef.current);
    }, [leftPanelCollapsed, rightPanelCollapsed, applyToDom]);

    const [draggingIdx, setDraggingIdx] = useState(null);

    const onMouseDown = useCallback((separatorIndex) => (e) => {
        e.preventDefault();

        const startX      = e.clientX;
        const startWidths = [...widthsRef.current];

        // Kill transitions so drag is frame-perfect
        [leftRef, midRef, rightRef].forEach(r => {
            if (r.current) r.current.style.transition = 'none';
        });
        document.body.style.cursor     = 'col-resize';
        document.body.style.userSelect = 'none';
        setDraggingIdx(separatorIndex);

        const onMouseMove = (mv) => {
            const cw    = containerRef.current?.getBoundingClientRect().width ?? 1;
            const delta = ((mv.clientX - startX) / cw) * 100;
            const si    = separatorIndex;
            const next  = [...startWidths];
            next[si]     = startWidths[si]     + delta;
            next[si + 1] = startWidths[si + 1] - delta;
            if (next[si] < MIN_PCT || next[si + 1] < MIN_PCT) return;
            widthsRef.current = next;
            applyToDom(next);
        };

        const onMouseUp = () => {
            // Restore transitions for future collapse animations
            [leftRef, midRef, rightRef].forEach(r => {
                if (r.current) r.current.style.transition = '';
            });
            document.body.style.cursor     = '';
            document.body.style.userSelect = '';
            setDraggingIdx(null);

            // One React commit — syncs state to what the DOM already shows
            setWidths([...widthsRef.current]);

            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup',   onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup',   onMouseUp);
    }, [applyToDom]);

    const [lw, mw, rw] = computeEffective(widths);

    return (
        <div
            ref={containerRef}
            className="flex-1 flex overflow-hidden select-none pb-20 md:pb-0 relative z-10"
            style={{ background: 'transparent' }}
        >
            {/* ── Left panel ── */}
            <div
                ref={leftRef}
                className={`h-full overflow-hidden flex-shrink-0
                    ${isMobile ? (activePanel === 'files' ? 'flex' : 'hidden') : 'flex'}`}
                style={{
                    width:        isMobile ? '100%' : `${lw}%`,
                    opacity:      leftPanelCollapsed && !isMobile ? 0 : 1,
                    pointerEvents: leftPanelCollapsed ? 'none' : 'auto',
                    borderRight:  leftPanelCollapsed ? 'none' : '1px solid rgba(244, 63, 94, 0.15)',
                    background:   'rgba(255, 255, 255, 0.55)',
                    backdropFilter:'blur(20px)',
                    transition:   PANEL_TRANSITION,
                }}
            >
                <div className="w-full h-full">{leftPanel}</div>
            </div>

            {/* ── Separator 0 ── */}
            {!leftPanelCollapsed && !isMobile && (
                <Separator
                    idx={0}
                    activeIdx={draggingIdx}
                    onMouseDown={onMouseDown(0)}
                />
            )}

            {/* ── Middle panel ── */}
            <div
                ref={midRef}
                className={`h-full overflow-hidden flex-shrink-0
                    ${isMobile ? (activePanel === 'content' ? 'flex' : 'hidden') : 'flex'}`}
                style={{
                    width:             isMobile ? '100%' : `${mw}%`,
                    background:        'rgba(255, 255, 255, 0.85)',
                    backdropFilter:    'blur(24px)',
                    borderTopLeftRadius: '32px',
                    boxShadow:         '-12px 0 40px rgba(244, 63, 94, 0.08), inset 1px 0 0 rgba(255, 255, 255, 0.5)',
                    zoom:              1.1,
                    fontSize:          '20px',
                    transition:        PANEL_TRANSITION,
                }}
            >
                <div className="w-full h-full">{middlePanel}</div>
            </div>

            {/* ── Separator 1 ── */}
            {!rightPanelCollapsed && !isMobile && (
                <Separator
                    idx={1}
                    activeIdx={draggingIdx}
                    onMouseDown={onMouseDown(1)}
                />
            )}

            {/* ── Right panel ── */}
            <div
                ref={rightRef}
                className={`h-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-white/70 to-fuchsia-50/70
                    ${isMobile ? (activePanel === 'tutor' ? 'flex' : 'hidden') : 'flex'}`}
                style={{
                    width:        isMobile ? '100%' : `${rw}%`,
                    opacity:      rightPanelCollapsed && !isMobile ? 0 : 1,
                    pointerEvents: rightPanelCollapsed ? 'none' : 'auto',
                    borderLeft:   rightPanelCollapsed ? 'none' : '1px solid rgba(217, 70, 239, 0.15)',
                    backdropFilter:'blur(20px)',
                    transition:   PANEL_TRANSITION,
                }}
            >
                <div className="w-full h-full">{rightPanel}</div>
            </div>
        </div>
    );
};

export default WorkspaceLayout;
