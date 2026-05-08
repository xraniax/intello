import React, { useState, useEffect, useCallback, useRef } from 'react';
import AnalyticsService from '@/services/AnalyticsService';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2,
    XCircle,
    RotateCcw,
    Trophy,
    HelpCircle,
    Info,
    ArrowRight,
    Flame,
    Volume2,
    VolumeX,
    Keyboard
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Confetti from 'react-confetti';
import QuizService from '@/services/QuizService';
import { normalizeOptions, isCorrectAnswer, getKeyboardMappedOption } from '@/quiz/quizEngine';
import {
    createQuizSession,
    makeQuestionViewedEvent,
    makeOptionSelectedEvent,
    makeAnswerSubmittedEvent,
    makeQuestionAdvancedEvent,
    makeQuizCompletedEvent,
    makeQuizResetEvent,
} from '@/quiz/quizEvents';
import { enqueueEvent, getSessionEvents } from '@/quiz/quizEventQueue';
import { ingest } from '@/learning/adaptiveRuntime';
import { LEARNING_SOURCE, LEARNING_EVENT_TYPE, LEARNING_EVENT_SCHEMA_VERSION } from '@/learning/learningEventSchema';
import QuizDebugPanel from '@/quiz/QuizDebugPanel';
import '@/quiz/quizDebug';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Global Audio Context to prevent recreating it too often
let audioCtx = null;

const playTone = (type) => {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        if (type === 'correct') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'wrong') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
            gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.2);
        }
    } catch (e) {
        console.warn("Audio not supported or blocked", e);
    }
};

