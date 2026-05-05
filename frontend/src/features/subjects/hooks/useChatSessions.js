import { useState, useCallback, useEffect } from 'react';
import { ChatService } from '@/services/ChatService';

/**
 * useChatSessions
 * Manages the list of chat sessions for a given subject.
 * Provides CRUD operations: load, create, rename, delete, switch.
 */
export const useChatSessions = ({ subjectId }) => {
    const [sessions, setSessions] = useState([]);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [sessionsLoading, setSessionsLoading] = useState(false);

    const loadSessions = useCallback(async () => {
        if (!subjectId) return;
        setSessionsLoading(true);
        try {
            const res = await ChatService.getSessions(subjectId);
            const list = res.data?.data || [];
            setSessions(list);
            // Auto-select the most recently used session
            if (list.length > 0 && !activeSessionId) {
                setActiveSessionId(list[0].id);
            }
        } catch (err) {
            console.error('[useChatSessions] Failed to load sessions:', err.message);
        } finally {
            setSessionsLoading(false);
        }
    }, [subjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const createSession = useCallback(async (title = 'New Chat') => {
        try {
            const res = await ChatService.createSession(subjectId, title);
            const newSession = res.data?.data;
            setSessions(prev => [newSession, ...prev]);
            setActiveSessionId(newSession.id);
            return newSession;
        } catch (err) {
            console.error('[useChatSessions] Failed to create session:', err.message);
            return null;
        }
    }, [subjectId]);

    const renameSession = useCallback(async (id, title) => {
        try {
            await ChatService.renameSession(id, title);
            setSessions(prev =>
                prev.map(s => s.id === id ? { ...s, title } : s)
            );
        } catch (err) {
            console.error('[useChatSessions] Failed to rename session:', err.message);
        }
    }, []);

    const deleteSession = useCallback(async (id) => {
        try {
            await ChatService.deleteSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
            if (activeSessionId === id) {
                const remaining = sessions.filter(s => s.id !== id);
                setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
            }
        } catch (err) {
            console.error('[useChatSessions] Failed to delete session:', err.message);
        }
    }, [activeSessionId, sessions]);

    // Called when a streaming response creates or updates a session
    const upsertSession = useCallback((session) => {
        setSessions(prev => {
            const exists = prev.find(s => s.id === session.id);
            if (exists) {
                return prev.map(s => s.id === session.id ? { ...s, ...session } : s);
            }
            return [session, ...prev];
        });
        setActiveSessionId(session.id);
    }, []);

    const touchSession = useCallback((id) => {
        setSessions(prev =>
            prev
                .map(s => s.id === id ? { ...s, updated_at: new Date().toISOString() } : s)
                .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        );
    }, []);

    return {
        sessions,
        setSessions,
        activeSessionId,
        setActiveSessionId,
        sessionsLoading,
        loadSessions,
        createSession,
        renameSession,
        deleteSession,
        upsertSession,
        touchSession,
    };
};
