import React, { useState, useCallback, useRef } from 'react';

const MIN_PCT = 12; // minimum panel width as a percentage

const WorkspaceLayout = ({ leftPanel, middlePanel, rightPanel }) => {
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

    return (
        <div ref={containerRef} className="workspace-container">
            {/* Left Panel */}
            <div className="workspace-panel" style={{ width: `${widths[0]}%` }}>
                {leftPanel}
            </div>

            {/* Separator 0 */}
            <div
                className="workspace-separator"
                onMouseDown={onMouseDown(0)}
                title="Drag to resize"
            />

            {/* Middle Panel */}
            <div className="workspace-panel" style={{ width: `${widths[1]}%` }}>
                {middlePanel}
            </div>

            {/* Separator 1 */}
            <div
                className="workspace-separator"
                onMouseDown={onMouseDown(1)}
                title="Drag to resize"
            />

            {/* Right Panel */}
            <div className="workspace-panel" style={{ width: `${widths[2]}%` }}>
                {rightPanel}
            </div>
        </div>
    );
};

export default WorkspaceLayout;
