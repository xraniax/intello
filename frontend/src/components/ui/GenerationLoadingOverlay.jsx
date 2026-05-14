import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, RotateCcw, Sparkles, Clock, Loader2 } from 'lucide-react';

/**
 * GenerationLoadingOverlay
 *
 * Rich loading indicator shown while AI content is being generated.
 * Displays: animated progress ring, dynamic estimated-time message,
 * elapsed timer, and error/retry state.
 */

const TIPS = [
    'AI is analyzing your source material…',
    'Building knowledge connections…',
    'Crafting high-quality questions…',
    'Almost there — polishing the output…',
];

const getEstimatedMinutes = (count) => {
    // ~12 seconds per item, rounded up to nearest minute
    const mins = Math.ceil((count * 12) / 60);
    return mins < 1 ? 1 : mins;
};

const friendlyType = (genType) => {
    const map = {
        quiz: 'quiz',
        flashcards: 'flashcard set',
        summary: 'summary',
        mock_exam: 'mock exam',
    };
    return map[genType] || genType?.replace('_', ' ') || 'material';
};

const formatElapsed = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const GenerationLoadingOverlay = ({
    isGenerating,
    genType = 'quiz',
    count = 10,
    error = '',
    onRetry,
    startTime,
    progress = '',
    onStop,
}) => {
    const [elapsed, setElapsed] = useState(0);
    const [tipIndex, setTipIndex] = useState(0);
    const [logs, setLogs] = useState([]);
    const intervalRef = useRef(null);
    const logScrollRef = useRef(null);

    // Activity Log logic
    useEffect(() => {
        if (progress) {
            setLogs(prev => {
                // Avoid duplicate consecutive logs
                if (prev.length > 0 && prev[prev.length - 1].message === progress) return prev;
                const timestamp = new Date().toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit',
                    hour12: false 
                });
                return [...prev, { timestamp, message: progress }];
            });
        }
    }, [progress]);

    // Auto-scroll logs
    useEffect(() => {
        if (logScrollRef.current) {
            logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Reset logs when generation starts
    useEffect(() => {
        if (isGenerating && !error && elapsed === 0) {
            setLogs([]);
        }
    }, [isGenerating, error, elapsed]);

    // Elapsed timer
    useEffect(() => {
        if (!isGenerating || error) {
            setElapsed(0);
            clearInterval(intervalRef.current);
            return;
        }

        const start = startTime || Date.now();
        const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
        tick();
        intervalRef.current = setInterval(tick, 1000);

        return () => clearInterval(intervalRef.current);
    }, [isGenerating, error, startTime]);

    // Cycle tips every 8 seconds
    useEffect(() => {
        if (!isGenerating || error) return;
        const id = setInterval(() => setTipIndex(prev => (prev + 1) % TIPS.length), 8000);
        return () => clearInterval(id);
    }, [isGenerating, error]);

    if (!isGenerating && !error) return null;

    const estimatedMins = getEstimatedMinutes(count);
    const estimatedLabel = estimatedMins === 1 ? '~1 minute' : `~${estimatedMins} minutes`;

    // ── Error State ──────────────────────────────────────────────
    if (error) {
        return (
            <div
                className="generation-overlay generation-overlay--error animate-in fade-in"
                role="alert"
                aria-live="assertive"
            >
                <div className="generation-overlay__icon generation-overlay__icon--error">
                    <AlertTriangle className="w-8 h-8 text-rose-500" />
                </div>

                <h3 className="text-base font-black text-rose-700 mt-4 mb-1">Generation Failed</h3>
                <p className="text-sm text-rose-600/80 font-medium max-w-xs text-center leading-relaxed mb-6">
                    {error}
                </p>

                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="flex items-center gap-2 px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-rose-200 hover:-translate-y-0.5 active:scale-95"
                        aria-label="Retry generation"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Retry Generation
                    </button>
                )}
            </div>
        );
    }

    // ── Loading State ────────────────────────────────────────────
    return (
        <div
            className="generation-overlay animate-in fade-in max-w-md mx-auto"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={`Generating ${friendlyType(genType)}. Estimated time: ${estimatedLabel}.`}
        >
            {/* Animated Progress Ring */}
            <div className="generation-overlay__ring-wrapper">
                <svg className="generation-overlay__ring" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth="6" />
                    <circle
                        cx="50" cy="50" r="42"
                        fill="none"
                        stroke="url(#progressGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray="180 264"
                        className="generation-overlay__ring-progress"
                    />
                    <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#818cf8" />
                            <stop offset="50%" stopColor="#a78bfa" />
                            <stop offset="100%" stopColor="#c084fc" />
                        </linearGradient>
                    </defs>
                </svg>

                <div className="generation-overlay__ring-icon">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                </div>
            </div>

            <h3 className="text-base font-black text-gray-800 mt-5 mb-1 tracking-tight">
                Generating your {count}-item {friendlyType(genType)}
            </h3>
            
            {/* Activity Log - NEW */}
            <div className="w-full mt-6 space-y-3">
                <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Activity Log</span>
                    <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Live Feedback</span>
                    </div>
                </div>
                
                <div 
                    ref={logScrollRef}
                    className="w-full h-32 bg-gray-50/50 border border-gray-100 rounded-2xl p-3 overflow-y-auto custom-scrollbar flex flex-col gap-2"
                    style={{ background: 'linear-gradient(to bottom, rgba(249,250,251,0.8), rgba(249,250,251,0.4))' }}
                >
                    {logs.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center opacity-30 gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            <span className="text-[10px] font-medium italic">Establishing connection...</span>
                        </div>
                    ) : (
                        logs.map((log, i) => (
                            <div 
                                key={i} 
                                className="flex gap-3 items-start animate-in slide-in-from-left-2 duration-300"
                            >
                                <span className="text-[9px] font-mono font-bold text-indigo-400/70 whitespace-nowrap pt-0.5">
                                    [{log.timestamp}]
                                </span>
                                <span className="text-[10px] font-bold text-gray-600 leading-tight">
                                    {log.message}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Tip Cycler */}
            <div className="mt-6 px-4 py-2 bg-indigo-50/50 border border-indigo-100/50 rounded-xl">
                 <p key={tipIndex} className="text-[10px] text-indigo-600 font-bold tracking-wide animate-in fade-in">
                    {TIPS[tipIndex]}
                </p>
            </div>

            {/* Controls & Metrics */}
            <div className="flex items-center justify-between w-full mt-8 pt-6 border-t border-gray-100">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{formatElapsed(elapsed)} elapsed</span>
                </div>

                {onStop && (
                    <button
                        onClick={onStop}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 rounded-xl font-bold text-[10px] transition-all active:scale-95"
                    >
                        <div className="w-1.5 h-1.5 bg-gray-400 group-hover:bg-indigo-500 rounded-sm" />
                        Stop Generation
                    </button>
                )}
            </div>
        </div>
    );
};

export default GenerationLoadingOverlay;
