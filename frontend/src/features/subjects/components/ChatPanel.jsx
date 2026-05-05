import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Bot, User, Send, Mic, MicOff, Volume2, VolumeX,
    Square, Copy, ThumbsUp, ThumbsDown, Bookmark, BookmarkCheck,
    RefreshCw, PenLine, PanelRightClose, History,
    ChevronDown, Sparkles, BookOpen, HelpCircle, Lightbulb,
    Check,
} from 'lucide-react';
import { motion as m } from 'framer-motion';
import MarkdownRenderer from './MarkdownRenderer';
import ChatSidebar from './ChatSidebar';
import { formatDistanceToNow } from 'date-fns';

// ─── Typing / streaming cursor ──────────────────────────────────────────────

const StreamCursor = () => (
    <motion.span
        className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 align-middle rounded-full"
        animate={{ opacity: [1, 0.2, 1], y: [0, -3, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
    />
);

// ─── Animated thinking dots ──────────────────────────────────────────────────

const ThinkingDots = () => (
    <div className="flex gap-1.5 items-center">
        {[0, 1, 2].map(i => (
            <motion.div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                    background: i === 0
                        ? 'var(--c-primary-light)'
                        : i === 1 ? 'var(--c-primary)' : 'var(--c-primary-hover)'
                }}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            />
        ))}
    </div>
);

// ─── Suggested prompts ───────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
    { icon: BookOpen, text: 'Summarize the main topics' },
    { icon: HelpCircle, text: 'What are the key concepts?' },
    { icon: Lightbulb, text: 'Give me a study tip from this material' },
    { icon: Sparkles, text: 'Create a quick quiz question' },
];

// ─── Per-message action bar ──────────────────────────────────────────────────

