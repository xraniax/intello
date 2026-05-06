import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Layout, FileText, CheckCircle2, RotateCcw, BrainCircuit, Minus, Plus, ClipboardList, ArrowLeft, Info, HelpCircle, Flame, Volume2, VolumeX, Keyboard, Key, Zap, Brain, Target, Heart, GraduationCap, Lightbulb } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';
import GenerationLoadingOverlay from '@/components/ui/GenerationLoadingOverlay';
import SummaryView from './SummaryView';
import QuizView from './QuizView';
import FlashcardsView from './FlashcardsView';

// ─── Static config ────────────────────────────────────────────────────────────

const MATERIAL_TYPES = [
    { id: 'flashcards', label: 'Flashcards', icon: Layout,       description: 'Q&A cards to test recall'       },
    { id: 'summary',   label: 'Summary',    icon: FileText,      description: 'Key ideas at a glance'          },
    { id: 'quiz',      label: 'Quiz',       icon: CheckCircle2,  description: 'Multiple-choice questions'      },
    { id: 'mock_exam', label: 'Mock Exam',  icon: ClipboardList, description: 'Timed exam with mixed formats'  },
];

const DIFFICULTIES = [
    { id: 'adaptive', label: 'Adaptive', badge: 'NEW' },
    { id: 'Intro', label: 'Beginner'     },
    { id: 'Inter', label: 'Intermediate' },
    { id: 'Adv',   label: 'Advanced'     },
];

const EXAM_QUESTION_TYPES = [
    { id: 'single_choice',   label: 'Single Choice'   },
    { id: 'multiple_select', label: 'Multiple Select' },
    { id: 'short_answer',    label: 'Short Answer'    },
    { id: 'problem',         label: 'Problem Solving' },
    { id: 'fill_blank',      label: 'Fill in the Blank' },
    { id: 'matching',        label: 'Matching'        },
];

const SUMMARY_MODES = [
    { id: 'key_concepts', title: 'Key Concepts', icon: Key, description: 'Essential points and definitions', color: 'bg-blue-50 text-blue-600 border-blue-100' },
    { id: 'concise_summary', title: 'Concise Summary', icon: Zap, description: 'Balanced compression of content', color: 'bg-amber-50 text-amber-600 border-amber-100' },
    { id: 'detailed_explanation', title: 'Detailed Explanation', icon: Brain, description: 'Step-by-step reasoning and context', color: 'bg-purple-50 text-purple-600 border-purple-100' },
    { id: 'exam_ready_notes', title: 'Exam Ready Notes', icon: Target, description: 'Optimized for rapid revision', color: 'bg-rose-50 text-rose-600 border-rose-100' },
    { id: 'teach_me_mode', title: 'Teach Me Mode', icon: Heart, description: 'Analogies and simple language', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
];

const playSuccessSound = () => {
    // Attempt to play the MP3 first
    const audio = new Audio('/sounds/success.mp3');
    audio.volume = 0.4;
    
    audio.play().catch(() => {
        // Fallback: Synthesize a soft "success" tone using Web Audio API
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.type = 'sine';
            const now = ctx.currentTime;
            
            // "Ding" sound: 880Hz (A5) -> 1320Hz (E6)
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1320, now + 0.1);
            
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

            osc.start(now);
            osc.stop(now + 0.5);
            console.log('[Audio] Fallback synthesized tone played');
        } catch (e) {
            console.warn('[Audio] Fallback also failed:', e);
        }
    });
};

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

// ─── Component ────────────────────────────────────────────────────────────────

