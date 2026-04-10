import React, { useState, useRef, useCallback, useEffect } from 'react';
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

    const onMouseDown = useCallback((separatorIndex) => (e) => {
        e.preventDefault();
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
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }, [widths]);

    const leftWidth = leftPanelCollapsed ? 0 : widths[0];
    const rightWidth = rightPanelCollapsed ? 0 : widths[2];
    const middleWidth = 100 - leftWidth - rightWidth;
    

    return (
        <div ref={containerRef} className="flex-1 flex overflow-hidden bg-[#FFF8F0]/20 select-none pb-20 md:pb-0 relative">
            {/* Left Panel */}
            <div 
                className={`h-full border-r border-purple-100/30 transition-all duration-300 ease-in-out glass-panel overflow-hidden
                    ${isMobile ? (activePanel === 'files' ? 'flex w-full' : 'hidden') : 'md:flex'}`}
                style={{ flex: isMobile ? '1 1 100%' : `0 0 ${leftWidth}%` }}
            >
                <div className="w-full h-full">
                    {leftPanel}
                </div>
            </div>

            {/* Separator 0 */}
            {!leftPanelCollapsed && !isMobile && (
                <div
                    className="hidden md:block w-1.5 h-full cursor-col-resize hover:bg-purple-200/50 transition-colors z-10 -mx-0.75 relative group"
                    onMouseDown={onMouseDown(0)}
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-purple-100/50 group-hover:bg-purple-300 transition-colors"></div>
                </div>
            )}

            {/* Middle Panel */}
            <div 
                className={`h-full border-r border-purple-100/30 transition-all duration-300 ease-in-out glass-panel-dark overflow-hidden
                    ${isMobile ? (activePanel === 'content' ? 'flex w-full' : 'hidden') : 'md:flex'}`}
                style={{ flex: isMobile ? '1 1 100%' : `0 0 ${middleWidth}%` }}
            >
                <div className="w-full h-full">
                    {middlePanel}
                </div>
            </div>

            {/* Separator 1 */}
            {!rightPanelCollapsed && !isMobile && (
                <div
                    className="hidden md:block w-1.5 h-full cursor-col-resize hover:bg-purple-200/50 transition-colors z-10 -mx-0.75 relative group"
                    onMouseDown={onMouseDown(1)}
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-purple-100/50 group-hover:bg-purple-300 transition-colors"></div>
                </div>
            )}

            {/* Right Panel */}
            <div 
                className={`h-full transition-all duration-300 ease-in-out glass-panel overflow-hidden
                    ${isMobile ? (activePanel === 'tutor' ? 'flex w-full' : 'hidden') : 'md:flex'}`}
                style={{ flex: isMobile ? '1 1 100%' : `0 0 ${rightWidth}%` }}
            >
                <div className="w-full h-full">
                    {rightPanel}
                </div>
            </div>
        </div>
    );
};

export default WorkspaceLayout;
