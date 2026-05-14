import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock3, FileText, Flag, RefreshCw, Save, Trophy, FileDown } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { toast } from 'react-hot-toast';
import { MaterialService } from '@/services/MaterialService';
import AnalyticsService from '@/services/AnalyticsService';
import { ExportService } from '@/services/ExportService';
import logo from '@/assets/logo.png';
import pdfStyles from '@/assets/styles/pdf-v1.css?inline';
import { extractExamData } from '@/features/subjects/utils/examUtils';


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
    const isFreeText = ['short_answer', 'problem', 'scenario'].includes(question.type || '') || (!!question.answer_space && (!question.options || question.options.length === 0));

    if (isFreeText) {
        return (
            <textarea
                value={answer.answerText || ''}
                onChange={(e) => onTextChange(question, e.target.value)}
                disabled={readOnly}
                placeholder={question.answer_space || "Write your answer clearly and concisely..."}
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
            {(question.options || []).map((option, idx) => {
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

// ---------------------------------------------------------------------------


const ExamView = ({ examData: rawExamData, examId: propExamId, subjectId, isExpanded = false }) => {
    const examData = extractExamData(rawExamData);
    // Always prefer the explicitly passed DB UUID prop (propExamId) over the internal JSON id
    const examId = propExamId || examData?.id;
    const isTransient = !examId || String(examId).startsWith('streaming-exam-');
    const [exam, setExam] = useState(null);
    const [answers, setAnswers] = useState({});
    const [currentIndex, setCurrentIndex] = useState(0);
    const [flagged, setFlagged] = useState({});
    const [startedAt, setStartedAt] = useState(null);
    const [result, setResult] = useState(null);
    const [viewMode, setViewMode] = useState('exam'); // 'exam' | 'results'
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
        setViewMode('exam');
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

        if (!examId || isTransient) return;
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
            
            if (attempt.submittedAt) {
                setResult(attempt.result || null);
                setViewMode('results');
            }
        }).catch(() => {
            // handle error if needed
        });
    }, [examId]);

    // Keep exam data in sync during streaming (don't reset user answers)
    useEffect(() => {
        if (!examData?.questions?.length) return;
        setExam(prev => {
            if (prev === examData) return prev;
            return { ...examData };
        });
    }, [examData]);

    const serializeAnswers = useCallback(() => {
        if (!exam?.questions) return [];
        return exam.questions.map((q) => ({
            questionId: String(q.id),
            selectedAnswers: Array.isArray(answers[q.id]?.selectedAnswers) ? answers[q.id].selectedAnswers : [],
            answerText: answers[q.id]?.answerText || '',
            blankAnswers: Array.isArray(answers[q.id]?.blankAnswers) ? answers[q.id].blankAnswers : [],
            matchAnswers: answers[q.id]?.matchAnswers || {},
        }));
    }, [answers, exam]);

    const saveAttempt = useCallback(async () => {
        if (!examId || isTransient || result) return;
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
        if (!examId || isTransient || !exam?.questions || isSubmitting || result) return;
        setError('');
        setIsSubmitting(true);
        try {
            const payload = {
                examId: examId,
                answers: exam.questions.map((q) => ({
                    questionId: String(q.id),
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
            if (examResult) {
                toast.success(`Exam Graded: ${examResult.score}/${examResult.total}`);
            }
            setResult(examResult);
            setViewMode('results');


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
            let nextAnswers;
            if (question.type === 'single_choice') {
                nextAnswers = { ...prev, [question.id]: { ...current, selectedAnswers: [optionIndex] } };
            } else {
                const exists = current.selectedAnswers.includes(optionIndex);
                const next = exists
                    ? current.selectedAnswers.filter((v) => v !== optionIndex)
                    : [...current.selectedAnswers, optionIndex];
                nextAnswers = { ...prev, [question.id]: { ...current, selectedAnswers: next.sort((a, b) => a - b) } };
            }
            
            return nextAnswers;
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
    const [isExporting, setIsExporting] = useState(false);

    const handleDownload = async () => {
        // Target the full printable exam container to ensure all questions are exported
        const element = document.getElementById('printable-exam') || document.body;
        if (!element) return;

        setIsExporting(true);
        const fileName = `Cognify_Exam_${exam?.title || 'Expedition'}_${viewMode === 'results' ? 'Results' : 'Paper'}.pdf`;

        const downloadToast = toast.promise(
            ExportService.exportToPDF(element, fileName, {
                surgicalStyles: pdfStyles,
                scale: 2
            }),
            {
                loading: 'Architecting PDF...',
                success: (name) => `Downloaded: ${name}`,
                error: (err) => `Export failed: ${err.message || 'Check terminal'}`
            }
        );

        try {
            await downloadToast;
        } catch (err) {
            console.error('[ExamView] PDF Export failed:', err);
        } finally {
            setIsExporting(false);
        }
    };

    const resetAttempt = () => {
        setAnswers({});
        setCurrentIndex(0);
        setFlagged({});
        setResult(null);
        setViewMode('exam');
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

    if (viewMode === 'results' && result) {
        return (
            <div id="results-content" className="mx-auto max-w-4xl py-10 px-6 animate-in fade-in slide-in-from-bottom-8 duration-700 printable-summary-container">
                <div className="bg-white rounded-[3rem] border-8 border-white shadow-2xl overflow-hidden mb-8">
                    <div className="bg-indigo-600 p-12 text-center text-white">
                        <Trophy className="w-20 h-20 mx-auto mb-6 text-amber-300 shadow-sm" />
                        <h2 className="text-4xl font-black mb-2">Exam Results</h2>
                        <p className="text-white/70 font-bold uppercase tracking-[0.2em] text-sm">Real Performance Data</p>
                        
                        <div className="mt-10 flex flex-col md:flex-row items-center justify-center gap-12">
                            <div className="text-center">
                                <div className="text-7xl font-black tracking-tighter mb-1">
                                    {result.score}
                                    <span className="text-3xl text-white/40">/{result.total}</span>
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Final Points</div>
                            </div>
                            <div className="w-px h-16 bg-white/10 hidden md:block" />
                            <div className="text-center">
                                <div className="text-7xl font-black tracking-tighter mb-1">
                                    {Math.round((result.score / result.total) * 100)}
                                    <span className="text-3xl text-white/40">%</span>
                                </div>
                                <div className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60">Score Percentage</div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-12 space-y-12">
                        <div className="space-y-6">
                            <h3 id="question-breakdown" className="text-2xl font-black text-indigo-950 flex items-center gap-3">
                                <FileText className="w-6 h-6 text-indigo-400" />
                                Detailed Review
                            </h3>
                            <div className="space-y-4">
                                {result.details.map((detail, idx) => {
                                    const q = exam.questions.find(quest => String(quest.id) === String(detail.questionId));
                                    if (!q) return null;
                                    return (
                                        <div key={detail.questionId} className={cn(
                                            "p-6 rounded-[2rem] border-4 transition-all",
                                            detail.isCorrect ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"
                                        )}>
                                            <div className="flex items-start gap-4">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black",
                                                    detail.isCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                                                )}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="font-bold text-gray-900 mb-3">{q.question}</p>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">Your Answer</div>
                                                            <div className={cn("font-bold text-gray-700")}>
                                                                {q.type === 'single_choice' || q.type === 'multiple_choice' 
                                                                    ? (q.options[detail.userAnswer?.[0]] || 'No answer')
                                                                    : (detail.userAnswerText || 'No answer')}
                                                            </div>
                                                        </div>
                                                        {!detail.isCorrect && (
                                                            <div className="space-y-1">
                                                                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Correct Answer</div>
                                                                <div className="font-bold text-emerald-600">
                                                                    {q.type === 'single_choice' || q.type === 'multiple_choice'
                                                                        ? (q.options[detail.correctAnswers?.[0]] || 'N/A')
                                                                        : (detail.correctAnswerText || 'N/A')}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-4">
                    <button
                        onClick={handleDownload}
                        disabled={isExporting}
                        className="px-8 py-4 bg-white border-4 border-indigo-100 text-indigo-600 rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
                    >
                        <FileDown className={cn("w-4 h-4", isExporting && "animate-bounce")} />
                        {isExporting ? 'Architecting...' : 'Download PDF Results'}
                    </button>
                    <button
                        onClick={resetAttempt}
                        className="px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry Expedition
                    </button>
                    <button
                        onClick={() => window.history.back()}
                        className="px-8 py-4 bg-gray-950 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-[10px] hover:scale-105 active:scale-95 transition-all"
                    >
                        Return to Workspace
                    </button>
                </div>
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
                                    disabled={isExporting}
                                    className="group flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 text-indigo-600 rounded-[1.5rem] border-4 border-indigo-50 transition-all font-black uppercase tracking-widest text-[10px] shadow-sm hover:scale-105 disabled:opacity-50"
                                >
                                    <FileDown className={cn("w-4 h-4", isExporting && "animate-bounce")} />
                                    {isExporting ? 'Exporting...' : 'PDF'}
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

                <div id="exam-content" className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-8">
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
                                    {isSavingAttempt && (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-400 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse">
                                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                                            Autosaving
                                        </div>
                                    )}
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
                                        <span>{(currentQuestion.type || 'single_choice').replace('_', ' ')}</span>
                                        <span className="w-1 h-1 rounded-full bg-indigo-200" />
                                        <span className={cn(
                                            "px-3 py-1 rounded-lg",
                                            currentQuestion.difficulty === 'Hard' ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'
                                        )}>{currentQuestion.difficulty || 'Normal'}</span>
                                    </div>
                                    <h3 className="text-3xl font-black text-indigo-950 leading-tight">
                                        {currentQuestion.question || 'Generating question...'}
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
                                    onClick={() => {
                                        if (currentIndex >= total - 1) {
                                            submitExam();
                                        } else {
                                            jumpTo(currentIndex + 1);
                                        }
                                    }}
                                    disabled={isSubmitting}
                                    className="px-8 py-4 rounded-[1.5rem] bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100 hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                                >
                                    {currentIndex >= total - 1 ? (isSubmitting ? 'Submitting...' : 'Finish Exam') : 'Next Challenge'}
                                </button>
                            </div>

                            <div className="flex gap-3">
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
            <PrintableExam exam={exam} result={result} answers={answers} />
        </div>
    );
};

const PrintableExam = ({ exam, result, answers }) => {
    return (
        <div id="printable-exam" className="hidden print:block fixed inset-0 bg-white z-[9999] overflow-auto p-12 text-gray-900 font-serif">
            {/* Branded Header */}
            <div className="max-w-4xl mx-auto flex justify-between items-end border-b-4 border-[#2d3a74] pb-6 mb-12">
                <div className="flex items-center gap-4">
                    <img src={logo} alt="Cognify Logo" className="w-16 h-16 object-contain" />
                    <div>
                        <h1 className="text-4xl font-black text-[#2d3a74] uppercase tracking-tighter leading-none">
                            Cogni<span className="text-[#8ce0c9]">fy</span>
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-gray-400 mt-1">Academic Intelligence Division</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-[#2d3a74]">{exam?.title || 'Examination Paper'}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mt-1">Date: {new Date().toLocaleDateString()}</div>
                </div>
            </div>

            {result && (
                <div className="mb-12 overflow-hidden rounded-3xl border-2 border-[#2d3a74] flex">
                    <div className="bg-[#2d3a74] text-white p-8 flex flex-col justify-center items-center min-w-[200px]">
                        <div className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-60 mb-2">Final Score</div>
                        <div className="text-5xl font-black">{result.score} / {result.total}</div>
                    </div>
                    <div className="flex-1 bg-gray-50 p-8 flex flex-col justify-center">
                        <div className="text-sm font-bold text-[#2d3a74] mb-1">Mastery Achievement Confirmed</div>
                        <div className="text-3xl font-black text-[#8ce0c9]">{Math.round((result.score / result.total) * 100)}%</div>
                        <div className="mt-2 text-[10px] text-gray-400 font-medium italic">This document serves as an official record of the assessment performed via Cognify AI.</div>
                    </div>
                </div>
            )}

            <div className="space-y-12">
                {(exam?.questions || []).map((q, idx) => {
                    const detail = result?.details?.find(d => String(d.questionId) === String(q.id));
                    const userAnswer = answers?.[q.id];
                    
                    return (
                        <div key={`print-${q.id}`} className="break-inside-avoid border-b border-gray-100 pb-10">
                            <div className="flex gap-6 mb-4">
                                <div className="p-3 bg-[#2d3a74] text-white font-black text-xl min-w-[50px] h-[50px] flex items-center justify-center rounded-lg shadow-sm">
                                    {idx + 1}
                                </div>
                                <div className="pt-2 flex-1">
                                    <p className="text-2xl font-bold mb-6 text-[#1a1f3d] leading-tight">{q.question}</p>
                                    
                                    {/* Options for Choices */}
                                    {(q.type === 'single_choice' || q.type === 'multiple_select') && (
                                        <div className="grid grid-cols-2 gap-4 ml-2">
                                            {(q.options || []).map((opt, oIdx) => {
                                                const isUserSelection = userAnswer?.selectedAnswers?.includes(oIdx);
                                                const isCorrectSelection = detail?.correctAnswers?.includes(oIdx);
                                                
                                                return (
                                                    <div key={`print-opt-${oIdx}`} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${isUserSelection ? 'border-[#2d3a74] bg-gray-50' : 'border-gray-100'}`}>
                                                        <div className={`w-5 h-5 rounded-full border-2 border-[#2d3a74] flex items-center justify-center`}>
                                                            {isUserSelection && <div className="w-2.5 h-2.5 rounded-full bg-[#2d3a74]" />}
                                                        </div>
                                                        <span className={`text-base font-medium ${isCorrectSelection && result ? 'text-[#2d3a74] font-black' : 'text-gray-700'}`}>
                                                            {opt}
                                                            {isCorrectSelection && result && <span className="ml-2 text-[10px] font-bold bg-[#8ce0c9]/20 text-[#2d3a74] px-1.5 py-0.5 rounded uppercase">Correct</span>}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Evaluation for Text-based */}
                                    {result && detail && !['single_choice', 'multiple_select'].includes(q.type) && (
                                        <div className="mt-4 p-6 bg-gray-50 border-l-4 border-[#2d3a74] rounded-r-2xl space-y-3">
                                            <div>
                                                <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">Your Response:</div>
                                                <div className="text-sm font-bold text-gray-800 italic">"{detail.userAnswerText || "(No response)"}"</div>
                                            </div>
                                            {!detail.isCorrect && (
                                                <div className="pt-2 border-t border-gray-200">
                                                    <div className="text-[10px] font-bold uppercase text-[#2d3a74] mb-1">Accepted Reference:</div>
                                                    <div className="text-sm font-black underline decoration-[#8ce0c9] decoration-2">{detail.correctAnswerText || detail.acceptedAnswers?.[0]}</div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    
                                    {result && detail && detail.explanation && (
                                        <div className="mt-6 text-xs text-gray-500 leading-relaxed bg-[#8ce0c9]/5 p-4 rounded-xl italic border border-[#8ce0c9]/20">
                                            <strong className="text-[#2d3a74] not-italic mr-1">Instructor Insight:</strong> {detail.explanation}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Branded Footer / Signature */}
            <div className="mt-24 pt-12 border-t-2 border-gray-100 flex justify-between items-center">
                <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.5em] text-gray-300">Validation Authority</div>
                    <div className="text-lg font-black text-[#2d3a74]">Cognify <span className="text-[#8ce0c9]">AI</span> Systems</div>
                    <div className="text-[9px] text-gray-400">Authenticated Resource ID: {Math.random().toString(36).substring(7).toUpperCase()}</div>
                </div>
                <div className="text-right">
                    <div className="w-48 h-px bg-gray-300 mb-4 ml-auto" />
                    <div className="font-serif italic text-2xl text-[#2d3a74] pr-4">Cognify Academic</div>
                    <div className="text-[9px] font-bold uppercase text-gray-400 mt-2">Official Digital Signature</div>
                </div>
            </div>
        </div>
    );
};

export default ExamView;
