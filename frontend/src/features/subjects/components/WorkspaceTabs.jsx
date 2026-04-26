import React from 'react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { X, Pin, FileText, Sparkles, BrainCircuit, Layers, CheckCircle2, Trash2, BarChart2, Maximize2 } from 'lucide-react';
import { morphIn } from '@/utils/motion';

// ── Tab type → visual identity ──────────────────────────────
const TAB_CONFIG = {
    generator:    { grad: 'var(--grad-primary)', light: 'var(--c-primary-ultra)', color: 'var(--c-primary)', icon: BrainCircuit },
    upload:       { grad: 'var(--grad-cool)',    light: 'var(--c-sky-light)',     color: 'var(--c-sky)',     icon: FileText },
    summary:      { grad: 'var(--grad-ocean)',   light: 'var(--c-sky-light)',     color: 'var(--c-sky)',     icon: FileText },
    quiz:         { grad: 'var(--grad-success)', light: 'var(--c-mint-light)',    color: 'var(--c-mint)',    icon: CheckCircle2 },
    flashcards:   { grad: 'var(--grad-primary)', light: 'var(--c-primary-ultra)', color: 'var(--c-primary)', icon: Layers },
    exam:         { grad: 'var(--grad-sunset)',  light: 'var(--c-amber-light)',   color: 'var(--c-amber)',   icon: BrainCircuit },
    exam_session: { grad: 'var(--grad-sunset)',  light: 'var(--c-amber-light)',   color: 'var(--c-amber)',   icon: BrainCircuit },
    analytics:    { grad: 'var(--grad-candy)',   light: 'var(--c-rose-light)',    color: 'var(--c-rose)',    icon: BarChart2 },
    default:      { grad: 'var(--grad-warm)',    light: 'var(--c-coral-light)',   color: 'var(--c-coral)',   icon: Sparkles },
};

const getTabConfig = (tab) => TAB_CONFIG[tab.type] || (tab.id === 'generator' ? TAB_CONFIG.generator : TAB_CONFIG.default);

