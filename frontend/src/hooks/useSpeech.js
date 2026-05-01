import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for Web Speech API (Recognition and Synthesis)
 */
export const useSpeech = () => {
    const [isListening, setIsListening] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voices, setVoices] = useState([]);
    const recognitionRef = useRef(null);

    // Load voices and handle async growth of voice list
    useEffect(() => {
        const loadVoices = () => {
            const v = window.speechSynthesis.getVoices();
            setVoices(v);
        };
        loadVoices();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
    }, []);

    const stopSpeaking = useCallback(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, []);

    const speak = useCallback((text) => {
        if (!window.speechSynthesis) return;

        // Cancel any ongoing speech
        stopSpeaking();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Quality Heuristic: Prefer Google US English or high-quality voices
        const selectedVoice = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) 
                           || voices.find(v => v.lang.startsWith('en')) 
                           || voices[0];
        
        if (selectedVoice) utterance.voice = selectedVoice;
        
        utterance.lang = 'en-US';
        utterance.rate = 0.95; // Slightly slower is often clearer
        utterance.pitch = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
            console.error('SpeechSynthesis Error:', e);
            setIsSpeaking(false);
        };

        window.speechSynthesis.speak(utterance);
    }, [stopSpeaking, voices]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            recognitionRef.current = null;
        }
        setIsListening(false);
    }, []);

    const listen = useCallback((onResult) => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error('Speech recognition not supported in this browser.');
            return;
        }

        if (isListening) {
            stopListening();
            return;
        }

        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            if (onResult) onResult(transcript);
        };

        recognition.start();
    }, [isListening, stopListening]);

    const cancel = useCallback(() => {
        stopSpeaking();
        stopListening();
    }, [stopSpeaking, stopListening]);

    return {
        isListening,
        isSpeaking,
        speak,
        listen,
        stopSpeaking,
        stopListening,
        cancel
    };
};
