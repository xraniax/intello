import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock3, FileText, Flag, RefreshCw, Save, Trophy, FileDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MaterialService } from '@/services/MaterialService';
import AnalyticsService from '@/services/AnalyticsService';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const formatTime = (seconds) => {
    const safe = Math.max(0, Number(seconds) || 0);
    const mm = String(Math.floor(safe / 60)).padStart(2, '0');
    const ss = String(safe % 60).padStart(2, '0');
    return `${mm}:${ss}`;
};

const QuestionRenderer = ({
    question,
    answer,
    onChoiceChange,
    onTextChange,
    onBlankChange,
    onMatchChange,
    readOnly,
}) => {
    if (['short_answer', 'problem', 'scenario'].includes(question.type)) {
        return (
            <textarea
                value={answer.answerText || ''}
                onChange={(e) => onTextChange(question, e.target.value)}
                disabled={readOnly}
                placeholder="Write your answer clearly and concisely..."
                className="w-full min-h-[160px] rounded-[2rem] border-4 border-indigo-50 bg-indigo-50/20 p-6 text-base text-gray-700 font-bold focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all placeholder:text-indigo-200"
            />
        );
    }
    if (question.type === 'fill_blank') {
        const count = Math.max(1, question.blankAnswers?.length || 1);
        return (
            <div className="space-y-4">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">
                    Fill the Blanks
                </p>
                {Array.from({ length: count }).map((_, idx) => (
                    <input
                        key={`${question.id}-blank-${idx}`}
                        value={answer.blankAnswers?.[idx] || ''}
                        disabled={readOnly}
                        onChange={(e) => onBlankChange(question, idx, e.target.value)}
                        placeholder={`Blank ${idx + 1}`}
                        className="w-full rounded-2xl border-4 border-indigo-50 px-5 py-4 text-sm font-bold text-gray-700 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                    />
                ))}
            </div>
        );
    }
    if (question.type === 'matching') {
        const pairs = question.pairs || [];
        const options = question.rightOptions || [];
        return (
            <div className="space-y-4">
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">
                    Perfect Match
                </p>
                {pairs.map((pair, idx) => (
                    <div key={`${question.id}-pair-${idx}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div className="rounded-2xl border-4 border-white bg-indigo-50/50 px-5 py-4 text-sm font-black text-indigo-700 shadow-sm">
                            {pair.left}
                        </div>
                        <select
                            value={answer.matchAnswers?.[pair.left] || ''}
                            disabled={readOnly}
                            onChange={(e) => onMatchChange(question, pair.left, e.target.value)}
                            className="rounded-2xl border-4 border-indigo-50 px-5 py-4 text-sm font-bold text-gray-700 bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                        >
                            <option value="">Select match...</option>
                            {options.map((opt) => (
                                <option key={`${question.id}-${pair.left}-${opt}`} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {question.options.map((option, idx) => {
                const checked = answer.selectedAnswers.includes(idx);
                const isSingle = question.type === 'single_choice';
                return (
                    <label
                        key={`${question.id}-opt-${idx}`}
                        className={cn(
                            "group relative flex items-center gap-4 p-6 rounded-[2rem] border-4 transition-all cursor-pointer overflow-hidden",
                            checked
                                ? 'border-indigo-600 bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]'
                                : 'border-white bg-white hover:border-indigo-100 hover:scale-[1.01] shadow-sm hover:shadow-md'
                        )}
                    >
                        <div className={cn(
                            "w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all",
                            checked ? "bg-white border-white" : "bg-indigo-50 border-indigo-100 group-hover:border-indigo-200"
                        )}>
                            {checked && <div className="w-3 h-3 rounded-full bg-indigo-600 animate-in zoom-in" />}
                        </div>
                        <span className={cn(
                            "text-base font-black tracking-tight",
                            checked ? "text-white" : "text-gray-900"
                        )}>{option}</span>
                        <input
                            type={isSingle ? 'radio' : 'checkbox'}
                            name={`question-${question.id}`}
                            checked={checked}
                            disabled={readOnly}
                            onChange={() => onChoiceChange(question, idx)}
                            className="absolute opacity-0"
                        />
                    </label>
                );
            })}
        </div>
    );
};

// ─── Printable Exam Component ───────────────────────────────────────────────
const PrintableExam = ({ exam }) => {
    if (!exam || !exam.questions) return null;
    return (
        <div className="printable-only hidden print:block bg-white p-8">
            <div className="border-b-2 border-gray-900 pb-6 mb-8">
                <h1 className="text-3xl font-black text-gray-900 mb-2">{exam.title}</h1>
                <div className="flex justify-between text-sm font-bold text-gray-600">
                    <span>Subject: {exam.topic || 'General'}</span>
                    <span>Questions: {exam.questions.length}</span>
                </div>
            </div>
            <div className="space-y-10">
                {exam.questions.map((q, idx) => (
                    <div key={q.id} className="break-inside-avoid">
                        <div className="flex gap-4 mb-4">
                            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-900 text-white flex items-center justify-center font-bold">
                                {idx + 1}
                            </span>
                            <div className="flex-1">
                                <p className="text-lg font-bold text-gray-900 leading-snug">{q.question}</p>
                                <span className="text-[10px] uppercase tracking-widest font-black text-gray-400 mt-1 block">
                                    {q.type.replace('_', ' ')} • {q.difficulty}
                                </span>
                            </div>
                        </div>

                        {/* Options for choices */}
                        {q.options && q.options.length > 0 && (
                            <div className="ml-12 grid grid-cols-1 gap-3">
                                {q.options.map((opt, oIdx) => (
                                    <div key={oIdx} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-md border-2 border-gray-300" />
                                        <span className="text-gray-700">{opt}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Blank for short answers */}
                        {['short_answer', 'problem', 'scenario'].includes(q.type) && (
                            <div className="ml-12 mt-4 h-32 w-full border-2 border-dashed border-gray-200 rounded-xl" />
                        )}

                        {/* Blanks for fill in the blanks */}
                        {q.type === 'fill_blank' && (
                            <div className="ml-12 mt-4 space-y-3">
                                {Array.from({ length: q.blankAnswers?.length || 1 }).map((_, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-gray-400">{i + 1}.</span>
                                        <div className="flex-1 border-b-2 border-gray-200 h-8" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="mt-20 pt-8 border-t border-gray-100 text-center text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
                Generated by Cognify AI Study Assistant
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Data normaliser
// ---------------------------------------------------------------------------
const extractExamData = (data) => {
    if (!data) return null;

    // If it's a string, try to parse it
    if (typeof data === 'string') {
        try {
            const parsed = JSON.parse(data);
            return extractExamData(parsed);
        } catch {
            // handle error
        }
    }

    // Standard shape: { questions: [...] }
    if (Array.isArray(data.questions)) return data;

    // Handle alternate names
    const alternateArray = data.exam || data.exam_questions || data.items || data.data;
    if (Array.isArray(alternateArray)) return { ...data, questions: alternateArray };

    // Dictionary support: if questions is { "1": {...}, "2": {...} }
    if (data.questions && typeof data.questions === 'object' && !Array.isArray(data.questions)) {
        const values = Object.values(data.questions);
        return { ...data, questions: values };
    }

    // Direct array?
    if (Array.isArray(data)) return { questions: data };

    // 4. Try recursively unpacking wrapper objects
    if (data.content) return extractExamData(data.content);
    if (data.result) return extractExamData(data.result);
    if (data.data) return extractExamData(data.data);
    
    return null;
};

const ExamView = ({ examData: rawExamData, examId: propExamId, subjectId, isExpanded = false }) => {
    const examData = extractExamData(rawExamData);
    // Always prefer the explicitly passed DB UUID prop (propExamId) over the internal JSON id
    const examId = propExamId || examData?.id;
    const [exam, setExam] = useState(null);
    const [answers, setAnswers] = useState({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flagged, setFlagged] = useState({});
    const [startedAt, setStartedAt] = useState(null);
    const [result, setResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const hasAutoSubmitted = useRef(false);
    const [remainingSeconds, setRemainingSeconds] = useState(null);
    const [isSavingAttempt, setIsSavingAttempt] = useState(false);
    const [lastSavedAt, setLastSavedAt] = useState(null);

    useEffect(() => {
        // Strict session reset to avoid contamination between exams
        setExam(null);
        setAnswers({});
        setCurrentIndex(0);
        setFlagged({});
        setResult(null);
        setError('');
        setIsSubmitting(false);
        setStartedAt(null);
        hasAutoSubmitted.current = false;
        setRemainingSeconds(null);

        if (!examData || !Array.isArray(examData.questions) || examData.questions.length === 0) return;
        setExam(examData);
        setStartedAt(new Date());
        if (examData.timeLimit && Number.isFinite(examData.timeLimit)) {
            setRemainingSeconds(Math.max(0, Math.floor(Number(examData.timeLimit) * 60)));
        }

        if (!examId) return;
        MaterialService.getAttempt(examId).then((res) => {
            const attempt = res?.data?.data;
            if (!attempt) return;
            const mappedAnswers = {};
            for (const item of attempt.answers || []) {
                mappedAnswers[item.questionId] = {
                    selectedAnswers: Array.isArray(item.selectedAnswers) ? item.selectedAnswers : [],
                    answerText: item.answerText || '',
                    blankAnswers: Array.isArray(item.blankAnswers) ? item.blankAnswers : [],
                    matchAnswers: item.matchAnswers && typeof item.matchAnswers === 'object' ? item.matchAnswers : {},
                };
            }
            setAnswers(mappedAnswers);
            setFlagged(attempt.flagged || {});
            if (Number.isInteger(attempt.currentIndex)) setCurrentIndex(attempt.currentIndex);
        }).catch(() => {
            // handle error if needed
        });
    }, [examId]);

    const serializeAnswers = useCallback(() => {
        if (!exam?.questions) return [];
        return exam.questions.map((q) => ({
            questionId: q.id,
            selectedAnswers: Array.isArray(answers[q.id]?.selectedAnswers) ? answers[q.id].selectedAnswers : [],
            answerText: answers[q.id]?.answerText || '',
            blankAnswers: Array.isArray(answers[q.id]?.blankAnswers) ? answers[q.id].blankAnswers : [],
            matchAnswers: answers[q.id]?.matchAnswers || {},
        }));
    }, [answers, exam]);

    const saveAttempt = useCallback(async () => {
        if (!examId || result) return;
        try {
            setIsSavingAttempt(true);
            const res = await MaterialService.saveAttempt({
                examId: examId,
                currentIndex,
                answers: serializeAnswers(),
                flagged,
                startedAt: startedAt?.toISOString(),
            });
            setLastSavedAt(res?.data?.data?.updatedAt || new Date().toISOString());
        } catch {
            // Ignore autosave errors and keep exam usable
        } finally {
            setIsSavingAttempt(false);
        }
    }, [currentIndex, examId, flagged, result, serializeAnswers, startedAt]);

    const submitExam = useCallback(async () => {
        if (!examId || !exam?.questions || isSubmitting || result) return;
        setError('');
        setIsSubmitting(true);
        try {
            const payload = {
                examId: examId,
                answers: exam.questions.map((q) => ({
                    questionId: q.id,
                    selectedAnswers: Array.isArray(answers[q.id]?.selectedAnswers) ? answers[q.id].selectedAnswers : [],
                    answerText: answers[q.id]?.answerText || '',
                blankAnswers: Array.isArray(answers[q.id]?.blankAnswers) ? answers[q.id].blankAnswers : [],
                matchAnswers: answers[q.id]?.matchAnswers || {},
                })),
                startedAt: startedAt?.toISOString(),
                submittedAt: new Date().toISOString(),
            };
            const res = await MaterialService.submitExam(payload);
            const examResult = res?.data?.data || null;
            setResult(examResult);

            if (subjectId && examResult) {
                AnalyticsService.recordExamAttempt({
                    subjectId,
                    materialId: examId,
                    score:           examResult.score   ?? 0,
                    maxScore:        examResult.total   ?? exam.questions.length,
                    durationSeconds: startedAt ? Math.round((Date.now() - startedAt.getTime()) / 1000) : null,
                    startedAt:       startedAt?.toISOString(),
                }).catch(() => {});
            }
        } catch (err) {
            setError(err.message || 'Failed to submit exam. Please retry.');
        } finally {
            setIsSubmitting(false);
        }
    }, [answers, exam, examId, isSubmitting, result, startedAt, subjectId]);

    useEffect(() => {
        if (remainingSeconds == null || result) return undefined;
        if (remainingSeconds <= 0 && !hasAutoSubmitted.current) {
            hasAutoSubmitted.current = true;
            submitExam();
            return undefined;
        }
        const timer = window.setTimeout(() => setRemainingSeconds((prev) => Math.max(0, (prev || 0) - 1)), 1000);
        return () => window.clearTimeout(timer);
    }, [remainingSeconds, result, submitExam]);

    useEffect(() => {
        if (!exam?.id || result) return undefined;
        const timer = window.setTimeout(() => {
            saveAttempt();
        }, 1200);
        return () => window.clearTimeout(timer);
    }, [answers, currentIndex, flagged, exam?.id, result, saveAttempt]);

    const total = exam?.questions?.length || 0;
    const currentQuestion = total > 0 ? exam.questions[currentIndex] : null;
    const selected = currentQuestion ? (answers[currentQuestion.id] || { selectedAnswers: [], answerText: '' }) : { selectedAnswers: [], answerText: '' };
    const answeredCount = (exam?.questions || []).reduce((acc, q) => {
        const qAnswer = answers[q.id] || { selectedAnswers: [], answerText: '', blankAnswers: [], matchAnswers: {} };
        const hasValue = ['short_answer', 'problem', 'scenario'].includes(q.type)
            ? !!String(qAnswer.answerText || '').trim()
            : q.type === 'fill_blank'
                ? (qAnswer.blankAnswers || []).some((ans) => !!String(ans || '').trim())
                : q.type === 'matching'
                    ? Object.keys(qAnswer.matchAnswers || {}).length > 0
                    : qAnswer.selectedAnswers.length > 0;
        return acc + (hasValue ? 1 : 0);
    }, 0);
    const progressPct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
    const questionResult = currentQuestion ? result?.details?.find((d) => d.questionId === currentQuestion.id) : null;

    const handleAnswerChange = (question, optionIndex) => {
        if (result) return;
        setAnswers((prev) => {
            const current = prev[question.id] || { selectedAnswers: [], answerText: '', blankAnswers: [], matchAnswers: {} };
            if (question.type === 'single_choice') {
                return { ...prev, [question.id]: { ...current, selectedAnswers: [optionIndex] } };
            }
            const exists = current.selectedAnswers.includes(optionIndex);
            const next = exists
                ? current.selectedAnswers.filter((v) => v !== optionIndex)
                : [...current.selectedAnswers, optionIndex];
            return { ...prev, [question.id]: { ...current, selectedAnswers: next.sort((a, b) => a - b) } };
        });
    };

    const handleAnswerTextChange = (question, value) => {
        if (result) return;
        setAnswers((prev) => {
            const current = prev[question.id] || { selectedAnswers: [], answerText: '', blankAnswers: [], matchAnswers: {} };
            return { ...prev, [question.id]: { ...current, answerText: value } };
        });
    };
    const handleBlankChange = (question, idx, value) => {
        if (result) return;
        setAnswers((prev) => {
            const current = prev[question.id] || { selectedAnswers: [], answerText: '', blankAnswers: [], matchAnswers: {} };
            const blankAnswers = [...(current.blankAnswers || [])];
            blankAnswers[idx] = value;
            return { ...prev, [question.id]: { ...current, blankAnswers } };
        });
    };
    const handleMatchChange = (question, left, right) => {
        if (result) return;
        setAnswers((prev) => {
            const current = prev[question.id] || { selectedAnswers: [], answerText: '', blankAnswers: [], matchAnswers: {} };
            return {
                ...prev,
                [question.id]: { ...current, matchAnswers: { ...(current.matchAnswers || {}), [left]: right } },
            };
        });
    };

    const jumpTo = (idx) => setCurrentIndex(Math.min(Math.max(0, idx), total - 1));
    const toggleFlag = (questionId) => setFlagged((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
    const handleDownload = () => {
        window.print();
    };

    const resetAttempt = () => {
        setAnswers({});
        setCurrentIndex(0);
        setFlagged({});
        setResult(null);
        setError('');
        setStartedAt(new Date());
        if (exam?.timeLimit && Number.isFinite(exam.timeLimit)) {
            setRemainingSeconds(Math.max(0, Math.floor(Number(exam.timeLimit) * 60)));
        } else {
            setRemainingSeconds(null);
        }
    };

    const summaryByQuestion = useMemo(() => {
        if (!result?.details) return {};
        return result.details.reduce((acc, item) => {
            acc[item.questionId] = item;
            return acc;
        }, {});
    }, [result]);

    if (!exam || !Array.isArray(exam.questions) || exam.questions.length === 0 || !currentQuestion) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p>No exam questions available.</p>
            </div>
        );
    }

    return (
        <div className={`mx-auto ${isExpanded ? 'max-w-7xl py-10' : 'max-w-6xl py-6'} px-4 md:px-6`}>
            {/* Screen View */}
            <div className="print:hidden">
                <div className="relative mb-10 group">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[3rem] blur-2xl opacity-10 group-hover:opacity-20 transition-opacity" />
                    <div className="relative rounded-[3rem] border-8 border-white bg-white shadow-2xl p-8 overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                        
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center border-2 border-white shadow-sm">
                                        <FileText className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em]">Knowledge Arena</span>
                                </div>
                                <h1 className="text-2xl md:text-3xl font-black text-indigo-950 tracking-tight leading-tight">
                                    {exam.title || 'Mock Exam'}
                                </h1>
                                <div className="flex items-center gap-4 mt-3">
                                    <div className="flex items-center gap-2 text-gray-400 text-[10px] font-black uppercase tracking-widest">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                        {answeredCount}/{total} Complete
                                    </div>
                                    {remainingSeconds != null && (
                                        <div className={cn(
                                            "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest",
                                            remainingSeconds <= 60 ? "text-rose-500 animate-pulse" : "text-amber-500"
                                        )}>
                                            <Clock3 className="w-3.5 h-3.5" />
                                            {formatTime(remainingSeconds)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={handleDownload}
                                    className="group flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-indigo-600 rounded-[1.5rem] border-4 border-indigo-50 transition-all font-black uppercase tracking-widest text-[10px] shadow-sm hover:scale-105"
                                >
                                    <FileDown className="w-4 h-4" />
                                    PDF
                                </button>
                                <button
                                    onClick={submitExam}
                                    disabled={isSubmitting || !!result}
                                    className="px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
                                >
                                    {isSubmitting ? 'Architecting...' : result ? 'Submitted' : 'Final Submit'}
                                </button>
                            </div>
                        </div>

                        <div className="mt-6 h-4 rounded-full bg-indigo-50/50 p-1 border-2 border-indigo-50 shadow-inner">
                            <motion.div
                                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full shadow-[0_0_15px_rgba(124,92,252,0.4)]"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ type: "spring", damping: 12 }}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8">
                    <div className="space-y-6">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentQuestion.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="bg-white rounded-[3rem] border-8 border-white shadow-2xl p-10 relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-8 flex items-center gap-2">
                                    <button
                                        onClick={() => toggleFlag(currentQuestion.id)}
                                        className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border-4",
                                            flagged[currentQuestion.id] 
                                                ? "bg-amber-100 border-amber-200 text-amber-600" 
                                                : "bg-gray-50 border-white text-gray-300 hover:text-amber-400 hover:bg-amber-50"
                                        )}
                                    >
                                        <Flag className={cn("w-5 h-5", flagged[currentQuestion.id] && "fill-current")} />
                                    </button>
                                </div>

                                <div className="mb-10">
                                    <div className="text-[10px] uppercase font-black tracking-[0.3em] text-indigo-400 mb-4 flex items-center gap-2">
                                        <span className="bg-indigo-50 px-3 py-1 rounded-lg">Question {currentIndex + 1}</span>
                                        <span className="w-1 h-1 rounded-full bg-indigo-200" />
                                        <span>{currentQuestion.type.replace('_', ' ')}</span>
                                        <span className="w-1 h-1 rounded-full bg-indigo-200" />
                                        <span className={cn(
                                            "px-3 py-1 rounded-lg",
                                            currentQuestion.difficulty === 'Hard' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                                        )}>{currentQuestion.difficulty}</span>
                                    </div>
                                    <h3 className="text-3xl font-black text-indigo-950 leading-tight">
                                        {currentQuestion.question}
                                    </h3>
                                </div>

                                <QuestionRenderer
                                    question={currentQuestion}
                                    answer={selected}
                                    onChoiceChange={handleAnswerChange}
                                    onTextChange={handleAnswerTextChange}
                                    onBlankChange={handleBlankChange}
                                    onMatchChange={handleMatchChange}
                                    readOnly={!!result}
                                />

                                {result && questionResult && (
                                    <motion.div 
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        className={cn(
                                            "mt-10 p-8 rounded-[2rem] border-4",
                                            questionResult.isCorrect 
                                                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                                                : 'bg-rose-50 border-rose-100 text-rose-800'
                                        )}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            {questionResult.isCorrect ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                                            <p className="text-lg font-black tracking-tight">
                                                {questionResult.isCorrect ? 'Absolute Mastery!' : questionResult.isAlmost ? 'Close! Keep Pushing.' : 'Tough One! Watch Out.'}
                                            </p>
                                        </div>
                                        
                                        <div className="space-y-4 text-sm font-bold opacity-80">
                                            {!questionResult.isCorrect && currentQuestion.type !== 'short_answer' && (
                                                <p>Correct Path: <span className="underline decoration-wavy underline-offset-4">{questionResult.correctAnswers.map((idx) => currentQuestion.options[idx]).join(', ')}</span></p>
                                            )}
                                            {questionResult.explanation && (
                                                <div className="bg-white/50 p-4 rounded-xl border-2 border-white/40 italic">
                                                    {questionResult.explanation}
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        <div className="flex items-center justify-between gap-4">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => jumpTo(currentIndex - 1)}
                                    disabled={currentIndex === 0}
                                    className="px-8 py-4 rounded-[1.5rem] bg-white border-4 border-indigo-50 text-indigo-400 font-black uppercase tracking-widest text-[10px] hover:bg-indigo-50 transition-all disabled:opacity-30"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => jumpTo(currentIndex + 1)}
                                    disabled={currentIndex >= total - 1}
                                    className="px-8 py-4 rounded-[1.5rem] bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                                >
                                    Next Challenge
                                </button>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={saveAttempt}
                                    disabled={!!result || isSavingAttempt}
                                    className="w-14 h-14 rounded-2xl bg-white border-4 border-indigo-50 flex items-center justify-center text-indigo-400 hover:bg-indigo-50 transition-all disabled:opacity-50"
                                    title="Save Progress"
                                >
                                    <Save className={cn("w-6 h-6", isSavingAttempt && "animate-pulse")} />
                                </button>
                                <button
                                    onClick={resetAttempt}
                                    className="w-14 h-14 rounded-2xl bg-white border-4 border-rose-50 flex items-center justify-center text-rose-300 hover:bg-rose-50 transition-all"
                                    title="Restart Arena"
                                >
                                    <RefreshCw className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </div>

                    <aside className="space-y-8">
                        {result && (
                            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[3rem] p-8 text-center text-white shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-full h-full bg-white/10 -translate-y-full group-hover:translate-y-full transition-transform duration-1000 pointer-events-none" />
                                <Trophy className="w-16 h-16 mx-auto mb-4 text-amber-300 drop-shadow-[0_0_15px_rgba(252,211,77,0.5)]" />
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-1">Final Score</div>
                                <div className="text-6xl font-black mb-2 tracking-tighter">{result.score}<span className="text-2xl text-white/40">/{result.total}</span></div>
                                <div className="text-xs font-bold bg-white/10 px-4 py-2 rounded-full inline-block backdrop-blur-sm">
                                    {Math.round((result.score/result.total)*100)}% Mastery
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-[3rem] border-8 border-white shadow-xl p-8">
                            <div className="text-[10px] uppercase font-black tracking-[0.3em] text-indigo-300 mb-6 flex items-center gap-2">
                                <RefreshCw className="w-4 h-4" />
                                Navigator
                            </div>
                            <div className="grid grid-cols-4 sm:grid-cols-5 xl:grid-cols-4 gap-3">
                                {exam.questions.map((q, idx) => {
                                    const qAnswer = answers[q.id] || { selectedAnswers: [], answerText: '', blankAnswers: [], matchAnswers: {} };
                                    const isAnswered = ['short_answer', 'problem', 'scenario'].includes(q.type)
                                        ? !!String(qAnswer.answerText || '').trim()
                                        : q.type === 'fill_blank'
                                            ? (qAnswer.blankAnswers || []).some((ans) => !!String(ans || '').trim())
                                            : q.type === 'matching'
                                                ? Object.keys(qAnswer.matchAnswers || {}).length > 0
                                                : qAnswer.selectedAnswers.length > 0;
                                    const isFlagged = !!flagged[q.id];
                                    const isActive = idx === currentIndex;
                                    const evaluation = summaryByQuestion[q.id];
                                    
                                    return (
                                        <button
                                            key={q.id}
                                            onClick={() => jumpTo(idx)}
                                            className={cn(
                                                "aspect-square rounded-2xl border-4 font-black transition-all text-xs",
                                                isActive ? "scale-110 shadow-lg ring-4 ring-indigo-100" : "hover:scale-105",
                                                evaluation
                                                    ? (evaluation.isCorrect ? 'bg-emerald-500 border-emerald-400 text-white' : 'bg-rose-500 border-rose-400 text-white')
                                                    : isFlagged
                                                        ? 'bg-amber-100 border-amber-200 text-amber-600'
                                                        : isAnswered
                                                            ? 'bg-indigo-50 border-indigo-100 text-indigo-600'
                                                            : 'bg-gray-50 border-white text-gray-300'
                                            )}
                                        >
                                            {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>


            {/* Printable View */}
            <PrintableExam exam={exam} />
        </div>
    );
};

export default ExamView;