const WorkspaceTabs = ({ tabs, setTabs, activeTabId, setActiveTabId, renderTabContent, onFocusMode }) => {

    const handleClose = (e, tabId) => {
        e.stopPropagation();
        const tab = tabs.find(t => t.id === tabId);
        if (tab?.pinned) return;
        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);
        if (activeTabId === tabId) {
            const index = tabs.findIndex(t => t.id === tabId);
            if (newTabs.length > 0) {
                setActiveTabId(newTabs[Math.max(0, index - 1)].id);
            } else {
                setActiveTabId(null);
            }
        }
    };

    const handleCloseAll = () => {
        const pinned = tabs.filter(t => t.pinned);
        setTabs(pinned);
        if (!pinned.some(t => t.id === activeTabId)) {
            setActiveTabId(pinned[0]?.id || null);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--c-canvas)' }}>

            {/* ── Tab bar ── */}
            <div
                className="flex-shrink-0 pt-2 px-2 border-b flex items-end justify-between overflow-hidden"
                style={{ background: 'var(--c-surface-alt)', borderColor: 'var(--c-border-soft)' }}
            >
                {/* Scrollable tab list */}
                <div className="flex-1 overflow-x-auto no-scrollbar scroll-smooth flex items-end pr-2">
                    <Reorder.Group
                        axis="x"
                        values={tabs}
                        onReorder={setTabs}
                        className="flex gap-1 min-w-max pb-0"
                    >
                        <AnimatePresence>
                            {tabs.map((tab) => {
                                const isActive = activeTabId === tab.id;
                                const cfg      = getTabConfig(tab);
                                const Icon     = cfg.icon;

                                return (
                                    <Reorder.Item
                                        key={tab.id}
                                        value={tab}
                                        className="relative flex items-center gap-1.5 px-3 py-2 rounded-t-xl cursor-pointer select-none flex-shrink-0 group"
                                        style={{
                                            background: isActive ? 'var(--c-surface)' : 'transparent',
                                            borderTop:    isActive ? '1.5px solid var(--c-border-soft)' : '1.5px solid transparent',
                                            borderLeft:   isActive ? '1.5px solid var(--c-border-soft)' : '1.5px solid transparent',
                                            borderRight:  isActive ? '1.5px solid var(--c-border-soft)' : '1.5px solid transparent',
                                            boxShadow:    isActive ? 'var(--shadow-xs)' : 'none',
                                            transform:    isActive ? 'translateY(1px)' : 'translateY(0)',
                                            transition: 'all 0.15s',
                                        }}
                                        onClick={() => setActiveTabId(tab.id)}
                                    >
                                        {/* Colored top gradient line on active tab */}
                                        {isActive && (
                                            <motion.div
                                                layoutId={`tab-accent-${tab.id}`}
                                                className="absolute top-0 left-2 right-2 h-[2.5px] rounded-full"
                                                style={{ background: cfg.grad }}
                                                transition={{ type: 'spring', damping: 28, stiffness: 280 }}
                                            />
                                        )}

                                        {/* Icon */}
                                        <div
                                            className="flex-shrink-0 w-4 h-4 flex items-center justify-center"
                                            style={{ color: isActive ? cfg.color : 'var(--c-text-placeholder)' }}
                                        >
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>

                                        {/* Title */}
                                        <span
                                            className="text-[11px] max-w-[120px] truncate transition-all"
                                            style={{
                                                color:      isActive ? 'var(--c-text)' : 'var(--c-text-muted)',
                                                fontWeight: isActive ? 600 : 500,
                                                textDecoration: tab.isDeleted ? 'line-through' : 'none',
                                                opacity: tab.isDeleted ? 0.65 : 1,
                                            }}
                                            title={tab.isDeleted ? 'This file has been deleted' : tab.title}
                                        >
                                            {tab.title}
                                        </span>

                                        {/* Pin / Close */}
                                        <div className="flex items-center ml-1">
                                            {tab.pinned ? (
                                                <Pin
                                                    className="w-2.5 h-2.5"
                                                    style={{ color: isActive ? cfg.color : 'var(--c-text-placeholder)' }}
                                                />
                                            ) : (
                                                <motion.button
                                                    whileTap={{ scale: 0.8 }}
                                                    onClick={(e) => handleClose(e, tab.id)}
                                                    className="w-4 h-4 rounded flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                                                    style={{ color: 'var(--c-text-muted)' }}
                                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-danger)'; e.currentTarget.style.background = 'var(--c-danger-light)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <X className="w-2.5 h-2.5" />
                                                </motion.button>
                                            )}
                                        </div>
                                    </Reorder.Item>
                                );
                            })}
                        </AnimatePresence>
                    </Reorder.Group>
                </div>

                {/* Actions: Focus + Close All */}
                <div className="flex-shrink-0 flex items-center mb-1.5 ml-2 gap-1">
                    {activeTabId && activeTabId !== 'generator' && onFocusMode && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => onFocusMode(activeTabId)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                            style={{ color: 'var(--c-primary)', background: 'var(--c-primary-ultra)', border: '1.5px solid var(--c-primary-light)' }}
                            title="Focus mode — fullscreen"
                            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-primary-light)'; }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-primary-ultra)'; }}
                        >
                            <Maximize2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Focus</span>
                        </motion.button>
                    )}
                    {tabs.some(t => !t.pinned) && (
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleCloseAll}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                            style={{ color: 'var(--c-text-muted)', background: 'var(--c-surface)', border: '1.5px solid var(--c-border-soft)' }}
                            title="Close all non-pinned tabs"
                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--c-danger)'; e.currentTarget.style.background = 'var(--c-danger-light)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.18)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--c-text-muted)'; e.currentTarget.style.background = 'var(--c-surface)'; e.currentTarget.style.borderColor = 'var(--c-border-soft)'; }}
                        >
                            <Trash2 className="w-3 h-3" />
                            <span className="hidden sm:inline">Close All</span>
                        </motion.button>
                    )}
                </div>
            </div>

            {/* ── Tab content — morphIn transition ── */}
            <div className="flex-1 overflow-hidden min-h-0 relative" style={{ background: 'var(--c-surface)' }}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTabId}
                        {...morphIn}
                        className="h-full absolute inset-0"
                    >
                        {renderTabContent(activeTabId)}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

export default WorkspaceTabs;
