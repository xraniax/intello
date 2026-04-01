import React from 'react';
import { Reorder, AnimatePresence, motion } from 'framer-motion';
import { X, Pin, FileText, Sparkles, BrainCircuit, Layers, CheckCircle2 } from 'lucide-react';

const WorkspaceTabs = ({
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    renderTabContent
}) => {

    const handleClose = (e, tabId) => {
        e.stopPropagation();
        
        // Don't close pinned tabs
        const tab = tabs.find(t => t.id === tabId);
        if (tab?.pinned) return;

        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);

        // If we closed the active tab, fallback to the previous one or the generator tab
        if (activeTabId === tabId) {
            const index = tabs.findIndex(t => t.id === tabId);
            if (newTabs.length > 0) {
                // Try to select the one to the left, fallback to 0
                const nextIndex = index > 0 ? index - 1 : 0;
                setActiveTabId(newTabs[nextIndex].id);
            } else {
                setActiveTabId(null);
            }
        }
    };

    return (
        <div className="flex flex-col h-full bg-white/10 overflow-hidden">
            {/* Tab Header Bar - Horizontal Scroll Enabled */}
            <div className="flex-shrink-0 bg-white/40 pb-0 pt-1.5 px-2 border-b border-purple-100 flex items-end overflow-x-auto no-scrollbar scroll-smooth">
                <Reorder.Group 
                    axis="x" 
                    values={tabs} 
                    onReorder={setTabs} 
                    className="flex gap-1.5 min-w-max pb-0"
                >
                    <AnimatePresence>
                        {tabs.map((tab) => {
                            const isActive = activeTabId === tab.id;
                            return (
                                <Reorder.Item
                                    key={tab.id}
                                    value={tab}
                                    className={`relative flex items-center gap-2 px-3 py-2 rounded-t-xl cursor-pointer select-none transition-all flex-shrink-0 group
                                        ${isActive 
                                            ? 'bg-white border-t border-x border-purple-100 shadow-[0_-4px_10px_rgba(0,0,0,0.02)] translate-y-[1px] z-10' 
                                            : 'bg-white/50 border-t border-x border-transparent text-gray-500 hover:bg-white/80 hover:text-gray-700 -translate-y-[1px]'
                                        }`}
                                    onClick={() => setActiveTabId(tab.id)}
                                >
                                    {/* Icon */}
                                    <div className={`flex-shrink-0 ${isActive ? '' : 'opacity-70'}`}>
                                        {tab.id === 'generator' ? (
                                            <BrainCircuit className="w-3.5 h-3.5 text-purple-500" />
                                        ) : tab.type === 'upload' ? (
                                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                                        ) : tab.type === 'summary' ? (
                                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                                        ) : tab.type === 'quiz' ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                        ) : tab.type === 'flashcards' ? (
                                            <Layers className="w-3.5 h-3.5 text-purple-500" />
                                        ) : tab.type === 'exam' ? (
                                            <BrainCircuit className="w-3.5 h-3.5 text-amber-500" />
                                        ) : (
                                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                        )}
                                    </div>
                                    
                                    {/* Title */}
                                    <span className={`text-[11px] font-bold max-w-[140px] truncate ${isActive ? 'text-indigo-900' : ''}`}>
                                        {tab.title}
                                    </span>
                                    
                                    {/* Actions */}
                                    <div className="flex items-center gap-1 ml-2 pl-1 border-l border-gray-100/50">
                                        {tab.pinned ? (
                                            <Pin className={`w-3 h-3 ${isActive ? 'text-indigo-400' : 'text-gray-300'}`} />
                                        ) : (
                                            <button 
                                                onClick={(e) => handleClose(e, tab.id)}
                                                className={`p-0.5 rounded-md hover:bg-red-50 hover:text-red-500 transition-colors ${isActive ? 'text-gray-400' : 'text-gray-300 opacity-0 group-hover:opacity-100'}`}
                                                title="Close tab"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </Reorder.Item>
                            );
                        })}
                    </AnimatePresence>
                </Reorder.Group>
            </div>

            {/* Tab Content Area — overflow-hidden here so absolute inset-0 fills correctly; each content renders its own scroll */}
            <div className="flex-1 overflow-hidden min-h-0 relative bg-white">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTabId}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.15 }}
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