const ConfettiComponent = () => {
    const [dim, setDim] = useState({ width: window.innerWidth, height: window.innerHeight });

    useEffect(() => {
        const handleResize = () => setDim({ width: window.innerWidth, height: window.innerHeight });
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return <Confetti width={dim.width} height={dim.height} className="!fixed !top-0 !left-0 !z-[9999] pointer-events-none" />;
};

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function _genEventId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

// FNV-inspired 32-bit hash — produces a short base-36 fingerprint from a string.
// Used to disambiguate storageKeys when only subjectId is available.
function _hashStr(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
}

// ---------------------------------------------------------------------------
// Data normaliser — handles every known backend shape & property names
// ---------------------------------------------------------------------------
const mapQuestion = (q) => {
    if (!q || typeof q !== 'object') return { id: Math.random().toString(36).substring(2, 11), question: '', options: [], correct_answer: '', explanation: 'No explanation provided.' };
    const question = q.question || q.text || q.title || q.front || '';
    const options = q.options || q.choices || q.answers || [];

    // Support multi-property mapping for correct answers
    // 1. Value-based: correct_answer, answer, correctAnswer
    // 2. Index-based: correctAnswers (array of indices), correctIndex
    let correctAnswer = q.correct_answer ?? q.answer ?? q.correctAnswer ?? '';

    // If we have correctAnswers as an array of indices, map to the option value
    if (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0 && options.length > 0) {
        const idx = parseInt(q.correctAnswers[0], 10);
        if (!isNaN(idx) && options[idx]) {
            correctAnswer = options[idx];
        }
    } else if (typeof q.correctIndex === 'number' && options[q.correctIndex]) {
        correctAnswer = options[q.correctIndex];
    } else if (typeof correctAnswer === 'number' && options[correctAnswer]) {
        correctAnswer = options[correctAnswer];
    } else if (typeof correctAnswer === 'string' && /^\d+$/.test(correctAnswer) && options[parseInt(correctAnswer, 10)]) {
        correctAnswer = options[parseInt(correctAnswer, 10)];
    }

    return {
        id: q.id || Math.random().toString(36).substring(2, 11),
        question: String(question).trim(),
        options: Array.isArray(options) ? options.map(String) : [],
        correct_answer: String(correctAnswer).trim(),
        explanation: q.explanation || q.rationale || q.back || 'No explanation provided.'
    };
};

const extractQuizQuestions = (data) => {
    if (!data) return [];

    // 0. String handling
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return extractQuizQuestions(parsed);
        } catch {
            const qMatches = [...data.matchAll(/("question[^"]*"\s*:\s*"([^"]+)")/gi)];
            if (qMatches.length > 0) {
                console.warn("[QuizView] Salvaging questions via Regex from broken JSON string");
                return qMatches.map(m => ({ question: m[2] }));
            }
            return [];
        }
    }

    if (Array.isArray(data)) return data.map(mapQuestion);

    // 2. Contains standard properties
    const arrayField =
        data.questions ||
        data.quiz ||
        data.flashcards ||
        data.cards ||
        (data.result && (data.result.questions || data.result.quiz || data.result)) ||
        data.data ||
        data.items;

    if (Array.isArray(arrayField)) return arrayField.map(mapQuestion);

    if (typeof data === 'object' && !Array.isArray(data)) {
        const values = Object.values(data);
        if (values.length > 0 && values.every(v => typeof v === 'object' && (v.question || v.text))) {
            return values.map(mapQuestion);
        }
    }

    if (data.result) return extractQuizQuestions(data.result);
    if (data.data) return extractQuizQuestions(data.data);
    if (data.content) return extractQuizQuestions(data.content);

    return [];
};

// ---------------------------------------------------------------------------
// Shared question card UI used by both modes
// ---------------------------------------------------------------------------
const QuestionCard = ({ question, selectedOption, isSubmitted, isExpanded, onSelect }) => {
    if (!question) return null;
    const options = normalizeOptions(question);

    return (
    <AnimatePresence mode="wait">
        <motion.div
            key={question.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-white rounded-[2rem] shadow-xl shadow-indigo-100/20 border border-gray-100 p-6 sm:p-8 md:p-10 mb-8"
        >
            <h3 className={`font-bold text-gray-800 leading-tight transition-all duration-500 ${isExpanded ? 'text-2xl sm:text-3xl mb-12' : 'text-lg sm:text-xl md:text-2xl mb-10'}`}>
                {question.question}
            </h3>

            <div className="space-y-3 sm:space-y-4">
                {options.length > 0 ? (
                    options.map((option, idx) => {
                        const isSelected = selectedOption === option;
                        const isCorrect = isSubmitted && isCorrectAnswer(option, question.correct_answer);
                        const isWrong = isSubmitted && isSelected && !isCorrectAnswer(option, question.correct_answer);

                        return (
                            <motion.button
                                key={idx}
                                whileHover={!isSubmitted ? { scale: 1.01 } : {}}
                                whileTap={!isSubmitted ? { scale: 0.99 } : {}}
                                onClick={() => onSelect(option)}
                                disabled={isSubmitted}
                                className={cn(
                                    "w-full p-4 sm:p-5 rounded-xl sm:rounded-2xl text-left font-bold transition-all border-2 flex items-center justify-between group",
                                    !isSubmitted && isSelected && "border-indigo-500 bg-indigo-50 text-indigo-700 shadow-lg shadow-indigo-100",
                                    !isSubmitted && !isSelected && "border-gray-50 bg-gray-50 text-gray-600 hover:border-gray-200 hover:bg-white",
                                    isSubmitted && isCorrect && "border-emerald-500 bg-emerald-50 text-emerald-700",
                                    isSubmitted && isWrong && "border-rose-500 bg-rose-50 text-rose-700",
                                    isSubmitted && !isCorrect && !isWrong && "border-gray-50 bg-gray-50 text-gray-300 opacity-50"
                                )}
                            >
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className={cn(
                                        "w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center text-xs sm:text-sm font-black transition-colors shadow-sm",
                                        !isSubmitted && isSelected ? "bg-indigo-500 text-white" : "bg-white text-gray-400 group-hover:text-indigo-400 border border-gray-100",
                                        isSubmitted && isCorrect && "bg-emerald-500 text-white border-transparent",
                                        isSubmitted && isWrong && "bg-rose-500 text-white border-transparent"
                                    )}>
                                        {String.fromCharCode(65 + idx)}
                                    </div>
                                    <span className="flex-1 text-sm sm:text-base leading-snug">{option}</span>
                                </div>

                                {isSubmitted && (
                                    <div className="flex-shrink-0 ml-3 sm:ml-4">
                                        {isCorrect && <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-500" />}
                                        {isWrong && <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-rose-500" />}
                                    </div>
                                )}
                            </motion.button>
                        );
                    })
                ) : (
                    <div className="p-6 sm:p-8 bg-gray-50 rounded-xl sm:rounded-2xl border-2 border-dashed border-gray-200 text-center">
                        <p className="text-gray-500 font-medium mb-2 italic">Thinking of the answer?</p>
                        <p className="text-gray-400 text-xs">This is a short-answer question. Press 'Reveal Answer' when you're ready.</p>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {isSubmitted && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-8 sm:mt-10 overflow-hidden"
                    >
                        <div className="p-4 sm:p-6 bg-indigo-50/50 rounded-xl sm:rounded-2xl border border-indigo-100 flex gap-3 sm:gap-4">
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                                <Info className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500" />
                            </div>
                            <div>
                                <h4 className="font-black text-xs sm:text-sm text-indigo-900 mb-1 uppercase tracking-wider">The Insight</h4>
                                <p className="text-indigo-800/80 text-xs sm:text-sm leading-relaxed font-medium">
                                    {question.explanation}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    </AnimatePresence>
    );
};

// ---------------------------------------------------------------------------
// Shared results screen
// ---------------------------------------------------------------------------
const ResultsScreen = ({ score, total, onReset }) => {
    const percentage = Math.round((score / total) * 100);
    const isPerfect = percentage === 100;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto py-12 px-6"
        >
            {isPerfect && <ConfettiComponent />}
            <div className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-100/50 border border-gray-100 p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500" />

                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12 }}
                    className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                    <Trophy className={cn("w-12 h-12", isPerfect ? "text-amber-500" : "text-indigo-500")} />
                </motion.div>

                <h2 className="text-3xl font-black text-gray-900 mb-2">Quiz Complete!</h2>
                <p className="text-gray-500 mb-8 font-medium">
                    {isPerfect ? "Flawless victory! You knew every single answer." : "You've mastered some new knowledge today."}
                </p>

                <div className="grid grid-cols-2 gap-4 mb-10">
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mt-2">
                        <div className="text-4xl font-black text-indigo-600 mb-1">{score}/{total}</div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Correct Answers</div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mt-2 relative overflow-hidden">
                        {isPerfect && <div className="absolute inset-0 bg-gradient-to-r from-amber-200/20 to-orange-200/20 animate-pulse" />}
                        <div className="text-4xl font-black text-purple-600 mb-1 relative z-10">{percentage}%</div>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest relative z-10">Overall Score</div>
                    </div>
                </div>

                <button
                    onClick={onReset}
                    className="flex items-center gap-2 px-8 py-4 bg-gray-900 text-white rounded-2xl font-bold hover:bg-black transition-all mx-auto shadow-lg shadow-gray-200"
                >
                    <RotateCcw className="w-5 h-5" />
                    Try Again
                </button>
            </div>
        </motion.div>
    );
};

// ---------------------------------------------------------------------------
// Shared gamification header (progress bar + streak + controls)
// ---------------------------------------------------------------------------
const QuizHeader = ({ current, total, streak, muted, setMuted, isExpanded }) => {
    const progress = (current / total) * 100;
    return (
        <div className={`mb-10 mt-6 ${isExpanded ? 'scale-110 origin-left transition-all' : ''}`}>
            <div className="flex justify-between items-end mb-4">
                <div className="flex items-center gap-4">
                    <div>
                        <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider mb-2">
                            Level {current + 1}
                        </span>
                        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900">Knowledge Check</h2>
                    </div>
                    <AnimatePresence>
                        {streak >= 3 && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0, y: 10 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0, opacity: 0, y: -10 }}
                                className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white px-3 py-1.5 rounded-xl shadow-lg shadow-orange-500/30 font-bold text-sm tracking-wide"
                            >
                                <Flame className="w-4 h-4 animate-pulse" />
                                {streak} Streak!
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className="text-sm font-black text-indigo-600">{current + 1}</span>
                        <span className="text-sm font-bold text-gray-300"> / {total}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                        <Keyboard className="w-4 h-4" />
                        <span className="hidden sm:inline">Use letters to select, ↵ to submit</span>
                        <span className="sm:hidden">Keyboard ready</span>
                    </div>
                    <button
                        onClick={() => setMuted(m => !m)}
                        className="p-1.5 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-100 transition-colors"
                        title={muted ? "Unmute sounds" : "Mute sounds"}
                    >
                        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>
            <AnimatePresence>
                {streak >= 3 && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="sm:hidden mb-4 flex w-fit items-center gap-1.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white px-3 py-1.5 rounded-xl shadow-lg shadow-orange-500/30 font-bold text-sm tracking-wide"
                    >
                        <Flame className="w-4 h-4 animate-pulse" />
                        {streak} Streak!
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={cn(
                        "h-full transition-colors duration-500",
                        streak >= 3 ? "bg-gradient-to-r from-orange-400 to-rose-500" : "bg-gradient-to-r from-indigo-500 to-purple-500"
                    )}
                />
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Shared quiz logic — used by both StaticQuizView and AdaptiveQuizView
// ---------------------------------------------------------------------------

// Update score/streak and play audio. Called identically in both handleSubmit
// implementations; the surrounding mode-specific state mutations stay in each mode.
function applyScoring(isCorrect, { setScore, setStreak, muted }) {
    if (isCorrect) {
        setScore(s => s + 1);
        setStreak(s => s + 1);
        if (!muted) playTone('correct');
    } else {
        setStreak(0);
        if (!muted) playTone('wrong');
    }
}

// Release submitLockRef once React has committed isSubmitted = true in state.
// Identical in both modes — extracted to make the shared contract visible.
function useSubmitLockRelease(submitLockRef, isSubmitted) {
    useEffect(() => {
        if (isSubmitted) submitLockRef.current = false;
    }, [isSubmitted]); // eslint-disable-line react-hooks/exhaustive-deps -- submitLockRef is a stable ref object
}

// Register shared keyboard handler: letter-key selection, Enter to submit/advance,
// Enter key-repeat guard. `loading` defaults to false for StaticQuizView (no loading state).
function useQuizKeyboard({ question, isSubmitted, selectedOption, showResults, loading = false, selectOption, submitAnswer, advanceQuestion }) {
    useEffect(() => {
        const onKeyDown = (e) => {
            if (showResults || !question || loading) return;
            if (['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase())) return;
            const key = e.key.toLowerCase();
            const opts = normalizeOptions(question);
            if (!isSubmitted) {
                const option = getKeyboardMappedOption(key, opts);
                if (option !== null) selectOption(option);
            }
            if (key === 'enter') {
                // Block OS key-repeat: holding Enter would fire submit then next in the same
                // render cycle, inflating score and (in static mode) double-sending analytics.
                if (e.repeat) return;
                if (isSubmitted) advanceQuestion();
                else if (selectedOption !== null) submitAnswer();
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [showResults, question, loading, isSubmitted, selectedOption, selectOption, submitAnswer, advanceQuestion]);
}

// ---------------------------------------------------------------------------
// Adaptive mode — one question at a time from the API
// ---------------------------------------------------------------------------
const MAX_ADAPTIVE_QUESTIONS = 10;

const AdaptiveQuizView = ({ subjectId, topic, language, isExpanded }) => {
    // Freeze topic/language at mount so prop changes (e.g. subject lazy-load) don't restart the session
    const sessionParamsRef = useRef({ topic, language });
    const storageKey = `cognify_adaptive_quiz_${subjectId}`;

    // Load persisted session state once at mount
    const [initialState] = useState(() => {
        try {
            const raw = localStorage.getItem(`cognify_adaptive_quiz_${subjectId}`);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });

    const [question, setQuestion] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [lastCorrect, setLastCorrect] = useState(initialState.lastCorrect ?? null);
    const [score, setScore] = useState(initialState.score ?? 0);
    const [questionCount, setQuestionCount] = useState(initialState.questionCount ?? 0);
    const [streak, setStreak] = useState(initialState.streak ?? 0);
    const [showResults, setShowResults] = useState(initialState.showResults ?? false);
    const [muted, setMuted] = useState(initialState.muted ?? false);
    const startTimeRef = useRef(null);

    // --- Submission locking ---
    // submitLockRef: held from the moment handleSubmit fires until isSubmitted flips to true
    // in React state. Prevents a rapid double-click or a keydown event that fires before the
    // React re-render from scoring the same answer twice.
    const submitLockRef = useRef(false);
    // nextLockRef: held from handleNext until fetchQuestion completes (success or error).
    // Prevents concurrent "next question" requests and rapid question skipping.
    const nextLockRef = useRef(false);
    // requestInFlightRef: true while a fetchQuestion HTTP call is in progress.
    // Guards the initial mount, the retry button, and resetQuiz from overlapping
    // with a handleNext-triggered fetch.
    const requestInFlightRef = useRef(false);
    // fetchRequestIdRef: monotonically-increasing counter. Each fetchQuestion call captures
    // its own ID; if a newer call has started before this one resolves, the response is
    // discarded — stale responses cannot overwrite newer state.
    const fetchRequestIdRef = useRef(0);

    // --- Event queue ---
    // sessionRef: stable session context for all events in this quiz attempt.
    // Rotated (new sessionId) on resetQuiz so post-reset events are distinguishable.
    const sessionRef = useRef(null);
    if (sessionRef.current === null) {
        sessionRef.current = createQuizSession('adaptive', {
            subjectId,
            // Restore the original session identity on page refresh so events
            // continue under the same sessionId and the persisted queue is found.
            sessionId:  initialState.sessionId        ?? null,
            createdAt:  initialState.sessionCreatedAt ?? null,
        });
    }
    // eventQueueRef: in-memory mirror of the persisted event queue.
    // Initialized from localStorage so events survive page refreshes.
    const eventQueueRef = useRef(getSessionEvents(sessionRef.current.sessionId));
    // completedEmittedRef: prevents a double QUIZ_COMPLETED if showResults effect re-fires.
    // Initialized to true when resuming a completed session from localStorage.
    const completedEmittedRef = useRef(initialState.showResults ?? false);

    useSubmitLockRelease(submitLockRef, isSubmitted);

    const fetchQuestion = useCallback(async (opts = {}) => {
        // Prevent concurrent fetches. nextLockRef already blocks handleNext re-entry, but
        // the retry button and resetQuiz bypass nextLockRef, so we guard here too.
        if (requestInFlightRef.current) return;
        requestInFlightRef.current = true;

        // Capture a unique ID for this call. Any response whose ID doesn't match the
        // latest value is a stale response from an overlapping or retried request.
        const requestId = ++fetchRequestIdRef.current;

        setLoading(true);
        setError(null);
        try {
            const res = await QuizService.nextQuestion(
                subjectId,
                sessionParamsRef.current.topic,
                sessionParamsRef.current.language,
                5,
                opts
            );

            // Stale response guard: a newer request has already started (e.g. retry fired
            // while this response was in-flight). Discard this response entirely.
            if (requestId !== fetchRequestIdRef.current) return;

            const envelope = res?.data?.data || res?.data;
            // Engine wraps the question: { question: {...}, progress: {...}, session: {...} }
            // Unwrap nested question object before normalising with mapQuestion
            const raw = (envelope?.question && typeof envelope.question === 'object')
                ? envelope.question
                : envelope;
            const q = mapQuestion(raw);
            if (!q.question) throw new Error('Invalid question received from server.');
            setQuestion(q);
            startTimeRef.current = Date.now();
            setSelectedOption(null);
            setIsSubmitted(false);
            setLastCorrect(null);
        } catch (err) {
            // Discard errors from superseded requests too
            if (requestId !== fetchRequestIdRef.current) return;
            setError(err?.response?.data?.message || 'Failed to load question. Please try again.');
        } finally {
            // Only the owning request clears shared lock state. A superseded request must
            // not release a lock that now belongs to the newer request.
            if (requestId === fetchRequestIdRef.current) {
                setLoading(false);
                nextLockRef.current = false;
                requestInFlightRef.current = false;
            }
        }
    }, [subjectId]); // topic/language stable via sessionParamsRef

    // Skip initial fetch if results screen was already showing when page was refreshed.
    // If the user refreshed after submitting but before clicking Next, replay lastCorrect
    // so the backend records that answer before serving the next question.
    // Guard the MAX boundary: if that was the final answer, show results without a new fetch.
    useEffect(() => {
        if (initialState.showResults) return;
        const pending = initialState.lastCorrect;
        const resumedCount = initialState.questionCount ?? 0;
        if (pending !== null && pending !== undefined && resumedCount + 1 < MAX_ADAPTIVE_QUESTIONS) {
            fetchQuestion({ isCorrect: pending, responseTime: 0 });
        } else {
            fetchQuestion();
        }
    }, [fetchQuestion]); // eslint-disable-line react-hooks/exhaustive-deps -- initialState frozen at mount

    // Persist session continuity fields so a refresh can resume at the correct count/score.
    // lastCorrect is included so an unanswered "next" after refresh replays the answer to the backend.
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify({
            questionCount, score, streak, showResults, muted, lastCorrect,
            sessionId:        sessionRef.current.sessionId,
            sessionCreatedAt: sessionRef.current.createdAt,
        }));
    }, [questionCount, score, streak, showResults, muted, lastCorrect, storageKey]);

    // QUESTION_VIEWED: question reference only changes when fetchQuestion() resolves with a
    // new object — rerenders of existing state never re-emit this event.
    useEffect(() => {
        if (!question) return;
        const ev = makeQuestionViewedEvent(sessionRef.current, {
            questionIndex: questionCount,
            questionId: question.id ?? null,
            correctAnswer: question.correct_answer,
            totalQuestions: MAX_ADAPTIVE_QUESTIONS,
        });
        eventQueueRef.current.push(ev);
        enqueueEvent(sessionRef.current.sessionId, ev);
    }, [question, questionCount]); // question and questionCount always advance together

    // QUIZ_COMPLETED: fires once when results become visible. completedEmittedRef prevents
    // double-emission if score/streak update in the same render batch as showResults.
    useEffect(() => {
        if (!showResults || completedEmittedRef.current) return;
        completedEmittedRef.current = true;
        const ev = makeQuizCompletedEvent(sessionRef.current, {
            totalQuestions: MAX_ADAPTIVE_QUESTIONS,
            finalScore: score,
            finalStreak: streak,
            startedAt: sessionRef.current.createdAt,
            completedAt: new Date().toISOString(),
        });
        eventQueueRef.current.push(ev);
        enqueueEvent(sessionRef.current.sessionId, ev);
    }, [showResults, score, streak]);

    const selectOption = useCallback((option) => {
        // Block during active submit processing (submitLockRef). nextLockRef is already
        // covered by loading=true which hides the question card during fetches.
        if (submitLockRef.current) return;
        if (!option) return;
        if (!isSubmitted) {
            setSelectedOption(option);
            const ev = makeOptionSelectedEvent(sessionRef.current, {
                questionIndex: questionCount,
                questionId: question?.id ?? null,
                selectedOption: option,
            });
            eventQueueRef.current.push(ev);
            enqueueEvent(sessionRef.current.sessionId, ev);
            ingest({
                eventId:          _genEventId(),
                sessionId:        sessionRef.current.sessionId,
                timestamp:        ev.timestamp,
                source:           LEARNING_SOURCE.QUIZ,
                eventType:        LEARNING_EVENT_TYPE.ITEM_INTERACTED,
                subjectId:        subjectId,
                materialId:       null,
                contentId:        question?.id?.toString() ?? null,
                difficulty:       null,
                responseTimeMs:   null,
                schemaVersion:    LEARNING_EVENT_SCHEMA_VERSION,
                contentIndex:     questionCount,
                interactionType:  'option_selected',
                interactionValue: option,
            });
        }
    }, [isSubmitted, question, questionCount, subjectId]);

    const submitAnswer = useCallback(() => {
        // submitLockRef is the primary guard. isSubmitted is a secondary defence for any
        // code path that doesn't go through the keyboard handler.
        if (submitLockRef.current) return;
        if (!selectedOption || isSubmitted || !question) return;

        // Lock immediately — before any state mutation — so concurrent calls in the same
        // JS microtask batch are rejected. Released by the useEffect above once React
        // confirms isSubmitted = true in state, closing the stale-closure window.
        submitLockRef.current = true;
        const isCorrect = isCorrectAnswer(selectedOption, question.correct_answer);
        // Compute post-scoring totals before queuing — setScore/setStreak are not yet committed.
        const nextScore = score + (isCorrect ? 1 : 0);
        const nextStreak = isCorrect ? streak + 1 : 0;
        const responseTimeMs = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
        setLastCorrect(isCorrect);
        setIsSubmitted(true);
        applyScoring(isCorrect, { setScore, setStreak, muted });
        const ev = makeAnswerSubmittedEvent(sessionRef.current, {
            questionIndex: questionCount,
            questionId: question.id ?? null,
            selectedOption,
            correctAnswer: question.correct_answer,
            isCorrect,
            responseTimeMs,
            score: nextScore,
            streak: nextStreak,
        });
        eventQueueRef.current.push(ev);
        enqueueEvent(sessionRef.current.sessionId, ev);
        ingest({
            eventId:        _genEventId(),
            sessionId:      sessionRef.current.sessionId,
            timestamp:      ev.timestamp,
            source:         LEARNING_SOURCE.QUIZ,
            eventType:      LEARNING_EVENT_TYPE.ITEM_ANSWERED,
            subjectId:      subjectId,
            materialId:     null,
            contentId:      question.id?.toString() ?? null,
            difficulty:     null,
            responseTimeMs: responseTimeMs,
            schemaVersion:  LEARNING_EVENT_SCHEMA_VERSION,
            selectedOption,
            isCorrect,
            score:          nextScore,
            streak:         nextStreak,
        });
    }, [selectedOption, isSubmitted, question, muted, score, streak, questionCount, subjectId]);

    const advanceQuestion = useCallback(async () => {
        // nextLockRef stays locked until fetchQuestion's finally block releases it,
        // guaranteeing at most one in-flight request at any time.
        if (nextLockRef.current) return;
        nextLockRef.current = true;

        const next = questionCount + 1;
        const responseTime = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
        // Emit before any state mutation or fetch so the event timestamp reflects
        // when the user actually clicked Next, not when the API responds.
        const adv = makeQuestionAdvancedEvent(sessionRef.current, {
            fromIndex: questionCount,
            toIndex: next < MAX_ADAPTIVE_QUESTIONS ? next : null,
            questionId: question?.id ?? null,
        });
        eventQueueRef.current.push(adv);
        enqueueEvent(sessionRef.current.sessionId, adv);
        if (next >= MAX_ADAPTIVE_QUESTIONS) {
            // Final answer: submit to backend before showing results (not fire-and-forget)
            setLoading(true);
            try {
                await QuizService.nextQuestion(
                    subjectId,
                    sessionParamsRef.current.topic,
                    sessionParamsRef.current.language,
                    5,
                    { isCorrect: lastCorrect, responseTime }
                );
            } catch {
                // Submission failed — proceed to results anyway
            } finally {
                setLoading(false);
                setQuestionCount(next);
                setShowResults(true);
                nextLockRef.current = false;
            }
            return;
        }
        setQuestionCount(next);
        setQuestion(null); // nulling before fetch prevents stale QUESTION_VIEWED while old question + new index coexist
        // nextLockRef is released inside fetchQuestion's finally — not here.
        fetchQuestion({ isCorrect: lastCorrect, responseTime });
    }, [questionCount, lastCorrect, fetchQuestion, subjectId, question]);

    const resetQuiz = useCallback(() => {
        const ev = makeQuizResetEvent(sessionRef.current, {
            atQuestionIndex: questionCount,
            atScore: score,
        });
        eventQueueRef.current.push(ev);
        enqueueEvent(sessionRef.current.sessionId, ev);
        // Rotate session: new sessionId for all future events.
        // Old session's events remain in localStorage for future transport — not cleared here.
        sessionRef.current = createQuizSession('adaptive', { subjectId });
        eventQueueRef.current = [];
        completedEmittedRef.current = false;

        // Invalidate any in-flight request so its response is discarded, then reset locks
        // so the new fetchQuestion call is allowed to proceed.
        fetchRequestIdRef.current++;
        requestInFlightRef.current = false;
        submitLockRef.current = false;
        nextLockRef.current = false;

        localStorage.removeItem(storageKey);
        setScore(0);
        setQuestionCount(0);
        setStreak(0);
        setShowResults(false);
        setQuestion(null);
        fetchQuestion();
    }, [fetchQuestion, storageKey, questionCount, score, subjectId]);

    useQuizKeyboard({ question, isSubmitted, selectedOption, showResults, loading, selectOption, submitAnswer, advanceQuestion });

    if (showResults) {
        return <ResultsScreen score={score} total={MAX_ADAPTIVE_QUESTIONS} onReset={resetQuiz} />;
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-16">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <XCircle className="w-12 h-12 mb-4 text-rose-400" />
                <p className="mb-4">{error}</p>
                <button
                    onClick={() => fetchQuestion()}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!question) return null;

    return (
        <div className={`mx-auto ${isExpanded ? 'max-w-5xl py-16' : 'max-w-3xl py-8 md:py-12'} px-6 transition-all duration-500`}>
            <QuizHeader
                current={questionCount}
                total={MAX_ADAPTIVE_QUESTIONS}
                streak={streak}
                muted={muted}
                setMuted={setMuted}
                isExpanded={isExpanded}
            />

            <QuestionCard
                question={question}
                selectedOption={selectedOption}
                isSubmitted={isSubmitted}
                isExpanded={isExpanded}
                onSelect={selectOption}
            />

            <div className="flex justify-end gap-3 sm:gap-4">
                {!isSubmitted ? (
                    <button
                        onClick={submitAnswer}
                        disabled={question.options && question.options.length > 0 && !selectedOption}
                        className={cn(
                            "px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black transition-all flex items-center gap-2 sm:gap-3 shadow-xl text-sm sm:text-base",
                            (question.options && question.options.length > 0 && !selectedOption)
                                ? "bg-gray-100 text-gray-300 transform-none cursor-not-allowed"
                                : "bg-gray-900 text-white hover:bg-black hover:-translate-y-1 shadow-gray-200"
                        )}
                    >
                        {question.options && question.options.length > 0 ? 'Submit Answer' : 'Reveal Answer'}
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                ) : (
                    <button
                        onClick={advanceQuestion}
                        className="px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all flex items-center gap-2 sm:gap-3 shadow-xl shadow-indigo-100 hover:-translate-y-1 text-sm sm:text-base"
                    >
                        {questionCount + 1 < MAX_ADAPTIVE_QUESTIONS ? 'Next Question' : 'View Summary'}
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                )}
            </div>
            <QuizDebugPanel sessionRef={sessionRef} eventQueueRef={eventQueueRef} />
        </div>
    );
};

// ---------------------------------------------------------------------------
// Static mode — all questions from quizData prop
// ---------------------------------------------------------------------------
const StaticQuizView = ({ questions, isExpanded, subjectId, materialId, quizDataId }) => {
    const storageKey = (() => {
        if (quizDataId) return `cognify_quiz_state_${quizDataId}`;
        if (materialId) return `cognify_quiz_state_${materialId}`;
        if (subjectId) {
            // When no quizDataId or materialId is available, fingerprint the question
            // texts so two different generated quizzes for the same subject get distinct
            // keys rather than overwriting each other's saved state.
            const fp = _hashStr(questions.slice(0, 10).map(q => q.question).join('\x00'));
            return `cognify_quiz_state_${subjectId}_${fp}`;
        }
        if (process.env.NODE_ENV !== 'production') {
            console.warn('[StaticQuizView] No stable identifier (quizDataId, materialId, subjectId) provided — quiz state may collide across different quizzes.');
        }
        return 'cognify_quiz_state_unknown';
    })();

    const initialSaved = (() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.currentQuestionIndex >= questions.length) parsed.currentQuestionIndex = 0;
                return parsed;
            }
        } catch { /* ignore */ }
        return {};
    })();

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialSaved.currentQuestionIndex ?? 0);
    const [selectedOption, setSelectedOption] = useState(initialSaved.selectedOption ?? null);
    const [isSubmitted, setIsSubmitted] = useState(initialSaved.isSubmitted ?? false);
    const [score, setScore] = useState(initialSaved.score ?? 0);
    const [showResults, setShowResults] = useState(initialSaved.showResults ?? false);
    const [streak, setStreak] = useState(initialSaved.streak ?? 0);
    const [muted, setMuted] = useState(initialSaved.muted ?? false);

    const responsesRef = useRef(Array.isArray(initialSaved.responses) ? initialSaved.responses : []);
    const startedAtRef = useRef(initialSaved.startedAt ?? new Date().toISOString());

    // --- Submission locking ---
    // submitLockRef: held from handleSubmit until isSubmitted = true is confirmed in state.
    // Prevents score/streak double-increment and duplicate responsesRef entries from
    // rapid double-clicks or Enter auto-repeat firing before React re-renders.
    const submitLockRef = useRef(false);
    // nextLockRef: held from handleNext until currentQuestionIndex advances in state (via
    // useEffect below). Prevents rapid question skipping. For the final question it stays
    // locked permanently — showResults = true becomes the terminal guard.
    const nextLockRef = useRef(false);
    // analyticsSubmittedRef: set to true the first time recordQuizAttempt is called.
    // Guards against the analytics payload being sent twice when nextLockRef is released
    // before showResults has propagated (e.g. rapid double-click on the last question).
    const analyticsSubmittedRef = useRef(false);

    // --- Event queue ---
    const sessionRef = useRef(null);
    if (sessionRef.current === null) {
        sessionRef.current = createQuizSession('static', {
            subjectId,
            materialId,
            quizId:    quizDataId             ?? null,
            // Restore original session identity on refresh so events continue under
            // the same sessionId and the persisted queue is found by getSessionEvents.
            sessionId: initialSaved.sessionId ?? null,
        });
    }
    // Initialized from localStorage so the queue survives page refreshes.
    const eventQueueRef = useRef(getSessionEvents(sessionRef.current.sessionId));
    // lastViewedIndexRef: prevents duplicate QUESTION_VIEWED on rerenders or prop-identity
    // changes that don't actually advance the question index.
    const lastViewedIndexRef = useRef(-1);
    // completedEmittedRef: prevents double QUIZ_COMPLETED if showResults effect re-fires.
    // Initialized to true when resuming a completed session from localStorage.
    const completedEmittedRef = useRef(initialSaved.showResults ?? false);

    useSubmitLockRelease(submitLockRef, isSubmitted);

    // Release nextLock when the question index advances in state. This allows the user to
    // select an option and submit on the next question. For the final question, this effect
    // never fires (currentQuestionIndex stays at questions.length - 1 before showResults),
    // so nextLockRef remains locked — the only exit is through the results screen.
    useEffect(() => {
        nextLockRef.current = false;
    }, [currentQuestionIndex]);

    // QUESTION_VIEWED: lastViewedIndexRef prevents re-emission on rerenders or prop-identity
    // changes that don't advance the question. Skips if already on results screen.
    useEffect(() => {
        if (showResults || !currentQuestion) return;
        if (lastViewedIndexRef.current === currentQuestionIndex) return;
        lastViewedIndexRef.current = currentQuestionIndex;
        const ev = makeQuestionViewedEvent(sessionRef.current, {
            questionIndex: currentQuestionIndex,
            questionId: currentQuestion.id ?? null,
            correctAnswer: currentQuestion.correct_answer,
            totalQuestions: questions.length,
        });
        eventQueueRef.current.push(ev);
        enqueueEvent(sessionRef.current.sessionId, ev);
    }, [currentQuestionIndex, currentQuestion, showResults]); // eslint-disable-line react-hooks/exhaustive-deps -- questions.length stable per session; lastViewedIndexRef guards double-emission

    // QUIZ_COMPLETED: fires once after React commits showResults = true with final score/streak.
    useEffect(() => {
        if (!showResults || completedEmittedRef.current) return;
        completedEmittedRef.current = true;
        const ev = makeQuizCompletedEvent(sessionRef.current, {
            totalQuestions: questions.length,
            finalScore: score,
            finalStreak: streak,
            startedAt: startedAtRef.current,
            completedAt: new Date().toISOString(),
        });
        eventQueueRef.current.push(ev);
        enqueueEvent(sessionRef.current.sessionId, ev);
    }, [showResults, score, streak]); // eslint-disable-line react-hooks/exhaustive-deps -- questions.length/startedAtRef stable; completedEmittedRef prevents re-emission

    // Persist state
    useEffect(() => {
        if (questions.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify({
                currentQuestionIndex, selectedOption, isSubmitted, score, showResults, streak, muted,
                responses: responsesRef.current,
                startedAt: startedAtRef.current,
                sessionId: sessionRef.current.sessionId,
            }));
        }
    }, [currentQuestionIndex, selectedOption, isSubmitted, score, showResults, streak, muted, storageKey, questions.length]);

    const currentQuestion = questions[currentQuestionIndex];

    const selectOption = useCallback((option) => {
        // Block during active submit or next processing — either lock means a state
        // transition is in progress and the selection would be against a stale question.
        if (submitLockRef.current || nextLockRef.current) return;
        if (!option) return;
        if (isSubmitted) return;
        setSelectedOption(option);
        const ev = makeOptionSelectedEvent(sessionRef.current, {
            questionIndex: currentQuestionIndex,
            questionId: currentQuestion?.id ?? null,
            selectedOption: option,
        });
        eventQueueRef.current.push(ev);
        enqueueEvent(sessionRef.current.sessionId, ev);
    }, [isSubmitted, currentQuestionIndex, currentQuestion]);

    const submitAnswer = useCallback(() => {
        // submitLockRef is the primary race guard; isSubmitted is secondary defence.
        if (submitLockRef.current) return;
        if (selectedOption === null || isSubmitted) return;

        // Lock before any mutation. Released by useEffect once isSubmitted = true is
        // confirmed in React state, bridging the stale-closure window.
        submitLockRef.current = true;
        const isCorrect = isCorrectAnswer(selectedOption, currentQuestion.correct_answer);
        // Compute post-scoring totals before queuing — setScore/setStreak are not yet committed.
        const nextScore = score + (isCorrect ? 1 : 0);
        const nextStreak = isCorrect ? streak + 1 : 0;
        applyScoring(isCorrect, { setScore, setStreak, muted });
        // Push exactly once per question — submitLockRef guarantees this.
        responsesRef.current.push({
            questionId: currentQuestion.id,
            isCorrect,
            difficulty: currentQuestion.difficulty ?? 'medium',
        });
        // Write responses immediately so a refresh between submit and the persist
        // useEffect re-run cannot lose this entry.
        try {
            const snap = JSON.parse(localStorage.getItem(storageKey) || '{}');
            snap.responses = responsesRef.current;
            snap.startedAt = startedAtRef.current;
            localStorage.setItem(storageKey, JSON.stringify(snap));
        } catch { /* ignore — persist effect will catch it on next render */ }
        const ev = makeAnswerSubmittedEvent(sessionRef.current, {
            questionIndex: currentQuestionIndex,
            questionId: currentQuestion.id ?? null,
            selectedOption,
            correctAnswer: currentQuestion.correct_answer,
            isCorrect,
            responseTimeMs: 0,
            score: nextScore,
            streak: nextStreak,
        });
        eventQueueRef.current.push(ev);
        enqueueEvent(sessionRef.current.sessionId, ev);
        setIsSubmitted(true);
    }, [selectedOption, isSubmitted, currentQuestion, muted, score, streak, currentQuestionIndex]);

    const advanceQuestion = useCallback(() => {
        // nextLockRef is released by the currentQuestionIndex useEffect (non-final questions)
        // or never released for the final question (showResults is the terminal guard).
        if (nextLockRef.current) return;
        nextLockRef.current = true;

        // Emit before any state mutation so the timestamp reflects when the user clicked Next.
        const adv = makeQuestionAdvancedEvent(sessionRef.current, {
            fromIndex: currentQuestionIndex,
            toIndex: currentQuestionIndex < questions.length - 1 ? currentQuestionIndex + 1 : null,
            questionId: questions[currentQuestionIndex]?.id ?? null,
        });
        eventQueueRef.current.push(adv);
        enqueueEvent(sessionRef.current.sessionId, adv);

        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsSubmitted(false);
            // nextLockRef released by the currentQuestionIndex useEffect above.
        } else {
            setShowResults(true);
            // analyticsSubmittedRef ensures exactly one analytics call even if this branch
            // is somehow reached twice before React re-renders with showResults = true.
            if (subjectId && responsesRef.current.length > 0 && !analyticsSubmittedRef.current) {
                analyticsSubmittedRef.current = true;
                AnalyticsService.recordQuizAttempt({
                    subjectId,
                    materialId: materialId ?? quizDataId,
                    responses: responsesRef.current,
                    startedAt: startedAtRef.current,
                    completedAt: new Date().toISOString(),
                }).catch(() => {});
            }
            // nextLockRef intentionally NOT released here. showResults = true is the
            // permanent guard for this terminal state; releasing the lock would open a
            // window for a second analytics call before the React state propagates.
        }
    }, [currentQuestionIndex, questions.length, subjectId, materialId, quizDataId]);

    useQuizKeyboard({ question: currentQuestion, isSubmitted, selectedOption, showResults, selectOption, submitAnswer, advanceQuestion });

    const resetQuiz = () => {
        const ev = makeQuizResetEvent(sessionRef.current, {
            atQuestionIndex: currentQuestionIndex,
            atScore: score,
        });
        eventQueueRef.current.push(ev);
        enqueueEvent(sessionRef.current.sessionId, ev);
        // Rotate session: new sessionId for all future events.
        // Old session's events remain in localStorage for future transport — not cleared here.
        sessionRef.current = createQuizSession('static', {
            subjectId,
            materialId,
            quizId: quizDataId ?? null,
        });
        eventQueueRef.current = [];
        lastViewedIndexRef.current = -1;
        completedEmittedRef.current = false;
        localStorage.removeItem(storageKey);
        // Reset all locks and the analytics guard before restoring quiz state.
        submitLockRef.current = false;
        nextLockRef.current = false;
        analyticsSubmittedRef.current = false;
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setIsSubmitted(false);
        setScore(0);
        setStreak(0);
        setShowResults(false);
        responsesRef.current = [];
        startedAtRef.current = new Date().toISOString();
    };

    if (showResults) {
        return <ResultsScreen score={score} total={questions.length} onReset={resetQuiz} />;
    }

    if (!currentQuestion) return null;

    return (
        <div className={`mx-auto ${isExpanded ? 'max-w-5xl py-16' : 'max-w-3xl py-8 md:py-12'} px-6 transition-all duration-500`}>
            <QuizHeader
                current={currentQuestionIndex}
                total={questions.length}
                streak={streak}
                muted={muted}
                setMuted={setMuted}
                isExpanded={isExpanded}
            />

            <QuestionCard
                question={currentQuestion}
                selectedOption={selectedOption}
                isSubmitted={isSubmitted}
                isExpanded={isExpanded}
                onSelect={selectOption}
            />

            <div className="flex justify-end gap-3 sm:gap-4">
                {!isSubmitted ? (
                    <button
                        onClick={submitAnswer}
                        disabled={currentQuestion.options && currentQuestion.options.length > 0 && selectedOption === null}
                        className={cn(
                            "px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl font-black transition-all flex items-center gap-2 sm:gap-3 shadow-xl text-sm sm:text-base",
                            (currentQuestion.options && currentQuestion.options.length > 0 && selectedOption === null)
                                ? "bg-gray-100 text-gray-300 transform-none cursor-not-allowed"
                                : "bg-gray-900 text-white hover:bg-black hover:-translate-y-1 shadow-gray-200"
                        )}
                    >
                        {currentQuestion.options && currentQuestion.options.length > 0 ? 'Submit Answer' : 'Reveal Answer'}
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                ) : (
                    <button
                        onClick={advanceQuestion}
                        className="px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all flex items-center gap-2 sm:gap-3 shadow-xl shadow-indigo-100 hover:-translate-y-1 text-sm sm:text-base"
                    >
                        {currentQuestionIndex + 1 < questions.length ? 'Next Question' : 'View Summary'}
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                )}
            </div>
            <QuizDebugPanel sessionRef={sessionRef} eventQueueRef={eventQueueRef} />
        </div>
    );
};

// ---------------------------------------------------------------------------
// Error boundary — catches render/lifecycle errors in both quiz modes and
// prevents a white screen by showing a recoverable fallback UI.
// ---------------------------------------------------------------------------
class QuizErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[QuizErrorBoundary] Caught error:', error, info?.componentStack);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                    <XCircle className="w-12 h-12 mb-4 text-rose-400" />
                    <p className="font-semibold mb-2">Something went wrong loading the quiz.</p>
                    <p className="text-xs mb-6 text-gray-400 max-w-xs text-center">
                        {this.state.error?.message ?? 'An unexpected error occurred.'}
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// ---------------------------------------------------------------------------
// QuizView — dispatcher (explicit mode routing)
// ---------------------------------------------------------------------------
const QuizView = ({
    quizMode = 'static', // explicit mode: 'static' | 'adaptive'
    quizData = null,     // static mode data (ignored in adaptive mode)
    isExpanded = false,
    subjectId = null,    // required for adaptive mode
    materialId = null,
    topic = null,
    language = 'en'
}) => {
    // Adaptive mode: fetch questions progressively via QuizService and /api/quiz/start + /submit-answer
    if (quizMode === 'adaptive') {
        // Defensive fallback: adaptive requires subjectId
        if (!subjectId) {
            return (
                <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                    <XCircle className="w-12 h-12 mb-4 text-rose-400" />
                    <p className="font-semibold">Adaptive quiz requires a subject context.</p>
                </div>
            );
        }
        return (
            <AdaptiveQuizView
                subjectId={subjectId}
                topic={topic}
                language={language}
                isExpanded={isExpanded}
            />
        );
    }

    // Static mode: render from quizData prop
    const questions = extractQuizQuestions(quizData);

    if (!questions || questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <HelpCircle className="w-12 h-12 mb-4 opacity-20" />
                <p>No quiz questions available.</p>
            </div>
        );
    }

    return <StaticQuizView questions={questions} isExpanded={isExpanded} subjectId={subjectId} materialId={materialId} quizDataId={quizData?.id} />;
};

const QuizViewWithBoundary = (props) => (
    <QuizErrorBoundary>
        <QuizView {...props} />
    </QuizErrorBoundary>
);

export default QuizViewWithBoundary;
