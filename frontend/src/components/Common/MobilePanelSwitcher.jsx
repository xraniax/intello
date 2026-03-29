import React from 'react';
import { useUIStore } from '../../store/useUIStore';
import { FileText, BookOpen, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

const MobilePanelSwitcher = () => {
    const activePanel = useUIStore((state) => state.data.activeWorkspacePanel);
    const setPanel = useUIStore((state) => state.actions.setWorkspacePanel);

    const tabs = [
        { id: 'files', label: 'Sources', icon: FileText },
        { id: 'content', label: 'Workspace', icon: BookOpen },
        { id: 'tutor', label: 'Tutor', icon: MessageSquare },
    ];

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-purple-100 px-4 py-2 z-40 flex items-center justify-around pb-safe">
            {tabs.map((tab) => {
                const isActive = activePanel === tab.id;
                const Icon = tab.icon;
                
                return (
                    <button
                        key={tab.id}
                        onClick={() => setPanel(tab.id)}
                        className={`relative flex flex-col items-center gap-1 p-2 min-w-[70px] transition-colors ${isActive ? 'text-purple-600' : 'text-gray-400'}`}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="activeTab"
                                className="absolute inset-0 bg-purple-50 rounded-xl -z-10"
                                initial={false}
                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            />
                        )}
                        <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : 'scale-100'} transition-transform`} />
                        <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default MobilePanelSwitcher;
