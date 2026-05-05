import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, Trash2, Pencil, Check, X, MessageSquare, ChevronLeft, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const SessionItem = ({ session, isActive, onSelect, onRename, onDelete }) => {
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(session.title);
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    const commitRename = () => {
        const trimmed = editTitle.trim();
        if (trimmed && trimmed !== session.title) {
            onRename(session.id, trimmed);
        } else {
            setEditTitle(session.title);
        }
        setEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') { setEditTitle(session.title); setEditing(false); }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className={`group relative rounded-xl px-3 py-2.5 cursor-pointer transition-all ${
                isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                    : 'hover:bg-indigo-50 text-gray-700'
            }`}
            onClick={() => !editing && onSelect(session.id)}
        >
            <div className="flex items-start gap-2.5 min-w-0">
                <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isActive ? 'text-indigo-200' : 'text-indigo-400'}`} />
                <div className="flex-1 min-w-0">
                    {editing ? (
                        <input
                            ref={inputRef}
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={commitRename}
                            onClick={e => e.stopPropagation()}
                            className="w-full bg-transparent outline-none text-xs font-bold border-b border-indigo-300 pb-0.5"
                        />
                    ) : (
                        <p className={`text-xs font-bold truncate leading-tight ${isActive ? 'text-white' : 'text-gray-800'}`}>
                            {session.title}
                        </p>
                    )}
                    <p className={`text-[10px] mt-0.5 ${isActive ? 'text-indigo-200' : 'text-gray-400'}`}>
                        {session.updated_at
                            ? formatDistanceToNow(new Date(session.updated_at), { addSuffix: true })
                            : 'Just now'}
                    </p>
                </div>
            </div>

            {/* Action buttons — shown on hover */}
            {!editing && (
                <div
                    className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1
                        opacity-0 group-hover:opacity-100 transition-opacity
                        ${isActive ? '' : ''}`}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        className={`p-1 rounded-lg transition-colors ${
                            isActive ? 'hover:bg-indigo-500 text-indigo-200' : 'hover:bg-indigo-100 text-gray-400 hover:text-indigo-600'
                        }`}
                        onClick={() => { setEditTitle(session.title); setEditing(true); }}
                        title="Rename"
                    >
                        <Pencil className="w-3 h-3" />
                    </button>
                    <button
                        className={`p-1 rounded-lg transition-colors ${
                            isActive ? 'hover:bg-red-500 text-indigo-200' : 'hover:bg-red-50 text-gray-400 hover:text-red-500'
                        }`}
                        onClick={() => onDelete(session.id)}
                        title="Delete"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            )}
        </motion.div>
    );
};

const ChatSidebar = ({
    sessions,
    activeSessionId,
    sessionsLoading,
    savedMessages = [],
    savedLoading = false,
    onSelectSession,
    onSelectSavedMessage,
    onNewChat,
    onRenameSession,
    onDeleteSession,
    onClose,
}) => {
    return (
        <div className="flex flex-col h-full bg-white border-r border-indigo-50 w-64 shrink-0">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-indigo-50">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                    Chat History
                </span>
                <div className="flex items-center gap-1">
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onNewChat}
                        className="p-1.5 rounded-xl hover:bg-indigo-50 text-indigo-500 hover:text-indigo-700 transition-colors"
                        title="New chat"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                    </motion.button>
                    <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors"
                        title="Close sidebar"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </motion.button>
                </div>
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {sessionsLoading ? (
                    <div className="space-y-2 px-1 pt-2">
                        {[1, 2, 3].map(n => (
                            <div key={n} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
                        ))}
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                        <MessageSquare className="w-8 h-8 text-indigo-200 mb-2" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            No conversations yet
                        </p>
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {sessions.map(session => (
                            <SessionItem
                                key={session.id}
                                session={session}
                                isActive={session.id === activeSessionId}
                                onSelect={onSelectSession}
                                onRename={onRenameSession}
                                onDelete={onDeleteSession}
                            />
                        ))}
                    </AnimatePresence>
                )}
            </div>

            {/* Saved messages */}
            <div className="border-t border-indigo-50 px-4 py-3">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                        <Bookmark className="w-3.5 h-3.5" />
                        Saved messages
                    </div>
                    {savedLoading && <span className="text-[10px] text-gray-400">Loading…</span>}
                </div>
                {savedMessages.length === 0 ? (
                    <p className="text-[10px] text-gray-400 leading-5">
                        Save an answer to revisit it later.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {savedMessages.slice(0, 4).map((message) => (
                            <button
                                key={message.id}
                                type="button"
                                onClick={() => onSelectSavedMessage(message.session_id)}
                                className="w-full text-left rounded-xl p-3 bg-slate-50 hover:bg-indigo-50 transition-colors"
                            >
                                <p className="text-[11px] font-semibold text-gray-800 truncate">
                                    {message.content || 'Saved answer'}
                                </p>
                                <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                                    {message.session_title || 'Conversation'} · {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatSidebar;
