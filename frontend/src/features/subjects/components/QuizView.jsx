import React, { useState, useEffect, useCallback, useRef } from 'react';
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
// Data normaliser — handles every known backend shape & property names
// ---------------------------------------------------------------------------
const mapQuestion = (q) => {
    if (!q || typeof q !== 'object') return { id: Math.random().toString(36).substring(2, 11), question: '', options: [], correct_answer: '', explanation: 'No explanation provided.' };
    const question = q.question || q.text || q.title || q.front || '';
    const options = q.options || q.choices || q.answers || [];

    let correctAnswer = q.correct_answer || q.answer || q.correctAnswer || '';

    if (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0 && options.length > 0) {
        const idx = parseInt(q.correctAnswers[0], 10);
        if (!isNaN(idx) && options[idx]) {
            correctAnswer = options[idx];
        }
    } else if (typeof q.correctIndex === 'number' && options[q.correctIndex]) {
        correctAnswer = options[q.correctIndex];
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

    return [];
};

// ---------------------------------------------------------------------------
// Shared question card UI used by both modes
// ---------------------------------------------------------------------------
const QuestionCard = ({ question, selectedOption, isSubmitted, isExpanded, onSelect }) => (
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
                {question.options && question.options.length > 0 ? (
                    question.options.map((option, idx) => {
                        const isSelected = selectedOption === option;
                        const isCorrect = isSubmitted && option === question.correct_answer;
                        const isWrong = isSubmitted && isSelected && option !== question.correct_answer;

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
                        <span className="hidden sm:inline">A-D to select, ↵ to submit</span>
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
    const [lastCorrect, setLastCorrect] = useState(null);
    const [score, setScore] = useState(initialState.score ?? 0);
    const [questionCount, setQuestionCount] = useState(initialState.questionCount ?? 0);
    const [streak, setStreak] = useState(initialState.streak ?? 0);
    const [showResults, setShowResults] = useState(initialState.showResults ?? false);
    const [muted, setMuted] = useState(initialState.muted ?? false);
    const startTimeRef = useRef(null);

    const fetchQuestion = useCallback(async (opts = {}) => {
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
            setError(err?.response?.data?.message || 'Failed to load question. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [subjectId]); // topic/language stable via sessionParamsRef

    // Skip initial fetch if results screen was already showing when page was refreshed
    useEffect(() => {
        if (initialState.showResults) return;
        fetchQuestion();
    }, [fetchQuestion]); // eslint-disable-line react-hooks/exhaustive-deps -- initialState frozen at mount

    // Persist session continuity fields so a refresh can resume at the correct count/score
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify({ questionCount, score, streak, showResults, muted }));
    }, [questionCount, score, streak, showResults, muted, storageKey]);

    const handleOptionSelect = useCallback((opt) => {
        if (!isSubmitted) setSelectedOption(opt);
    }, [isSubmitted]);

    const handleSubmit = useCallback(() => {
        if (!selectedOption || isSubmitted || !question) return;
        const correct = selectedOption === question.correct_answer;
        setLastCorrect(correct);
        setIsSubmitted(true);
        if (correct) {
            setScore(s => s + 1);
            setStreak(s => s + 1);
            if (!muted) playTone('correct');
        } else {
            setStreak(0);
            if (!muted) playTone('wrong');
        }
    }, [selectedOption, isSubmitted, question, muted]);

    const handleNext = useCallback(async () => {
        const next = questionCount + 1;
        const responseTime = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;
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
            }
            return;
        }
        setQuestionCount(next);
        fetchQuestion({ isCorrect: lastCorrect, responseTime });
    }, [questionCount, lastCorrect, fetchQuestion, subjectId]);

    const resetQuiz = useCallback(() => {
        localStorage.removeItem(storageKey);
        setScore(0);
        setQuestionCount(0);
        setStreak(0);
        setShowResults(false);
        setQuestion(null);
        fetchQuestion();
    }, [fetchQuestion, storageKey]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (showResults || !question || loading) return;
            if (['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase())) return;
            const key = e.key.toLowerCase();
            const opts = question.options || [];
            if (!isSubmitted) {
                let idx = -1;
                if (key === 'a' || key === '1') idx = 0;
                if (key === 'b' || key === '2') idx = 1;
                if (key === 'c' || key === '3') idx = 2;
                if (key === 'd' || key === '4') idx = 3;
                if (idx >= 0 && idx < opts.length) handleOptionSelect(opts[idx]);
            }
            if (key === 'enter') {
                if (isSubmitted) handleNext();
                else if (selectedOption) handleSubmit();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showResults, question, loading, isSubmitted, selectedOption, handleOptionSelect, handleSubmit, handleNext]);

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
                onSelect={handleOptionSelect}
            />

            <div className="flex justify-end gap-3 sm:gap-4">
                {!isSubmitted ? (
                    <button
                        onClick={handleSubmit}
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
                        onClick={handleNext}
                        className="px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all flex items-center gap-2 sm:gap-3 shadow-xl shadow-indigo-100 hover:-translate-y-1 text-sm sm:text-base"
                    >
                        {questionCount + 1 < MAX_ADAPTIVE_QUESTIONS ? 'Next Question' : 'View Summary'}
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Static mode — all questions from quizData prop
// ---------------------------------------------------------------------------
const StaticQuizView = ({ questions, isExpanded }) => {
    const storageKey = `cognify_quiz_state_${questions.length > 0 ? questions[0]?.question?.replace(/\s+/g, '').substring(0, 30) : 'default'}`;

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

    useEffect(() => {
        if (questions.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify({
                currentQuestionIndex, selectedOption, isSubmitted, score, showResults, streak, muted
            }));
        }
    }, [currentQuestionIndex, selectedOption, isSubmitted, score, showResults, streak, muted, storageKey, questions.length]);

    const currentQuestion = questions[currentQuestionIndex];

    const handleOptionSelect = useCallback((option) => {
        if (isSubmitted) return;
        setSelectedOption(option);
    }, [isSubmitted]);

    const handleSubmit = useCallback(() => {
        if (selectedOption === null || isSubmitted) return;
        const isCorrect = selectedOption === currentQuestion.correct_answer;
        if (isCorrect) {
            setScore(prev => prev + 1);
            setStreak(prev => prev + 1);
            if (!muted) playTone('correct');
        } else {
            setStreak(0);
            if (!muted) playTone('wrong');
        }
        setIsSubmitted(true);
    }, [selectedOption, isSubmitted, currentQuestion, muted]);

    const handleNext = useCallback(() => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsSubmitted(false);
        } else {
            setShowResults(true);
        }
    }, [currentQuestionIndex, questions.length]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (showResults || !currentQuestion) return;
            const key = e.key.toLowerCase();
            const options = currentQuestion.options || [];
            if (['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase())) return;
            if (!isSubmitted) {
                let index = -1;
                if (key === 'a' || key === '1') index = 0;
                if (key === 'b' || key === '2') index = 1;
                if (key === 'c' || key === '3') index = 2;
                if (key === 'd' || key === '4') index = 3;
                if (index >= 0 && index < options.length) handleOptionSelect(options[index]);
            }
            if (key === 'enter') {
                if (isSubmitted) handleNext();
                else if (selectedOption !== null) handleSubmit();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showResults, currentQuestion, isSubmitted, selectedOption, handleOptionSelect, handleSubmit, handleNext]);

    const resetQuiz = () => {
        setCurrentQuestionIndex(0);
        setSelectedOption(null);
        setIsSubmitted(false);
        setScore(0);
        setStreak(0);
        setShowResults(false);
    };

    if (showResults) {
        return <ResultsScreen score={score} total={questions.length} onReset={resetQuiz} />;
    }

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
                onSelect={handleOptionSelect}
            />

            <div className="flex justify-end gap-3 sm:gap-4">
                {!isSubmitted ? (
                    <button
                        onClick={handleSubmit}
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
                        onClick={handleNext}
                        className="px-6 sm:px-10 py-4 sm:py-5 rounded-xl sm:rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all flex items-center gap-2 sm:gap-3 shadow-xl shadow-indigo-100 hover:-translate-y-1 text-sm sm:text-base"
                    >
                        {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'View Summary'}
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                )}
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// QuizView — dispatcher (explicit mode routing)
// ---------------------------------------------------------------------------
const QuizView = ({
    quizMode = 'static', // explicit mode: 'static' | 'adaptive'
    quizData = null,     // static mode data (ignored in adaptive mode)
    isExpanded = false,
    subjectId = null,    // required for adaptive mode
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

    return <StaticQuizView questions={questions} isExpanded={isExpanded} />;
};

export default QuizView;
