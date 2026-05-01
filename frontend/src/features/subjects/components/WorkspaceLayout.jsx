import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/useUIStore';

const MIN_PCT = 12; // minimum panel width as a percentage

const WorkspaceLayout = ({
    leftPanel,
    middlePanel,
    rightPanel,
    leftPanelCollapsed,
    rightPanelCollapsed
}) => {
    // Panel widths as percentages [left, middle, right] — must sum to 100
    const [widths, setWidths] = useState([22, 50, 28]);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef(null);
    const dragging = useRef(null); // { separatorIndex, startX, startWidths }

    // Reactive mobile state — updates on window resize
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Mobile View State
    const activePanel = useUIStore((state) => state.data.activeWorkspacePanel);

    // spring config for smooth transitions - softer and more organic
    const springConfig = { type: 'spring', stiffness: 280, damping: 32, mass: 1 };
    const [transitionConfig, setTransitionConfig] = useState(springConfig);

    // Reset transition to spring only when collapse state changes from props
    useEffect(() => {
        setTransitionConfig(springConfig);
    }, [leftPanelCollapsed, rightPanelCollapsed]);

    const onMouseDown = useCallback((separatorIndex) => (e) => {
        e.preventDefault();
        setIsDragging(true);
        setTransitionConfig({ duration: 0 }); // Disable transition during and immediately after drag
        dragging.current = {
            separatorIndex,
            startX: e.clientX,
            startWidths: [...widths],
        };

        const onMouseMove = (e) => {
            if (!dragging.current) return;
            const containerWidth = containerRef.current?.getBoundingClientRect().width || 1;
            const deltaPct = ((e.clientX - dragging.current.startX) / containerWidth) * 100;
            const { separatorIndex: si, startWidths: sw } = dragging.current;

            const newWidths = [...sw];
            newWidths[si] = sw[si] + deltaPct;
            newWidths[si + 1] = sw[si + 1] - deltaPct;

            // Enforce minimums
            if (newWidths[si] < MIN_PCT || newWidths[si + 1] < MIN_PCT) return;

            setWidths(newWidths);
        };

        const onMouseUp = () => {
            dragging.current = null;
            setIsDragging(false);
            // We DON'T reset transition to spring here so it stops exactly where dropped
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [widths, springConfig]);

    const leftWidth = leftPanelCollapsed ? 0 : widths[0];
    const rightWidth = rightPanelCollapsed ? 0 : widths[2];
    const middleWidth = 100 - leftWidth - rightWidth;

    return (
        <div ref={containerRef} className={`flex-1 flex overflow-hidden select-none pb-20 md:pb-0 relative ${isDragging ? 'cursor-col-resize shadow-inner transition-none' : ''}`} style={{ background: 'var(--c-canvas)' }}>
            {/* Left Panel */}
            <motion.div 
                initial={false}
                animate={{ 
                    width: isMobile ? '100%' : `${leftWidth}%`,
                    opacity: leftPanelCollapsed && !isMobile ? 0 : 1
                }}
                transition={isDragging ? { duration: 0 } : transitionConfig}
                className={`h-full overflow-hidden flex-shrink-0
                    ${isMobile ? (activePanel === 'files' ? 'flex' : 'hidden') : 'flex'}`}
                style={{ 
                    borderRight: leftPanelCollapsed ? 'none' : '1px solid var(--c-border-soft)'
                }}
            >
                <div className="w-full h-full min-w-[250px]">
                    {leftPanel}
                </div>
            </motion.div>

            {/* Separator 0 */}
            {!leftPanelCollapsed && !isMobile && (
                <div
                    className="hidden md:block w-2.5 h-full cursor-col-resize z-10 -mx-1.25 relative group"
                    onMouseDown={onMouseDown(0)}
                >
                    <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] transition-all ${isDragging ? 'opacity-100 scale-x-150' : 'opacity-0 group-hover:opacity-100'}`} style={{ background: 'var(--c-primary)' }}></div>
                </div>
            )}

            {/* Middle Panel */}
            <motion.div 
                initial={false}
                animate={{ 
                    width: isMobile ? '100%' : `${middleWidth}%`
                }}
                transition={isDragging ? { duration: 0 } : transitionConfig}
                className={`h-full overflow-hidden flex-shrink-0
                    ${isMobile ? (activePanel === 'content' ? 'flex' : 'hidden') : 'flex'}`}
                style={{ 
                    background: 'var(--c-surface)', 
                    borderTopLeftRadius: '32px', 
                    boxShadow: '-4px 0 32px rgba(0,0,0,0.03)',
                    zoom: 1.1,
                    fontSize: '20px'
                }}
            >
                <div className="w-full h-full min-w-[400px]">
                    {middlePanel}
                </div>
            </motion.div>

            {/* Separator 1 */}
            {!rightPanelCollapsed && !isMobile && (
                <div
                    className="hidden md:block w-2.5 h-full cursor-col-resize z-10 -mx-1.25 relative group"
                    onMouseDown={onMouseDown(1)}
                >
                    <div className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-[3px] transition-all ${isDragging ? 'opacity-100 scale-x-150' : 'opacity-0 group-hover:opacity-100'}`} style={{ background: 'var(--c-primary)' }}></div>
                </div>
            )}

            {/* Right Panel */}
            <motion.div 
                initial={false}
                animate={{ 
                    width: isMobile ? '100%' : `${rightWidth}%`,
                    opacity: rightPanelCollapsed && !isMobile ? 0 : 1
                }}
                transition={isDragging ? { duration: 0 } : transitionConfig}
                className={`h-full overflow-hidden flex-shrink-0
                    ${isMobile ? (activePanel === 'tutor' ? 'flex' : 'hidden') : 'flex'}`}
                style={{ 
                    borderLeft: rightPanelCollapsed ? 'none' : '1px solid var(--c-border-soft)', 
                    background: 'var(--c-surface)'
                }}
            >
                <div className="w-full h-full min-w-[300px]">
                    {rightPanel}
                </div>
            </motion.div>
        </div>
    );
};

export default WorkspaceLayout;
