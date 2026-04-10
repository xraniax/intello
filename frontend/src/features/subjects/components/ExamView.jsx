import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock3, FileText, Flag, RefreshCw, Save, Trophy, FileDown } from 'lucide-react';
import { subjectService } from '@/features/subjects/services/SubjectService';

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
                className="w-full min-h-[140px] rounded-2xl border border-gray-200 p-4 text-sm md:text-base text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
            />
        );
    }
    if (question.type === 'fill_blank') {
        const count = Math.max(1, question.blankAnswers?.length || 1);
        return (
            <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500">
                    Fill each blank in order.
                </p>
                {Array.from({ length: count }).map((_, idx) => (
                    <input
                        key={`${question.id}-blank-${idx}`}
                        value={answer.blankAnswers?.[idx] || ''}
                        disabled={readOnly}
                        onChange={(e) => onBlankChange(question, idx, e.target.value)}
                        placeholder={`Blank ${idx + 1}`}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
                    />
                ))}
            </div>
        );
    }
    if (question.type === 'matching') {
        const pairs = question.pairs || [];
        const options = question.rightOptions || [];
        return (
            <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500">
                    Match each item on the left with one option.
                </p>
                {pairs.map((pair, idx) => (
                    <div key={`${question.id}-pair-${idx}`} className="grid grid-cols-1 md:grid-cols-2 gap-2 items-center">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700">
                            {pair.left}
                        </div>
                        <select
                            value={answer.matchAnswers?.[pair.left] || ''}
                            disabled={readOnly}
                            onChange={(e) => onMatchChange(question, pair.left, e.target.value)}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-gray-50"
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
        <div className="space-y-4">
            {question.options.map((option, idx) => {
                const checked = answer.selectedAnswers.includes(idx);
                const isSingle = question.type === 'single_choice';
                return (
                    <label
                        key={`${question.id}-opt-${idx}`}
                        className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                            checked
                                ? 'border-indigo-300 bg-indigo-50/60 shadow-sm'
                                : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/30'
                        }`}
                    >
                        <input
                            type={isSingle ? 'radio' : 'checkbox'}
                            name={`question-${question.id}`}
                            checked={checked}
                            disabled={readOnly}
                            onChange={() => onChoiceChange(question, idx)}
                            className="mt-0.5 accent-indigo-600"
                        />
                        <span className="text-sm md:text-base text-gray-700 font-medium">{option}</span>
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

    // Deep nesting
    if (data.result) return extractExamData(data.result);
    
    return null;
};

const ExamView = ({ examData: rawExamData, isExpanded = false }) => {
    const examData = extractExamData(rawExamData);
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

        subjectService.getAttempt(examData.id).then((res) => {
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
    }, [examData?.id, examData]);

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
        if (!exam?.id || result) return;
        try {
            setIsSavingAttempt(true);
            const res = await subjectService.saveAttempt({
                examId: exam.id,
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
    }, [currentIndex, exam, flagged, result, serializeAnswers, startedAt]);

    const submitExam = useCallback(async () => {
        if (!exam?.id || isSubmitting || result) return;
        setError('');
        setIsSubmitting(true);
        try {
            const payload = {
                examId: exam.id,
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
            const res = await subjectService.submitExam(payload);
            setResult(res?.data?.data || null);
        } catch (err) {
            setError(err.message || 'Failed to submit exam. Please retry.');
        } finally {
            setIsSubmitting(false);
        }
    }, [answers, exam, isSubmitting, result, startedAt]);

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
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-5 md:p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-50/40 via-white to-amber-50/30">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <h2 className="text-xl md:text-2xl font-black text-gray-900">{exam.title || 'Mock Exam'}</h2>
                            <p className="text-xs md:text-sm text-gray-500 font-semibold mt-1">
                                Progress: Q{currentIndex + 1}/{total}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-600 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                {answeredCount}/{total} Answered
                            </div>
                            {remainingSeconds != null && (
                                <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                                    remainingSeconds <= 60 ? 'bg-rose-50 text-rose-600 border-rose-200' : 'bg-white text-gray-700 border-gray-200'
                                }`}>
                                    <Clock3 className="w-4 h-4" />
                                    {formatTime(remainingSeconds)}
                                </div>
                            )}

                            <button
                                onClick={handleDownload}
                                className="group btn-download-pdf flex items-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-xl border border-indigo-100 hover:border-indigo-600 transition-all duration-300 text-xs font-bold active:scale-95"
                            >
                                <FileDown className="w-3.5 h-3.5 group-hover:bounce transition-transform duration-300" />
                                <span className="hidden sm:inline">Download PDF</span>
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.35 }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-[1fr_240px] min-h-[520px]">
                    <div className="p-5 md:p-6">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentQuestion.id}
                                initial={{ opacity: 0, x: 16 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -16 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="mb-5">
                                    <div className="text-[11px] uppercase tracking-widest font-black text-indigo-500 mb-2">
                                        {currentQuestion.type.replace('_', ' ')} • {currentQuestion.difficulty} • {currentQuestion.topic}
                                    </div>
                                    <h3 className="text-lg md:text-2xl font-black text-gray-900 leading-relaxed">
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
                                    <div className={`mt-5 p-4 rounded-2xl border ${
                                        questionResult.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                                    }`}>
                                        <p className="text-sm font-bold text-gray-800">
                                            {questionResult.isCorrect ? 'Correct answer.' : questionResult.isAlmost ? 'Almost correct.' : 'Incorrect.'}
                                        </p>
                                        {!questionResult.isCorrect && currentQuestion.type !== 'short_answer' && (
                                            <p className="text-xs text-gray-600 mt-1">
                                                Correct options: {questionResult.correctAnswers.map((idx) => currentQuestion.options[idx]).join(', ')}
                                            </p>
                                        )}
                                        {!questionResult.isCorrect && ['short_answer', 'problem', 'scenario'].includes(currentQuestion.type) && (
                                            <p className="text-xs text-gray-600 mt-1">
                                                Suggested answers: {(questionResult.acceptedAnswers || []).join(' / ')}
                                            </p>
                                        )}
                                        {!questionResult.isCorrect && currentQuestion.type === 'fill_blank' && (
                                            <p className="text-xs text-gray-600 mt-1">
                                                Correct blanks: {(questionResult.blankAnswers || []).join(' | ')}
                                            </p>
                                        )}
                                        {!questionResult.isCorrect && currentQuestion.type === 'matching' && (
                                            <p className="text-xs text-gray-600 mt-1">
                                                Correct matches: {(questionResult.pairs || []).map((pair) => `${pair.left} -> ${pair.right}`).join(' • ')}
                                            </p>
                                        )}
                                        {questionResult.explanation && (
                                            <p className="text-xs text-gray-600 mt-2">{questionResult.explanation}</p>
                                        )}
                                    </div>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        <div className="mt-6 flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => jumpTo(currentIndex - 1)}
                                disabled={currentIndex === 0}
                                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => jumpTo(currentIndex + 1)}
                                disabled={currentIndex >= total - 1}
                                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 disabled:opacity-40"
                            >
                                Next
                            </button>
                            <button
                                onClick={() => toggleFlag(currentQuestion.id)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold border flex items-center gap-2 ${
                                    flagged[currentQuestion.id] ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-gray-600 border-gray-200'
                                }`}
                            >
                                <Flag className="w-4 h-4" />
                                {flagged[currentQuestion.id] ? 'Flagged' : 'Flag'}
                            </button>
                            <button
                                onClick={submitExam}
                                disabled={isSubmitting || !!result}
                                className="ml-auto px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-black disabled:opacity-50"
                            >
                                {isSubmitting ? 'Submitting...' : result ? 'Submitted' : 'Submit Exam'}
                            </button>
                            <button
                                onClick={saveAttempt}
                                disabled={!!result || isSavingAttempt}
                                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 disabled:opacity-50 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {isSavingAttempt ? 'Saving...' : 'Save'}
                            </button>
                            <button
                                onClick={resetAttempt}
                                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 flex items-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Restart
                            </button>
                        </div>
                        {lastSavedAt && !result && (
                            <div className="mt-2 text-[11px] text-gray-400 font-semibold">
                                Saved at {new Date(lastSavedAt).toLocaleTimeString()}
                            </div>
                        )}
                        {error && (
                            <div className="mt-3 text-xs font-bold text-rose-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" />
                                {error}
                            </div>
                        )}
                        {result && (
                            <div className="mt-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                                <div className="flex items-center gap-2 text-emerald-700 font-black">
                                    <Trophy className="w-4 h-4" />
                                    Score: {result.score}/{result.total}
                                </div>
                            </div>
                        )}
                    </div>

                    <aside className="border-t xl:border-t-0 xl:border-l border-gray-100 p-4 md:p-5 bg-gray-50/50">
                        <div className="text-[11px] uppercase tracking-widest font-black text-gray-500 mb-3">Navigator</div>
                        <div className="grid grid-cols-5 xl:grid-cols-4 gap-2">
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
                                const base = evaluation
                                    ? (evaluation.isCorrect ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-amber-100 text-amber-700 border-amber-300')
                                    : isFlagged
                                        ? 'bg-yellow-100 text-yellow-700 border-yellow-300'
                                        : isAnswered
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-gray-100 text-gray-500 border-gray-200';
                                return (
                                    <button
                                        key={q.id}
                                        onClick={() => jumpTo(idx)}
                                        className={`h-9 rounded-lg border text-xs font-black transition-all ${base} ${isActive ? 'ring-2 ring-indigo-400' : ''}`}
                                    >
                                        {idx + 1}
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                </div>
            </div>
            </div>

            {/* Printable View */}
            <PrintableExam exam={exam} />
        </div>
    );
};

export default ExamView;
