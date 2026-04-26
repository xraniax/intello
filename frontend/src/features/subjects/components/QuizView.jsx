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
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1); // C6
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
    const question = q.question || q.text || q.title || q.front || '';
    const options = q.options || q.choices || q.answers || [];

    // Support multi-property mapping for correct answers
    // 1. Value-based: correct_answer, answer, correctAnswer
    // 2. Index-based: correctAnswers (array of indices), correctIndex
    let correctAnswer = q.correct_answer || q.answer || q.correctAnswer || '';

    // If we have correctAnswers as an array of indices, map to the option value
    if (Array.isArray(q.correctAnswers) && q.correctAnswers.length > 0 && options.length > 0) {
        const idx = parseInt(q.correctAnswers[0], 10);
        if (!isNaN(idx) && options[idx]) {
            correctAnswer = options[idx];
        }
    } else if (typeof q.correctIndex === 'number' && options[q.correctIndex]) {
        correctAnswer = options[q.correctIndex];
    }

    return {
        id: q.id || Math.random().toString(36).substr(2, 9),
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
            // Attempt Regex scavenge if JSON is totally broken (from AI engine)
            const qMatches = [...data.matchAll(/("question[^"]*"\s*:\s*"([^"]+)")/gi)];
            if (qMatches.length > 0) {
                console.warn("[QuizView] Salvaging questions via Regex from broken JSON string");
                // This is a last resort, returns partial objects that mapQuestion will safe-guard
                return qMatches.map(m => ({ question: m[2] }));
            }
            return [];
        }
    }

    // 1. Direct Array
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

    // 3. Dictionary support: if it's { "1": {...}, "2": {...} }
    if (typeof data === 'object' && !Array.isArray(data)) {
        const values = Object.values(data);
        if (values.length > 0 && values.every(v => typeof v === 'object' && (v.question || v.text))) {
            return values.map(mapQuestion);
        }
    }

    // 4. Try recursively unpacking wrapper objects
    if (data.result) return extractQuizQuestions(data.result);
    if (data.data) return extractQuizQuestions(data.data);
    if (data.content) return extractQuizQuestions(data.content);

    return [];
};

