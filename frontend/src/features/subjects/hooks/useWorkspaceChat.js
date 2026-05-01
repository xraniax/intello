import { useState, useRef, useCallback } from 'react';
import { useSpeech } from '@/hooks/useSpeech';
import { MaterialService } from '@/services/MaterialService';

/**
 * useWorkspaceChat
 * Owns: chat messages, current question, thinking state, speech, handleChat.
 */
export const useWorkspaceChat = ({ subjectId }) => {
    const [chatMessages, setChatMessages] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [chatError, setChatError] = useState('');
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const chatEndRef = useRef(null);

    const { speak, listen, isListening, isSpeaking, stopSpeaking, cancel } = useSpeech();

    const handleChat = useCallback(async (e) => {
        if (e) e.preventDefault();
        if (!currentQuestion.trim() || isThinking) return;

        // Check if user is authenticated before proceeding
        const token = localStorage.getItem('token');
        if (!token) {
            setChatError('Please log in to use the chat feature.');
            return;
        }

        setChatError('');
        const userMsg = { role: 'user', content: currentQuestion };
        
        // Append user message immediately
        setChatMessages(prev => [...prev, userMsg]);
        setCurrentQuestion('');
        setIsThinking(true);

        try {
            // Build conversation history for the engine (exclude current question)
            const history = chatMessages
                .filter(m => !m.isError)
                .map(m => ({
                    role: m.role === 'ai' ? 'assistant' : m.role,
                    content: m.content,
                }))
                .slice(-10); // Windowed memory

            const res = await MaterialService.unifiedChat(subjectId, userMsg.content, history);
            const { answer, sources, confidence } = res.data.data;

            setChatMessages(prev => [...prev, { 
                role: 'ai', 
                content: answer,
                sources: sources || [],
                confidence: confidence || 0
            }]);
        } catch (err) {
            console.error('[useWorkspaceChat] Global Chat Error:', err);
            const msg = err.response?.data?.message || err.message || 'AI engine is unreachable. Please try again.';
            setChatError(msg);
            setChatMessages(prev => [...prev, { 
                role: 'ai', 
                content: `Error: ${msg}`,
                isError: true 
            }]);
        } finally {
            setIsThinking(false);
        }
    }, [currentQuestion, isThinking, chatMessages, subjectId]);

    return {
        chatMessages,
        setChatMessages,
        currentQuestion,
        setCurrentQuestion,
        isThinking,
        chatError,
        setChatError,
        chatEndRef,
        chatCollapsed,
        setChatCollapsed,
        handleChat,
        speak,
        isSpeaking,
        stopSpeaking,
        listen,
        isListening,
        cancel,
    };
};