const MaterialsPanel = ({
    genType,
    setGenType,
    handleGenerate,
    isGenerating,
    jobProgress,
    selectedCount,
    genResult,
    setGenResult,
    genError,
    isExpanded,
    onRetry,
    generationStartTime,
}) => {
    // Merged state using redis-fix pattern but individual variables for legacy compatibility where needed or just full object
    const [genOptions, setGenOptions] = useState({
        count: 10,
        difficulty: 'adaptive',
        summary_mode: 'concise_summary',
        topics: '',
        examTypes: ['single_choice', 'multiple_select', 'short_answer'],
        timeLimit: 30,
        cardType: 'mixed'
    });

    const [showAlert,  setShowAlert]  = useState(false);
    const alertTimer = useRef(null);

    const isAdaptiveQuiz = genType === 'quiz' && genOptions.difficulty === 'adaptive';
    const showCount    = genType !== 'summary' && !isAdaptiveQuiz;
    const showExamOpts = genType === 'mock_exam';
    const countLabel   = genType === 'flashcards' ? 'Cards' : 'Questions';
    const activeType   = MATERIAL_TYPES.find(t => t.id === genType) || MATERIAL_TYPES[0];

    const displayMessage = jobProgress?.message
        || (isAdaptiveQuiz ? "Preparing Adaptive Session..." : `Generating ${genOptions.count} ${genType.replace('_', ' ')}…`);

    const onGenerate = () => {
        if (isGenerating) return;
        // Adaptive quizzes don't strictly require sources if they can pull from subject knowledge.
        if (selectedCount === 0 && !isAdaptiveQuiz) {
            setShowAlert(true);
            clearTimeout(alertTimer.current);
            alertTimer.current = setTimeout(() => setShowAlert(false), 3500);
            return;
        }
        setShowAlert(false);
        handleGenerate(genType, null, genOptions);
    };

    const lastSuccessfulGenRef = useRef(null);

    useEffect(() => {
        // We only trigger if:
        // 1. Generation JUST finished (isGenerating: true -> false)
        // 2. We have a valid result
        // 3. This specific result hasn't been notified yet
        if (!isGenerating && genResult && genResult !== lastSuccessfulGenRef.current && generationStartTime) {
            const duration = Date.now() - generationStartTime;
            if (duration > 1500) { 
                playSuccessSound();
                lastSuccessfulGenRef.current = genResult;
            }
        }
    }, [isGenerating, genResult, generationStartTime]);

    useEffect(() => () => clearTimeout(alertTimer.current), []);

    const toggleExamType = (id) => {
        setGenOptions(prev => {
            const next = prev.examTypes.includes(id)
                ? prev.examTypes.length > 1 ? prev.examTypes.filter(t => t !== id) : prev.examTypes
                : [...prev.examTypes, id];
            return { ...prev, examTypes: next };
        });
    };

    return (
        <div className="panel-inner" style={{ background: 'var(--c-canvas)' }}>
            {/* ── Header ── */}
            <div className="panel-header px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b-2 border-purple-50 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <span className="font-black tracking-[0.2em] uppercase text-[10px] text-gray-400">Study Generator</span>
                </div>
                {genResult && (
                    <button
                        className="p-2 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        onClick={() => setGenResult('')}
                        title="Clear result"
                    >
                        <RotateCcw className="w-4 h-4" style={{ color: 'var(--c-text-muted)' }} />
                    </button>
                )}
            </div>

            <div className="panel-body">
                {/* ── Form ── */}
                <section className="p-5 border-b-2 border-purple-50/50 space-y-5">

                    {/* Source badge */}
                    {selectedCount > 0 && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50 border border-purple-100 animate-in zoom-in-50 duration-200">
                            <div className="w-2 h-2 rounded-full bg-purple-400" />
                            <span className="text-[11px] font-bold text-purple-600">
                                {selectedCount} source{selectedCount > 1 ? 's' : ''} selected
                            </span>
                        </div>
                    )}

                    {/* Type selector */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">What to generate</p>
                        <div className="grid grid-cols-2 gap-2">
                            {MATERIAL_TYPES.map(({ id, label, icon: Icon, description }) => {
                                const active = genType === id;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => setGenType(id)}
                                        className={`flex flex-col items-start gap-1.5 p-3 rounded-2xl border-2 text-left transition-all duration-200 ${
                                            active
                                                ? 'border-purple-400 bg-purple-50 shadow-sm'
                                                : 'border-gray-100 bg-white hover:border-purple-200 hover:bg-purple-50/30'
                                        }`}
                                    >
                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${active ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>
                                        <div>
                                            <p className={`text-xs font-bold ${active ? 'text-purple-800' : 'text-gray-700'}`}>{label}</p>
                                            <p className={`text-[10px] leading-tight mt-0.5 ${active ? 'text-purple-500' : 'text-gray-400'}`}>{description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Difficulty or Mode */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">
                            {genType === 'summary' ? 'Summary Mode' : 'Difficulty'}
                        </p>
                        
                        {genType === 'summary' ? (
                            <div className="grid grid-cols-1 gap-2.5">
                                {SUMMARY_MODES.map(({ id, title, icon: Icon, description, color }) => {
                                    const active = genOptions.summary_mode === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => setGenOptions(prev => ({ ...prev, summary_mode: id }))}
                                            className={`group flex items-center gap-4 p-4 rounded-[1.5rem] border-2 text-left transition-all duration-300 ${
                                                active
                                                    ? 'border-indigo-400 bg-indigo-50 shadow-lg shadow-indigo-200/20'
                                                    : 'border-gray-100 bg-white hover:border-indigo-200 hover:shadow-md'
                                            }`}
                                        >
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                                                active 
                                                    ? `bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-200` 
                                                    : `bg-gray-50 text-gray-400 group-hover:${color.split(' ')[0]} group-hover:${color.split(' ')[1]}`
                                            }`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`text-[13px] font-black tracking-tight ${active ? 'text-indigo-900' : 'text-gray-700'}`}>{title}</p>
                                                <p className={`text-[11px] font-medium mt-0.5 leading-tight ${active ? 'text-indigo-500' : 'text-gray-400'}`}>{description}</p>
                                            </div>
                                            {active && (
                                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-1.5">
                                {DIFFICULTIES.map(({ id, label, badge }) => (
                                    <button
                                        key={id}
                                        onClick={() => setGenOptions(prev => ({ ...prev, difficulty: id }))}
                                        className={`relative py-2 rounded-xl text-[11px] font-bold border-2 transition-all ${
                                            genOptions.difficulty === id
                                                ? 'bg-purple-600 border-purple-600 text-white shadow-sm'
                                                : 'bg-white border-gray-100 text-gray-500 hover:border-purple-200'
                                        }`}
                                    >
                                        {label}
                                        {badge && (
                                            <span className="absolute -top-1 -right-1 text-[7px] font-black bg-blue-500 text-white px-1.5 py-0.5 rounded-full shadow-sm">
                                                {badge}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        {genOptions.difficulty === 'adaptive' && genType === 'quiz' && (
                            <p className="text-[10px] text-purple-400 mt-2 italic font-medium">Questions will adapt to your performance level in a live session.</p>
                        )}
                    </div>

                    {/* Count — hidden for summary or adaptive quiz */}
                    {showCount && (
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{countLabel}</p>
                                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">{genOptions.count}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setGenOptions(prev => ({ ...prev, count: clamp(prev.count - 1, 3, 30) }))}
                                    className="w-7 h-7 rounded-lg border-2 border-gray-100 bg-white flex items-center justify-center text-gray-400 hover:border-purple-300 hover:text-purple-600 transition-colors shrink-0"
                                >
                                    <Minus className="w-3 h-3" />
                                </button>
                                <input
                                    type="range" min="3" max="30" step="1"
                                    value={genOptions.count}
                                    onChange={e => setGenOptions(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200"
                                    style={{ accentColor: '#7C5CFC' }}
                                />
                                <button
                                    onClick={() => setGenOptions(prev => ({ ...prev, count: clamp(prev.count + 1, 3, 30) }))}
                                    className="w-7 h-7 rounded-lg border-2 border-gray-100 bg-white flex items-center justify-center text-gray-400 hover:border-purple-300 hover:text-purple-600 transition-colors shrink-0"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="flex justify-between text-[9px] text-gray-300 font-bold mt-1 px-0.5">
                                <span>3</span><span>30</span>
                            </div>
                        </div>
                    )}

                    {/* Mock exam extras */}
                    {showExamOpts && (
                        <>
                            {/* Question types */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5">Question Types</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {EXAM_QUESTION_TYPES.map(({ id, label }) => {
                                        const active = genOptions.examTypes.includes(id);
                                        return (
                                            <button
                                                key={id}
                                                onClick={() => toggleExamType(id)}
                                                className={`flex items-center justify-between py-2 px-3 rounded-xl border-2 text-[11px] font-bold transition-all ${
                                                    active
                                                        ? 'bg-purple-50 border-purple-400 text-purple-700'
                                                        : 'bg-white border-gray-100 text-gray-400 hover:border-purple-200'
                                                }`}
                                            >
                                                <span>{label}</span>
                                                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${active ? 'bg-purple-500 border-purple-500' : 'border-gray-300'}`}>
                                                    {active && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Time limit */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Time Limit</p>
                                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">{genOptions.timeLimit} min</span>
                                </div>
                                <input
                                    type="range" min="5" max="120" step="5"
                                    value={genOptions.timeLimit}
                                    onChange={e => setGenOptions(prev => ({ ...prev, timeLimit: parseInt(e.target.value, 10) }))}
                                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-200"
                                    style={{ accentColor: '#7C5CFC' }}
                                />
                                <div className="flex justify-between text-[9px] text-gray-300 font-bold mt-1 px-0.5">
                                    <span>5 min</span><span>2 hr</span>
                                </div>
                            </div>

                            {/* Optional topics */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Focus Topics <span className="normal-case font-medium tracking-normal text-gray-300">(optional)</span></p>
                                <input
                                    type="text"
                                    value={genOptions.topics}
                                    onChange={e => setGenOptions(prev => ({ ...prev, topics: e.target.value }))}
                                    placeholder="e.g. Networks, OS, Databases"
                                    className="w-full px-3 py-2.5 rounded-xl text-xs font-medium border-2 border-gray-100 bg-white focus:border-purple-300 focus:outline-none transition-colors placeholder-gray-300"
                                />
                            </div>
                        </>
                    )}

                    {/* Generate button */}
                    <div className="pt-1">
                        <button
                            onClick={onGenerate}
                            disabled={isGenerating}
                            className="w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed border hover:scale-[1.01]"
                            style={{ 
                                background: 'rgba(255, 255, 255, 0.65)', 
                                backdropFilter: 'blur(12px)',
                                borderColor: 'rgba(124, 58, 237, 0.3)',
                                color: '#5B21B6',
                                boxShadow: '0 4px 16px rgba(124, 58, 237, 0.1), inset 0 1px 0 rgba(255, 255, 255, 1)'
                            }}
                        >
                            {isGenerating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>{displayMessage}</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    {isAdaptiveQuiz ? "Start Adaptive Session" : `Generate ${activeType.label}`}
                                </>
                            )}
                        </button>

                        {/* No-source alert */}
                        <div className={`overflow-hidden transition-all duration-300 ${showAlert ? 'max-h-20 opacity-100 mt-2.5' : 'max-h-0 opacity-0'}`}>
                            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200">
                                <ArrowLeft className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-[11px] font-bold text-amber-700 leading-snug">
                                    Pick at least one file from the <span className="font-black">Sources</span> panel first, then generate.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Output / Result ── */}
                <div className="p-6">
                    {genError && !isGenerating && (
                        <GenerationLoadingOverlay
                            isGenerating={false}
                            genType={genType}
                            count={genOptions.count}
                            error={genError}
                            onRetry={onRetry}
                            startTime={generationStartTime}
                        />
                    )}

                    {genResult ? (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            {(() => {
                                let parsedResult = genResult;
                                if (typeof genResult === 'string' && (genResult.trim().startsWith('{') || genResult.trim().startsWith('['))) {
                                    try { parsedResult = JSON.parse(genResult); } catch { }
                                }

                                if (genType === 'summary') {
                                    return <SummaryView summaryData={parsedResult} title="Draft Summary" isExpanded={isExpanded} />;
                                }
                                if (genType === 'quiz') {
                                    return (
                                        <div className="space-y-4">
                                            <h3 className="text-base font-black text-gray-700 px-1">Quiz Preview</h3>
                                            <div className="border rounded-[2rem] overflow-hidden shadow-lg" style={{ borderColor: 'rgba(124, 92, 252, 0.15)' }}>
                                                <QuizView quizData={parsedResult} isExpanded={isExpanded} />
                                            </div>
                                        </div>
                                    );
                                }
                                if (genType === 'flashcards') {
                                    return (
                                        <div className="space-y-4">
                                            <h3 className="text-base font-black text-gray-700 px-1">Flashcard Preview</h3>
                                            <div className="border rounded-[2rem] overflow-hidden shadow-lg" style={{ borderColor: 'rgba(124, 92, 252, 0.15)' }}>
                                                <FlashcardsView flashcardsData={parsedResult} isExpanded={isExpanded} />
                                            </div>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="border rounded-2xl p-6 text-sm whitespace-pre-wrap font-mono leading-relaxed" style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border-soft)', color: 'var(--c-text)' }}>
                                        {typeof parsedResult === 'object' ? JSON.stringify(parsedResult, null, 2) : String(parsedResult)}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : isGenerating ? (
                        <GenerationLoadingOverlay
                            isGenerating={isGenerating}
                            genType={genType}
                            count={genOptions.count}
                            error={genError}
                            onRetry={onRetry}
                            startTime={generationStartTime}
                        />
                    ) : (
                        <div className="py-16 text-center space-y-4 opacity-40">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'var(--c-surface-alt)' }}>
                                <BrainCircuit className="w-8 h-8" style={{ color: 'var(--c-text-muted)' }} />
                            </div>
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--c-text-muted)' }}>
                                Configure and generate above
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MaterialsPanel;
