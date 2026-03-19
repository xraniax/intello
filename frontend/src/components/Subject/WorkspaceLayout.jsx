import React, { useState, useCallback, useRef } from 'react';

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

    // Calculate effective widths based on collapse states
    const leftWidth = leftPanelCollapsed ? 0 : widths[0];
    const rightWidth = rightPanelCollapsed ? 0 : widths[2];
    const middleWidth = 100 - leftWidth - rightWidth;

    return (
        <div ref={containerRef} className="flex-1 flex overflow-hidden bg-[#FFF8F0]/20 select-none">
            {/* Left Panel */}
            {!leftPanelCollapsed && (
                <>
                    <div className="h-full overflow-hidden bg-white/40 backdrop-blur-sm border-r border-purple-100/30 transition-all duration-300 ease-in-out" style={{ width: `${leftWidth}%` }}>
                        {leftPanel}
                    </div>
                    {/* Separator 0 */}
                    <div
                        className="w-1.5 h-full cursor-col-resize hover:bg-purple-200/50 transition-colors z-10 -mx-0.75 relative group"
                        onMouseDown={onMouseDown(0)}
                    >
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-purple-100/50 group-hover:bg-purple-300 transition-colors"></div>
                    </div>
                </>
            )}

            {/* Middle Panel */}
            <div className="h-full overflow-hidden relative flex flex-col" style={{ width: `${middleWidth}%` }}>
                {middlePanel}
            </div>

            {/* Right Panel */}
            {!rightPanelCollapsed && (
                <>
                    {/* Separator 1 */}
                    <div
                        className="w-1.5 h-full cursor-col-resize hover:bg-purple-200/50 transition-colors z-10 -mx-0.75 relative group"
                        onMouseDown={onMouseDown(1)}
                    >
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-purple-100/50 group-hover:bg-purple-300 transition-colors"></div>
                    </div>
                    <div className="h-full overflow-hidden bg-white/40 backdrop-blur-sm border-l border-purple-100/30 transition-all duration-300 ease-in-out" style={{ width: `${rightWidth}%` }}>
                        {rightPanel}
                    </div>
                </>
            )}
        </div>
    );
};

export default WorkspaceLayout;
