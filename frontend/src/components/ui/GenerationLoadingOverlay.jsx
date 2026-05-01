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
}) => {
    const [elapsed, setElapsed] = useState(0);
    const [tipIndex, setTipIndex] = useState(0);
    const intervalRef = useRef(null);

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
            className="generation-overlay animate-in fade-in"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={`Generating ${friendlyType(genType)}. Estimated time: ${estimatedLabel}.`}
        >
            {/* Animated Progress Ring */}
            <div className="generation-overlay__ring-wrapper">
                <svg className="generation-overlay__ring" viewBox="0 0 100 100">
                    {/* Track */}
                    <circle
                        cx="50" cy="50" r="42"
                        fill="none"
                        stroke="rgba(99,102,241,0.1)"
                        strokeWidth="6"
                    />
                    {/* Progress arc */}
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

            {/* Primary Message */}
            <h3 className="text-base font-black text-gray-800 mt-5 mb-1 tracking-tight">
                Generating your {count}-item {friendlyType(genType)}
            </h3>
            <p className="text-sm text-gray-500 font-medium">
                This may take {estimatedLabel}. You'll see it as soon as it's ready.
            </p>

            {/* Tip Cycler */}
            <div className="mt-4 h-5 overflow-hidden">
                <p
                    key={tipIndex}
                    className="text-xs text-indigo-500/80 font-bold tracking-wide animate-in fade-in"
                >
                    {TIPS[tipIndex]}
                </p>
            </div>

            {/* Elapsed Timer */}
            <div className="flex items-center gap-1.5 mt-5 text-xs text-gray-400 font-bold">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatElapsed(elapsed)} elapsed</span>
            </div>

            {/* Progress Dots */}
            <div className="flex gap-1.5 mt-4">
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-indigo-300"
                        style={{
                            animation: `progress-dot-bounce 1.4s ease-in-out ${i * 0.16}s infinite`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default GenerationLoadingOverlay;