const QuizView = ({ quizData, subjectId, materialId, isExpanded = false }) => {
    const questions = extractQuizQuestions(quizData);

    const storageKey = `cognify_quiz_state_${quizData?.id || (questions.length > 0 ? questions[0]?.question?.replace(/\s+/g, '').substring(0, 30) : 'default')}`;

    const initialSaved = (() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Sanitize index against CURRENT questions length
                if (parsed.currentQuestionIndex >= questions.length) {
                    parsed.currentQuestionIndex = 0;
                }
                return parsed;
            }
        } catch {
            // handle error
        }
        return {};
    })();

    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(initialSaved.currentQuestionIndex ?? 0);
    const [selectedOption, setSelectedOption] = useState(initialSaved.selectedOption ?? null);
    const [isSubmitted, setIsSubmitted] = useState(initialSaved.isSubmitted ?? false);
    const [score, setScore] = useState(initialSaved.score ?? 0);
    const [showResults, setShowResults] = useState(initialSaved.showResults ?? false);
    const [streak, setStreak] = useState(initialSaved.streak ?? 0);
    const [muted, setMuted] = useState(initialSaved.muted ?? false);

    const responsesRef = useRef([]);
    const startedAtRef = useRef(new Date().toISOString());

    // Persist state
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

        responsesRef.current.push({
            questionId: currentQuestion.id,
            isCorrect,
            difficulty: currentQuestion.difficulty ?? 'medium',
        });

        setIsSubmitted(true);
    }, [selectedOption, isSubmitted, currentQuestion, muted]);

    const handleNext = useCallback(() => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedOption(null);
            setIsSubmitted(false);
        } else {
            setShowResults(true);
            if (subjectId && responsesRef.current.length > 0) {
                AnalyticsService.recordQuizAttempt({
                    subjectId,
                    materialId: materialId ?? quizData?.id,
                    responses: responsesRef.current,
                    startedAt: startedAtRef.current,
                    completedAt: new Date().toISOString(),
                }).catch(() => {});
            }
        }
    }, [currentQuestionIndex, questions.length, subjectId, materialId, quizData?.id]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (showResults || !currentQuestion) return;

            const key = e.key.toLowerCase();
            const options = currentQuestion.options || [];

            // Ignore shortcuts if user is typing in an input somewhere (though quiz typically captures globally)
            if (['input', 'textarea'].includes(document.activeElement?.tagName.toLowerCase())) return;

            if (!isSubmitted) {
                // A, B, C, D or 1, 2, 3, 4 selection
                let index = -1;
                if (key === 'a' || key === '1') index = 0;
                if (key === 'b' || key === '2') index = 1;
                if (key === 'c' || key === '3') index = 2;
                if (key === 'd' || key === '4') index = 3;

                if (index >= 0 && index < options.length) {
                    handleOptionSelect(options[index]);
                }
            }

            // Enter to submit or progress
            if (key === 'enter') {
                if (isSubmitted) {
                    handleNext();
                } else if (selectedOption !== null) {
                    handleSubmit();
                }
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
        responsesRef.current = [];
        startedAtRef.current = new Date().toISOString();
    };

    if (!questions || questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <HelpCircle className="w-12 h-12 mb-4 opacity-20" />
                <p>No quiz questions available.</p>
            </div>
        );
    }

    if (showResults) {
        const percentage = Math.round((score / questions.length) * 100);
        const isPerfect = percentage === 100;

        return <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto py-16 px-6"
            >
                {isPerfect && <ConfettiComponent />}
                <div className="rounded-[4rem] border-8 border-white bg-white shadow-2xl p-12 text-center relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500" />
                    
                    <motion.div
                        initial={{ rotate: -20, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", damping: 10, stiffness: 200 }}
                        className="w-32 h-32 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner group-hover:rotate-6 transition-transform"
                    >
                        <Trophy className={cn("w-16 h-16", isPerfect ? "text-amber-500" : "text-indigo-600")} />
                    </motion.div>
                    
                    <h2 className="text-4xl font-black text-indigo-950 mb-3 tracking-tight">Quiz Complete!</h2>
                    <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-xs mb-10">
                        {isPerfect ? "Absolute Legend! You mastered it all." : "Great job! Your knowledge is growing fast."}
                    </p>

                    <div className="grid grid-cols-2 gap-6 mb-12">
                        <div className="bg-indigo-50/50 rounded-[2.5rem] p-8 border-4 border-white shadow-sm transition-transform hover:scale-105">
                            <div className="text-5xl font-black text-indigo-600 mb-2">{score}/{questions.length}</div>
                            <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Mastered</div>
                        </div>
                        <div className="bg-pink-50/50 rounded-[2.5rem] p-8 border-4 border-white shadow-sm transition-transform hover:scale-105 relative overflow-hidden">
                            {isPerfect && <div className="absolute inset-0 bg-white/20 animate-pulse" />}
                            <div className="text-5xl font-black text-pink-600 mb-2 relative z-10">{percentage}%</div>
                            <div className="text-[10px] font-black text-pink-300 uppercase tracking-widest relative z-10">Success Rate</div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <button
                            onClick={resetQuiz}
                            className="flex items-center justify-center gap-3 px-10 py-5 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95"
                        >
                            <RotateCcw className="w-5 h-5" />
                            Retry Mission
                        </button>
                    </div>
                </div>
            </motion.div>;
    }

    const progress = ((currentQuestionIndex) / questions.length) * 100;

    return (
        <div className={`mx-auto ${isExpanded ? 'max-w-5xl py-16' : 'max-w-3xl py-8 md:py-12'} px-6 transition-all duration-500 relative`}>
            {/* Gamification Controls (Mute & Shortcuts info) */}
            <div className="absolute top-0 right-6 flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                    <Keyboard className="w-4 h-4" />
                    <span className="hidden sm:inline">A-D to select, ↵ to submit</span>
                    <span className="sm:hidden">Keyboard ready</span>
                </div>
                <button
                    onClick={() => setMuted(!muted)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-full border border-gray-100 transition-colors"
                    title={muted ? "Unmute sounds" : "Mute sounds"}
                >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
            </div>

            {/* Header / Progress */}
            <div className={`mb-10 mt-6 ${isExpanded ? 'scale-110 origin-left transition-all' : ''}`}>
                <div className="flex justify-between items-end mb-4">
                    <div className="flex items-center gap-4">
                        <div>
                            <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-wider mb-2">
                                Level {currentQuestionIndex + 1}
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
                    <div className="text-right">
                        <span className="text-sm font-black text-indigo-600">{currentQuestionIndex + 1}</span>
                        <span className="text-sm font-bold text-gray-300"> / {questions.length}</span>
                    </div>
                </div>
                {/* Mobile Streak Indicator */}
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
                <div className="h-4 w-full bg-white rounded-full overflow-hidden shadow-inner border-2 border-indigo-50 p-1">
                    <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow-sm"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={currentQuestionIndex}
                    initial={{ opacity: 0, x: 50, rotate: 1 }}
                    animate={{ opacity: 1, x: 0, rotate: 0 }}
                    exit={{ opacity: 0, x: -50, rotate: -1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="relative"
                >
                    <div className="absolute -top-12 -left-6 w-24 h-24 bg-indigo-100/50 rounded-full blur-3xl -z-10"></div>
                    <div className="absolute -bottom-12 -right-6 w-32 h-32 bg-pink-100/50 rounded-full blur-3xl -z-10"></div>
                    
                    <div className="rounded-[3.5rem] border-[12px] border-white bg-white shadow-2xl p-8 md:p-12 relative overflow-hidden group">
                        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-indigo-50 text-indigo-600 font-black uppercase tracking-widest text-[10px] mb-8">
                            <HelpCircle className="w-4 h-4" />
                            Question {currentQuestionIndex + 1}
                        </div>
                        
                        <h3 className="text-xl md:text-3xl font-black text-indigo-950 mb-12 leading-tight tracking-tight">
                            {currentQuestion.question}
                        </h3>

                        <div className="grid grid-cols-1 gap-4">
                            {currentQuestion.options.map((option, i) => {
                                const isCorrect = option === currentQuestion.correct_answer;
                                const isSelected = selectedOption === option;
                                const showCorrect = isSubmitted && isCorrect;
                                const showWrong = isSubmitted && isSelected && !isCorrect;

                                return (
                                    <button
                                        key={i}
                                        onClick={() => handleOptionSelect(option)}
                                        disabled={isSubmitted}
                                        className={cn(
                                            "group relative flex items-center gap-5 p-6 rounded-[2.5rem] border-4 transition-all duration-300 text-left font-bold text-lg active:scale-[0.98]",
                                            isSelected && !isSubmitted ? "border-indigo-400 bg-indigo-50 shadow-lg shadow-indigo-100 -translate-y-1" : 
                                            showCorrect ? "border-green-400 bg-green-50 shadow-lg shadow-green-100" :
                                            showWrong ? "border-red-400 bg-red-50" :
                                            "border-gray-50 bg-gray-50/50 hover:border-indigo-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-0.5"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black uppercase shadow-sm transition-all group-hover:scale-110",
                                            isSelected && !isSubmitted ? "bg-indigo-500 text-white" :
                                            showCorrect ? "bg-green-500 text-white" :
                                            showWrong ? "bg-red-500 text-white" :
                                            "bg-white text-indigo-300 border-2 border-indigo-50 group-hover:bg-indigo-50 group-hover:text-indigo-500"
                                        )}>
                                            {String.fromCharCode(65 + i)}
                                        </div>
                                        <span className={cn(
                                            "flex-1 transition-colors",
                                            isSelected && !isSubmitted ? "text-indigo-950" :
                                            showCorrect ? "text-green-950" :
                                            showWrong ? "text-red-950" :
                                            "text-gray-600"
                                        )}>{option}</span>
                                        
                                        {showCorrect && <CheckCircle2 className="w-8 h-8 text-green-500 animate-in zoom-in duration-300" />}
                                        {showWrong && <XCircle className="w-8 h-8 text-red-500 animate-in zoom-in duration-300" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>

            <div className="mt-12 flex justify-center">
                {isSubmitted ? (
                    <div className="w-full flex flex-col items-center gap-8 animate-in slide-in-from-bottom-6 duration-700">
                        <div className="w-full rounded-[3rem] p-10 bg-gradient-to-br from-indigo-50 to-purple-50 border-4 border-white shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-10">
                                <Info className="w-24 h-24" />
                            </div>
                            <div className="relative z-10">
                                <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-4">Deep Dive Insight</h4>
                                <p className="text-gray-700 font-bold leading-relaxed text-lg italic">
                                    {currentQuestion.explanation}
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={handleNext}
                            className="group flex items-center gap-4 px-10 py-6 bg-indigo-950 text-white rounded-[2rem] font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-2xl hover:scale-105 active:scale-95"
                        >
                            {currentQuestionIndex === questions.length - 1 ? "See Final Results" : "Next Challenge"}
                            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={handleSubmit}
                        disabled={selectedOption === null}
                        className="group relative px-12 py-6 rounded-[2.5rem] font-black uppercase tracking-widest text-xs transition-all duration-300 flex items-center gap-4 active:scale-95 disabled:opacity-30 disabled:grayscale disabled:scale-95"
                        style={{
                            background: 'linear-gradient(135deg, #7C5CFC, #F43F5E)',
                            color: 'white',
                            boxShadow: '0 20px 40px -10px rgba(124,92,252,0.4)'
                        }}
                    >
                        <Flame className={cn("w-6 h-6", selectedOption !== null && "animate-pulse")} />
                        Submit Answer
                    </button>
                )}
            </div>
        </div>
    );
};

export default QuizView;