const MessageActions = ({
    msg,
    isAI,
    speakingIdx,
    idx,
    isSpeaking,
    onListen,
    onCopy,
    onFeedback,
    onBookmark,
    onRegenerate,
    onEdit,
    justCopied,
}) => {
    if (msg.isStreaming) return null;

    return (
        <div className={`flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-150 ${
            isAI ? 'justify-start' : 'justify-end'
        }`}>
            {isAI ? (
                <>
                    {/* Listen / Stop speaking */}
                    <ActionBtn
                        onClick={() => onListen(msg.content, idx)}
                        title={isSpeaking && speakingIdx === idx ? 'Stop' : 'Listen'}
                        active={isSpeaking && speakingIdx === idx}
                        activeClass="text-indigo-600 bg-indigo-50"
                    >
                        {isSpeaking && speakingIdx === idx
                            ? <VolumeX className="w-3.5 h-3.5" />
                            : <Volume2 className="w-3.5 h-3.5" />}
                    </ActionBtn>

                    {/* Copy */}
                    <ActionBtn onClick={() => onCopy(msg.content)} title="Copy">
                        {justCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </ActionBtn>

                    {/* Thumbs up */}
                    <ActionBtn
                        onClick={() => onFeedback(msg.id, msg.feedback === 'up' ? null : 'up')}
                        title="Good response"
                        active={msg.feedback === 'up'}
                        activeClass="text-green-600 bg-green-50"
                    >
                        <ThumbsUp className="w-3.5 h-3.5" />
                    </ActionBtn>

                    {/* Thumbs down */}
                    <ActionBtn
                        onClick={() => onFeedback(msg.id, msg.feedback === 'down' ? null : 'down')}
                        title="Bad response"
                        active={msg.feedback === 'down'}
                        activeClass="text-red-600 bg-red-50"
                    >
                        <ThumbsDown className="w-3.5 h-3.5" />
                    </ActionBtn>

                    {/* Save / unsave message */}
                    <ActionBtn
                        onClick={() => onBookmark(msg.id, !msg.bookmarked)}
                        title={msg.bookmarked ? 'Remove saved message' : 'Save message'}
                        active={msg.bookmarked}
                        activeClass="text-amber-500 bg-amber-50"
                    >
                        {msg.bookmarked
                            ? <BookmarkCheck className="w-3.5 h-3.5" />
                            : <Bookmark className="w-3.5 h-3.5" />}
                    </ActionBtn>

                    {/* Regenerate */}
                    <ActionBtn onClick={onRegenerate} title="Regenerate response">
                        <RefreshCw className="w-3.5 h-3.5" />
                    </ActionBtn>
                </>
            ) : (
                /* User message: Edit & resend */
                <ActionBtn
                    onClick={() => onEdit(msg.id, msg.content)}
                    title="Edit and resend"
                >
                    <PenLine className="w-3.5 h-3.5" />
                </ActionBtn>
            )}
        </div>
    );
};

const ActionBtn = ({ onClick, title, active, activeClass, children }) => (
    <button
        onClick={onClick}
        title={title}
        className={`p-1.5 rounded-lg transition-colors text-gray-400 hover:text-gray-600 hover:bg-gray-100
            ${active ? activeClass : ''}`}
    >
        {children}
    </button>
);

// ─── Single message bubble ────────────────────────────────────────────────────

const MessageBubble = ({
    msg, idx, isSpeaking, speakingIdx,
    onListen, onCopy, onFeedback, onBookmark, onRegenerate, onEdit,
}) => {
    const [justCopied, setJustCopied] = useState(false);
    const isAI = msg.role === 'ai';

    const handleCopy = (content) => {
        onCopy(content);
        setJustCopied(true);
        setTimeout(() => setJustCopied(false), 2000);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`flex flex-col group ${isAI ? 'items-start' : 'items-end'}`}
        >
            <div className={`flex items-end gap-3 max-w-[92%] ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* Avatar */}
                <motion.div
                    className={`w-8 h-8 rounded-2xl shadow-sm border-2 flex items-center justify-center shrink-0 mb-5 ${
                        isAI
                            ? (msg.isError
                                ? 'bg-red-50 border-red-100 text-red-400'
                                : 'bg-white border-indigo-100 text-indigo-500')
                            : 'bg-purple-50 border-purple-100 text-purple-500'
                    }`}
                    whileHover={{ scale: 1.1 }}
                >
                    {isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </motion.div>

                <div className="flex flex-col gap-1 min-w-0">
                    {/* Bubble */}
                    <div className={`px-5 py-3.5 rounded-2xl shadow-sm transition-all relative ${
                        isAI
                            ? (msg.isError
                                ? 'bg-red-50 border-2 border-red-100 text-red-700 rounded-bl-sm'
                                : 'bg-white border-2 border-indigo-50 text-indigo-950 rounded-bl-sm')
                            : 'bg-indigo-600 text-white rounded-br-sm shadow-indigo-100'
                    }`}>
                        {/* Content */}
                        {isAI && !msg.isError ? (
                            <div>
                                {msg.isStreaming && !msg.content ? (
                                    <div className="flex items-center gap-3 py-1">
                                        <ThinkingDots />
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                                            Thinking...
                                        </span>
                                    </div>
                                ) : (
                                    <div className="min-h-[1.4rem] text-sm leading-relaxed">
                                        <MarkdownRenderer content={msg.content} />
                                        {msg.isStreaming && (
                                            <span className="inline-flex items-center">
                                                <StreamCursor />
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Sources */}
                                {/* Removed sources buttons */}

                                {/* Confidence */}
                                {!msg.isStreaming && msg.confidence > 0 && (
                                    <div className="mt-2 flex items-center gap-1.5">
                                        <div
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ background: msg.confidence > 0.8 ? '#10B981' : '#F59E0B' }}
                                        />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">
                                            {Math.round(msg.confidence * 100)}% confidence
                                        </span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={`text-sm font-semibold leading-relaxed whitespace-pre-wrap ${
                                isAI && msg.isError ? 'text-red-600' : ''
                            }`}>
                                {msg.content}
                                {msg.isStreaming && !msg.content && (
                                    <div className="flex items-center gap-3 py-1">
                                        <ThinkingDots />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error retry */}
                        {msg.isError && (
                            <button
                                onClick={() => onRegenerate()}
                                className="mt-3 w-full py-2 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 text-[10px] font-black uppercase tracking-widest transition-colors"
                            >
                                Retry
                            </button>
                        )}
                    </div>

                    {/* Timestamp */}
                    {msg.timestamp && (
                        <span className={`text-[9px] text-gray-400 px-1 ${isAI ? 'text-left' : 'text-right'}`}>
                            {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                        </span>
                    )}

                    {/* Action buttons */}
                    <MessageActions
                        msg={msg}
                        isAI={isAI}
                        idx={idx}
                        speakingIdx={speakingIdx}
                        isSpeaking={isSpeaking}
                        onListen={onListen}
                        onCopy={handleCopy}
                        onFeedback={onFeedback}
                        onBookmark={onBookmark}
                        onRegenerate={onRegenerate}
                        onEdit={onEdit}
                        justCopied={justCopied}
                    />
                </div>
            </div>
        </motion.div>
    );
};

// ─── Main ChatPanel component ─────────────────────────────────────────────────

const ChatPanel = ({
    // Messages & state
    chatMessages,
    currentQuestion,
    setCurrentQuestion,
    isStreaming,
    isThinking,
    chatError,
    chatEndRef,
    contextInfo,

    // Actions
    handleChat,
    handleNewChat,
    handleSwitchSession,
    stopGeneration,
    handleFeedback,
    handleBookmark,
    handleCopyMessage,
    handleEditAndResend,
    handleRegenerate,

    // Voice
    handleVoiceInput,
    handleTTS,
    isListening,
    isSpeaking,
    stopSpeaking,

    // Sessions
    sessions,
    activeSessionId,
    sessionsLoading,
    savedMessages,
    savedLoading,
    renameSession,
    deleteSession,

    // Layout
    onCollapse,
}) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [speakingIdx, setSpeakingIdx] = useState(null);
    const [rows, setRows] = useState(1);
    const inputRef = useRef(null);
    const messagesRef = useRef(null);
    const prevMessageCountRef = useRef(0);
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    const streaming = isStreaming || isThinking;

    // Reset speaking index when speech ends
    useEffect(() => {
        if (!isSpeaking) setSpeakingIdx(null);
    }, [isSpeaking]);

    // Auto-resize textarea
    useEffect(() => {
        const lines = (currentQuestion.match(/\n/g) || []).length + 1;
        setRows(Math.min(Math.max(lines, 1), 6));
    }, [currentQuestion]);

    // Show scroll-to-bottom button when not at bottom
    useEffect(() => {
        const el = messagesRef.current;
        if (!el) return;
        const onScroll = () => {
            setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
        };
        el.addEventListener('scroll', onScroll);
        return () => el.removeEventListener('scroll', onScroll);
    }, []);

    // Auto-scroll when new messages arrive
    useEffect(() => {
        const el = messagesRef.current;
        if (!el) return;
        const prevCount = prevMessageCountRef.current;
        const currentCount = chatMessages.length;
        const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 180;

        if (currentCount > prevCount || streaming) {
            if (isNearBottom || currentCount > prevCount) {
                chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
        }

        prevMessageCountRef.current = currentCount;
    }, [chatMessages, streaming]);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const onListenToggle = (content, idx) => {
        if (isSpeaking && speakingIdx === idx) {
            stopSpeaking();
        } else {
            setSpeakingIdx(idx);
            handleTTS(content);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleChat(e);
        }
    };

    return (
        <div className="panel-inner chat-panel flex h-full overflow-hidden" style={{ background: 'var(--c-canvas)' }}>
            {/* ── Sidebar ────────────────────────────────────────────────────── */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        key="sidebar"
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 256, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        className="overflow-hidden shrink-0 h-full"
                    >
                        <ChatSidebar
                            sessions={sessions || []}
                            activeSessionId={activeSessionId}
                            sessionsLoading={sessionsLoading}
                            savedMessages={savedMessages}
                            savedLoading={savedLoading}
                            onSelectSession={(id) => handleSwitchSession(id)}
                            onSelectSavedMessage={(sessionId) => handleSwitchSession(sessionId)}
                            onNewChat={() => { handleNewChat(); }}
                            onRenameSession={renameSession}
                            onDeleteSession={deleteSession}
                            onClose={() => setSidebarOpen(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Main chat area ─────────────────────────────────────────────── */}
            <div className="flex flex-col flex-1 min-w-0 h-full">
                {/* Header */}
                <div className="panel-header px-4 py-3.5 bg-white/90 backdrop-blur-md sticky top-0 z-10 border-b-2 border-indigo-50 shadow-sm flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        {/* Chat history button */}
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setSidebarOpen(p => !p)}
                            className={`relative p-2 rounded-xl transition-colors ${
                                sidebarOpen
                                    ? 'bg-indigo-100 text-indigo-600'
                                    : 'hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600'
                            }`}
                            title={`${sessions?.length || 0} conversation${sessions?.length !== 1 ? 's' : ''}`}
                        >
                            <History className="w-4 h-4" />
                            {sessions?.length > 0 && (
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white"
                                >
                                    {sessions.length}
                                </motion.div>
                            )}
                        </motion.button>

                        {/* Bot avatar with live pulse */}
                        <div className="relative">
                            <motion.div
                                className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center"
                                animate={{ rotate: [0, 4, -4, 0] }}
                                transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
                            >
                                <Bot className="w-5 h-5" />
                            </motion.div>
                            <motion.div
                                className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"
                                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        </div>

                        <div>
                            <span className="font-black tracking-[0.2em] uppercase text-[10px] text-gray-400 block">
                                AI Tutor
                            </span>
                            {streaming && (
                                <span className="text-[9px] text-indigo-400 font-bold animate-pulse">Generating...</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={handleNewChat}
                            className="p-2 rounded-xl hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600 transition-colors"
                            title="New conversation"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={onCollapse}
                            className="p-2 rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Hide panel"
                        >
                            <PanelRightClose className="w-4 h-4" />
                        </motion.button>
                    </div>
                </div>

                {/* Context info strip */}
                {contextInfo && (
                    <div className="px-4 py-1.5 border-b text-xs text-gray-400 font-medium bg-gray-50/50 shrink-0" style={{ borderColor: 'var(--c-border-soft)' }}>
                        {contextInfo}
                    </div>
                )}

                {/* Messages */}
                <div
                    ref={messagesRef}
                    className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
                    style={{ background: 'var(--c-canvas)' }}
                >
                    {/* Welcome / empty state */}
                    {chatMessages.length === 0 && !streaming && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center justify-center min-h-[300px] text-center p-6 space-y-6"
                        >
                            <motion.div
                                className="w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center shadow-inner"
                                animate={{ y: [0, -8, 0] }}
                                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Bot className="w-10 h-10 text-indigo-500" />
                            </motion.div>
                            <div className="space-y-1.5">
                                <p className="text-sm font-black uppercase tracking-[0.2em] text-indigo-950">
                                    Ready to Help
                                </p>
                                <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">
                                    Ask anything about your documents to get started.
                                </p>
                            </div>

                            {/* Suggested prompts */}
                            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
                                {SUGGESTED_PROMPTS.map(({ icon: Icon, text }, i) => (
                                    <motion.button
                                        key={i}
                                        whileHover={{ scale: 1.03, y: -1 }}
                                        whileTap={{ scale: 0.97 }}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.07 }}
                                        onClick={() => {
                                            setCurrentQuestion(text);
                                            setTimeout(() => inputRef.current?.focus(), 50);
                                        }}
                                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border-2 border-indigo-50 hover:border-indigo-200 hover:bg-indigo-50/50 text-left transition-all shadow-sm"
                                    >
                                        <Icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                        <span className="text-[10px] font-bold text-gray-600 leading-tight">{text}</span>
                                    </motion.button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Message list */}
                    <AnimatePresence initial={false}>
                        {chatMessages.map((msg, i) => (
                            <MessageBubble
                                key={msg.id || i}
                                msg={msg}
                                idx={i}
                                isSpeaking={isSpeaking}
                                speakingIdx={speakingIdx}
                                onListen={onListenToggle}
                                onCopy={handleCopyMessage}
                                onFeedback={handleFeedback}
                                onBookmark={handleBookmark}
                                onRegenerate={handleRegenerate}
                                onEdit={handleEditAndResend}
                            />
                        ))}
                    </AnimatePresence>

                    {/* Global error banner */}
                    {chatError && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mx-2 p-3 rounded-xl text-[10px] font-bold uppercase tracking-widest text-center"
                            style={{ background: 'var(--c-danger-light)', color: 'var(--c-danger)' }}
                        >
                            {chatError}
                        </motion.div>
                    )}

                    <div ref={chatEndRef} />
                </div>

                {/* Scroll-to-bottom button */}
                <AnimatePresence>
                    {showScrollBtn && (
                        <motion.button
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            onClick={scrollToBottom}
                            className="absolute bottom-28 right-6 p-2 rounded-full bg-white border-2 border-indigo-100 text-indigo-500 shadow-lg hover:shadow-xl transition-all z-10"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </motion.button>
                    )}
                </AnimatePresence>

                {/* Input area */}
                <div className="chat-input-area border-t-2 border-indigo-50 p-4 bg-white/80 backdrop-blur-sm shrink-0">
                    <div className={`flex items-end gap-2 p-2.5 rounded-2xl border-2 bg-white transition-all shadow-md ${
                        streaming ? 'border-indigo-200' : 'border-white focus-within:border-indigo-200 focus-within:shadow-lg'
                    }`}>
                        {/* Voice input */}
                        <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={handleVoiceInput}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                                isListening
                                    ? 'bg-red-500 text-white shadow-lg shadow-red-200'
                                    : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'
                            }`}
                            title={isListening ? 'Stop listening' : 'Voice input'}
                        >
                            {isListening
                                ? <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
                                    <MicOff className="w-4 h-4" />
                                </motion.div>
                                : <Mic className="w-4 h-4" />
                            }
                        </motion.button>

                        {/* Text input */}
                        <textarea
                            ref={inputRef}
                            rows={rows}
                            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-gray-800 placeholder:text-gray-300 resize-none py-1.5 px-1 leading-relaxed"
                            placeholder="Ask your tutor... (Shift+Enter for new line)"
                            value={currentQuestion}
                            onChange={e => setCurrentQuestion(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={false}
                        />

                        {/* Stop / Send button */}
                        {streaming ? (
                            <motion.button
                                type="button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={stopGeneration}
                                className="w-9 h-9 rounded-xl bg-red-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-red-200 transition-all"
                                title="Stop generation"
                            >
                                <Square className="w-3.5 h-3.5 fill-white" />
                            </motion.button>
                        ) : (
                            <motion.button
                                type="button"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleChat}
                                disabled={!currentQuestion.trim()}
                                className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-200 disabled:opacity-30 disabled:shadow-none transition-all"
                                title="Send"
                            >
                                <Send className="w-4 h-4 ml-0.5" />
                            </motion.button>
                        )}
                    </div>

                    <p className="text-center text-[9px] text-gray-300 mt-1.5 font-medium">
                        Answers grounded in your uploaded documents
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;
