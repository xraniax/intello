import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useSpeech } from '@/hooks/useSpeech';
import { ChatService } from '@/services/ChatService';
import { useChatSessions } from './useChatSessions';

/**
 * useWorkspaceChat
 * Owns: chat messages (in-memory + DB-persisted), streaming state,
 * session management, speech I/O, and message actions.
 */
export const useWorkspaceChat = ({ subjectId, selectedUploads = [] }) => {
    const [chatMessages, setChatMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [chatError, setChatError] = useState('');
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [savedMessages, setSavedMessages] = useState([]);
    const [savedLoading, setSavedLoading] = useState(false);
    const chatEndRef = useRef(null);
    const abortRef = useRef(null);
    const streamingIdRef = useRef(null);
    // When streaming auto-creates a new session, skip the DB re-fetch that would
    // overwrite the in-memory typing placeholder before the AI finishes responding.
    const skipNextDbLoadRef = useRef(false);

    const { speak, listen, isListening, isSpeaking, stopSpeaking, cancel } = useSpeech();

    const sessions = useChatSessions({ subjectId });

    const loadSavedMessages = useCallback(async () => {
        if (!subjectId) {
            setSavedMessages([]);
            return;
        }
        const token = localStorage.getItem('token');
        if (!token) {
            setSavedMessages([]);
            return;
        }
        setSavedLoading(true);
        try {
            const res = await ChatService.getBookmarks(subjectId);
            setSavedMessages(res.data?.data || []);
        } catch (err) {
            console.error('[useWorkspaceChat] Saved messages load error:', err.message);
        } finally {
            setSavedLoading(false);
        }
    }, [subjectId]);

    useEffect(() => {
        loadSavedMessages();
    }, [loadSavedMessages]);

    // ── Load messages when switching sessions ─────────────────────────────────

    useEffect(() => {
        // A streaming reply just created this session — messages are already in
        // memory (user msg + live AI placeholder). Skip the DB fetch so we don't
        // clobber the typing bubble.
        if (skipNextDbLoadRef.current) {
            skipNextDbLoadRef.current = false;
            return;
        }
        if (!sessions.activeSessionId) {
            setChatMessages([]);
            return;
        }
        ChatService.getMessages(sessions.activeSessionId)
            .then(res => {
                const msgs = (res.data?.data || []).map(m => ({
                    id: m.id,
                    role: m.role === 'assistant' ? 'ai' : m.role,
                    content: m.content,
                    sources: m.sources || [],
                    confidence: m.confidence || 0,
                    isError: m.is_error || false,
                    feedback: m.feedback || null,
                    bookmarked: m.bookmarked || false,
                    timestamp: m.created_at,
                }));
                setChatMessages(msgs);
            })
            .catch(err => console.error('[useWorkspaceChat] Load messages failed:', err.message));
    }, [sessions.activeSessionId]);

    // ── Auto-scroll ───────────────────────────────────────────────────────────

    const scrollToBottom = useCallback(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // ── Stop streaming ────────────────────────────────────────────────────────

    const stopGeneration = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
    }, []);

    // ── Main chat handler (streaming) ─────────────────────────────────────────

    const handleChat = useCallback(async (e, questionOverride = null) => {
        if (e) e.preventDefault();
        const question = (questionOverride ?? currentQuestion).trim();
        if (!question || isStreaming) return;

        const token = localStorage.getItem('token');
        if (!token) {
            setChatError('Please log in to use the chat feature.');
            return;
        }

        setChatError('');
        if (!questionOverride) setCurrentQuestion('');

        // Build history from current messages (exclude errors and in-progress)
        const history = chatMessages
            .filter(m => !m.isError && !m.isStreaming)
            .map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content }))
            .slice(-20);

        // Add user message optimistically
        const tempUserId = `user-${Date.now()}`;
        const userMsg = {
            id: tempUserId,
            role: 'user',
            content: question,
            timestamp: new Date().toISOString(),
        };
        setChatMessages(prev => [...prev, userMsg]);

        // Add streaming placeholder
        const tempAiId = `ai-streaming-${Date.now()}`;
        streamingIdRef.current = tempAiId;
        setChatMessages(prev => [...prev, {
            id: tempAiId,
            role: 'ai',
            content: '',
            isStreaming: true,
            timestamp: new Date().toISOString(),
        }]);

        setIsStreaming(true);
        const controller = new AbortController();
        abortRef.current = controller;

        try {
            await ChatService.streamChat({
                sessionId: sessions.activeSessionId,
                subjectId,
                question,
                history,
                materialIds: selectedUploads.map(m => m.id),
                signal: controller.signal,

                onSession: ({ session, userMessageId }) => {
                    // Raise the flag BEFORE upsertSession changes activeSessionId,
                    // so the useEffect that watches activeSessionId skips the DB fetch.
                    skipNextDbLoadRef.current = true;
                    sessions.upsertSession(session);
                    // Swap temp user message id for the DB id
                    setChatMessages(prev =>
                        prev.map(m => m.id === tempUserId ? { ...m, id: userMessageId } : m)
                    );
                },

                onToken: (text) => {
                    setChatMessages(prev =>
                        prev.map(m =>
                            m.id === streamingIdRef.current
                                ? { ...m, content: m.content + text }
                                : m
                        )
                    );
                    scrollToBottom();
                },

                onDone: ({ messageId, sessionId, sources, confidence }) => {
                    setChatMessages(prev =>
                        prev.map(m =>
                            m.id === streamingIdRef.current
                                ? { ...m, id: messageId, isStreaming: false, sources: sources || [], confidence: confidence || 0 }
                                : m
                        )
                    );
                    sessions.touchSession(sessionId);
                    scrollToBottom();
                },

                onError: (message) => {
                    setChatMessages(prev =>
                        prev.map(m =>
                            m.id === streamingIdRef.current
                                ? { ...m, isStreaming: false, content: message, isError: true }
                                : m
                        )
                    );
                },
            });
        } catch (err) {
            if (err.name === 'AbortError') {
                // Mark as completed with partial content
                setChatMessages(prev =>
                    prev.map(m =>
                        m.id === streamingIdRef.current
                            ? { ...m, isStreaming: false }
                            : m
                    )
                );
            } else {
                console.error('[useWorkspaceChat] Stream error:', err);
                const msg = err.message || 'AI engine is unreachable. Please try again.';
                setChatError(msg);
                setChatMessages(prev =>
                    prev.map(m =>
                        m.id === streamingIdRef.current
                            ? { ...m, isStreaming: false, content: `Error: ${msg}`, isError: true }
                            : m
                    )
                );
            }
        } finally {
            setIsStreaming(false);
            abortRef.current = null;
            streamingIdRef.current = null;
        }
    }, [currentQuestion, isStreaming, chatMessages, subjectId, selectedUploads, sessions, scrollToBottom]);

    // ── Clear / new chat ──────────────────────────────────────────────────────

    const handleNewChat = useCallback(async () => {
        stopGeneration();
        setChatMessages([]);
        setCurrentQuestion('');
        setChatError('');
        // Create a fresh session
        await sessions.createSession('New Chat');
    }, [stopGeneration, sessions]);

    const handleSwitchSession = useCallback((sessionId) => {
        stopGeneration();
        skipNextDbLoadRef.current = false; // always load from DB on explicit switch
        setChatMessages([]);
        setChatError('');
        sessions.setActiveSessionId(sessionId);
    }, [stopGeneration, sessions]);

    // ── Message actions ───────────────────────────────────────────────────────

    const handleFeedback = useCallback(async (messageId, feedback) => {
        const sessionId = sessions.activeSessionId;
        if (!sessionId) return;
        try {
            await ChatService.updateFeedback(messageId, sessionId, feedback);
            setChatMessages(prev =>
                prev.map(m => m.id === messageId ? { ...m, feedback } : m)
            );
        } catch (err) {
            console.error('[useWorkspaceChat] Feedback error:', err.message);
        }
    }, [sessions.activeSessionId]);

    const handleBookmark = useCallback(async (messageId, bookmarked) => {
        const sessionId = sessions.activeSessionId;
        if (!sessionId) return;

        const previousBookmarked = chatMessages.find(m => m.id === messageId)?.bookmarked;
        setChatMessages(prev =>
            prev.map(m => m.id === messageId ? { ...m, bookmarked } : m)
        );

        try {
            await ChatService.updateBookmark(messageId, sessionId, bookmarked);
            toast.success(bookmarked ? 'Message saved' : 'Saved message removed');
            await loadSavedMessages();
        } catch (err) {
            setChatMessages(prev =>
                prev.map(m => m.id === messageId ? { ...m, bookmarked: previousBookmarked } : m)
            );
            toast.error('Unable to save the message. Please try again.');
            console.error('[useWorkspaceChat] Bookmark error:', err.message);
        }
    }, [sessions.activeSessionId, chatMessages, loadSavedMessages]);

    const handleCopyMessage = useCallback((content) => {
        navigator.clipboard.writeText(content).catch(() => {});
    }, []);

    const handleEditAndResend = useCallback((messageId, content) => {
        // Remove the message and everything after it, then put content in input
        setChatMessages(prev => {
            const idx = prev.findIndex(m => m.id === messageId);
            if (idx === -1) return prev;
            return prev.slice(0, idx);
        });
        setCurrentQuestion(content);
    }, []);

    const handleRegenerate = useCallback(() => {
        // Find the last user message and resend it
        const lastUser = [...chatMessages].reverse().find(m => m.role === 'user');
        if (!lastUser) return;
        // Remove last AI response
        setChatMessages(prev => {
            const lastAiIdx = [...prev].map((m, i) => ({ m, i })).reverse().find(({ m }) => m.role === 'ai')?.i;
            if (lastAiIdx === undefined) return prev;
            return prev.slice(0, lastAiIdx);
        });
        handleChat(null, lastUser.content);
    }, [chatMessages, handleChat]);

    // ── Voice helpers ─────────────────────────────────────────────────────────

    const handleVoiceInput = useCallback(() => {
        if (isListening) {
            cancel();
        } else {
            listen((transcript) => {
                setCurrentQuestion(transcript);
            });
        }
    }, [isListening, listen, cancel]);

    const handleTTS = useCallback((content) => {
        if (isSpeaking) {
            stopSpeaking();
        } else {
            speak(content);
        }
    }, [isSpeaking, speak, stopSpeaking]);

    return {
        // Messages
        chatMessages,
        setChatMessages,
        currentQuestion,
        setCurrentQuestion,

        // State
        isStreaming,
        isThinking: isStreaming, // backward-compat alias
        chatError,
        setChatError,
        chatCollapsed,
        setChatCollapsed,
        chatEndRef,

        // Actions
        handleChat,
        handleNewChat,
        handleSwitchSession,
        stopGeneration,

        // Message actions
        handleFeedback,
        handleBookmark,
        handleCopyMessage,
        handleEditAndResend,
        handleRegenerate,

        // Saved messages
        savedMessages,
        savedLoading,

        // Voice
        speak,
        isSpeaking,
        stopSpeaking,
        listen,
        isListening,
        cancel,
        handleVoiceInput,
        handleTTS,

        // Sessions
        ...sessions,
    };
};
