import React, { useState } from 'react';
import { Sparkles, Layout, BookOpen, FileText, CheckCircle2, History, RotateCcw, BrainCircuit } from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';
import SummaryView from './SummaryView';
import QuizView from './QuizView';
import FlashcardsView from './FlashcardsView';

const MATERIAL_TYPES = ['flashcards', 'summary', 'quiz', 'mock_exam'];

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
    isExpanded
}) => {
    const [genOptions, setGenOptions] = useState({
        count: 10,
        difficulty: 'adaptive', // 'adaptive' = no preset difficulty (server-adaptive or default)
        cardType: 'mixed',
        topics: '',
        examTypes: ['single_choice', 'multiple_select', 'short_answer'],
        timeLimit: 30,
    });

    const hasOptions = ['flashcards', 'quiz', 'mock_exam'].includes(genType);
    const isAdaptiveQuiz = genType === 'quiz' && genOptions.difficulty === 'adaptive';
    const requiresSources = genType !== 'mock_exam' && !isAdaptiveQuiz;
    const canGenerate = !isGenerating && (!requiresSources || selectedCount > 0);
    const displayMessage = jobProgress?.message || (hasOptions ? `Assembling ${genOptions.count} ${genType.replace('_', ' ')}...` : 'Processing Knowledge...');

    return (
        <div className="panel-inner">
            <div className="panel-header border-b border-gray-100/50 bg-white/80 backdrop-blur-sm sticky top-0 z-10 transition-all">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="panel-title font-black tracking-tight text-gray-900 uppercase tracking-[0.15em] text-[11px]">Study Intelligence</span>
                </div>
                {genResult && (
                    <button
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        onClick={() => setGenResult('')}
                        title="Clear Insight"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="panel-body">
                <section className="bg-gray-50/50 p-4 border-b border-gray-100 mb-2">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cognitive Strategy</span>
                        {selectedCount > 0 && (
                            <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                {selectedCount} Sources Selected
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {MATERIAL_TYPES.map(type => (
                            <button
                                key={type}
                                onClick={() => setGenType(type)}
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border-2 ${genType === type
                                        ? 'bg-white border-indigo-500 text-indigo-600 shadow-lg shadow-indigo-100'
                                        : 'bg-white border-gray-100 text-gray-400 hover:border-indigo-200 hover:text-indigo-400'
                                    }`}
                            >
                                {type === 'summary' && <FileText className="w-3 h-3" />}
                                {type === 'flashcards' && <Layout className="w-3 h-3" />}
                                {type === 'quiz' && <CheckCircle2 className="w-3 h-3" />}
                                {type === 'mock_exam' && <BrainCircuit className="w-3 h-3" />}
                                {type.replace('_', ' ')}
                            </button>
                        ))}
                    </div>

                    {hasOptions && (
                        <div className="bg-white/50 rounded-2xl p-4 mb-4 border border-indigo-50/50 space-y-4 animate-in slide-in-from-top-2 duration-300">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        {genType === 'flashcards' ? 'Number of Cards' : 'Number of Questions'}
                                    </label>
                                    <span className="text-xs font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{genOptions.count}</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max={20}
                                    step="1"
                                    value={genOptions.count}
                                    onChange={(e) => setGenOptions(prev => ({ ...prev, count: parseInt(e.target.value) }))}
                                    className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                />
                                <div className="flex justify-between text-[8px] text-gray-400 font-bold mt-1 px-1">
                                    <span>1</span>
                                    <span>20</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Difficulty Curve</label>
                                <div className="grid grid-cols-3 gap-1 bg-gray-100/80 rounded-xl p-1">
                                    {[
                                        { label: 'Adaptive', value: 'adaptive', badge: 'RECOMMENDED' },
                                        { label: 'Intro', value: 'Intro', badge: null },
                                        { label: 'Inter', value: 'Inter', badge: null },
                                        { label: 'Adv', value: 'Adv', badge: null },
                                        { label: 'Progression', value: 'Progression', badge: null },
                                        { label: 'Balanced', value: 'Balanced', badge: null },
                                    ].map(({ label, value, badge }) => (
                                        <div key={label} className="relative">
                                            <button
                                                onClick={() => setGenOptions(prev => ({ ...prev, difficulty: value }))}
                                                className={`w-full py-1.5 text-[8px] font-black uppercase tracking-wider rounded-lg transition-all ${genOptions.difficulty === value
                                                        ? 'bg-white text-indigo-600 shadow-sm'
                                                        : 'text-gray-400 hover:text-gray-600 hover:bg-white/40'
                                                    }`}
                                            >
                                                {label}
                                            </button>
                                            {badge && (
                                                <span className="absolute -top-1 -right-1 text-[6px] font-black bg-blue-500 text-white px-1 rounded-full">
                                                    {badge}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {genOptions.difficulty === 'adaptive' && (
                                    <p className="text-[8px] text-gray-400 mt-2 italic">Questions adapt to your performance level</p>
                                )}
                            </div>

                            {genType === 'flashcards' && (
                                <div>
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Focus Type</label>
                                    <div className="grid grid-cols-2 gap-1 bg-gray-100/80 rounded-xl p-1">
                                        {['mixed', 'definition', 'Q&A', 'conceptual'].map(type => (
                                            <button
                                                key={type}
                                                onClick={() => setGenOptions(prev => ({ ...prev, cardType: type }))}
                                                className={`py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${genOptions.cardType === type
                                                        ? 'bg-white text-indigo-600 shadow-sm'
                                                        : 'text-gray-400 hover:text-gray-600'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {genType === 'mock_exam' && (
                                <>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Topics (comma separated)</label>
                                        <input
                                            type="text"
                                            value={genOptions.topics}
                                            onChange={(e) => setGenOptions(prev => ({ ...prev, topics: e.target.value }))}
                                            placeholder="OS, DB, Networks"
                                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Select Question Types</label>
                                        <div className="space-y-1.5">
                                            {[
                                                { id: 'single_choice', label: 'Single Choice' },
                                                { id: 'multiple_select', label: 'Multiple Select' },
                                                { id: 'short_answer', label: 'Short Answer' },
                                                { id: 'problem', label: 'Problem Solving' },
                                                { id: 'fill_blank', label: 'Fill in the Gaps' },
                                                { id: 'matching', label: 'Matching' },
                                                { id: 'scenario', label: 'Scenario' },
                                            ].map(({ id, label }) => {
                                                const active = genOptions.examTypes.includes(id);
                                                return (
                                                    <button
                                                        key={id}
                                                        onClick={() => setGenOptions(prev => {
                                                            const next = active
                                                                ? prev.examTypes.filter((t) => t !== id)
                                                                : [...prev.examTypes, id];
                                                            return { ...prev, examTypes: next.length > 0 ? next : ['single_choice'] };
                                                        })}
                                                        className={`w-full flex items-center justify-between py-2.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${active
                                                                ? 'bg-indigo-50 text-indigo-600 border-indigo-200 shadow-sm'
                                                                : 'bg-white text-gray-400 border-gray-100 hover:border-indigo-100'
                                                            }`}
                                                    >
                                                        <span>{label}</span>
                                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${active ? 'bg-indigo-500 border-indigo-500' : 'border-gray-200'
                                                            }`}>
                                                            {active && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Time Limit (minutes)</label>
                                            <span className="text-xs font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{genOptions.timeLimit}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="5"
                                            max="180"
                                            step="5"
                                            value={genOptions.timeLimit}
                                            onChange={(e) => setGenOptions(prev => ({ ...prev, timeLimit: parseInt(e.target.value, 10) }))}
                                            className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <button
                        onClick={() => handleGenerate(hasOptions ? genOptions : undefined)}
                        disabled={!canGenerate}
                        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-500 font-black uppercase tracking-widest text-xs ${!canGenerate
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                : 'btn-vibrant shadow-xl shadow-purple-200 hover:shadow-purple-300 -translate-y-0.5 hover:-translate-y-1'
                            }`}
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>{displayMessage}</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-4 h-4" />
                                <span>Refine Knowledge</span>
                            </>
                        )}
                    </button>
                </section>

                {/* Generated Output */}
                <div className="p-6">
                    {genError && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-black uppercase tracking-widest text-center animate-in shake duration-500">
                            {genError}
                        </div>
                    )}

                    {genResult ? (
                        <div className="animate-in slide-in-from-bottom-4 duration-500">
                            {(() => {
                                // Attempt to parse genResult if it's likely JSON
                                let parsedResult = genResult;
                                if (typeof genResult === 'string' && (genResult.trim().startsWith('{') || genResult.trim().startsWith('['))) {
                                    try { parsedResult = JSON.parse(genResult); } catch (e) { /* fallback to raw string */ }
                                }

                                if (genType === 'summary') {
                                    return <SummaryView summaryData={parsedResult} title="Draft Summary" isExpanded={isExpanded} />;
                                }
                                
                                if (genType === 'quiz') {
                                    return (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 mb-2 px-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                    <Sparkles className="w-4 h-4 text-indigo-500" />
                                                </div>
                                                <h3 className="text-lg font-black text-gray-900 tracking-tight capitalize">Quiz Preview</h3>
                                            </div>
                                            <div className="bg-white/50 border border-indigo-100/50 rounded-[2.5rem] overflow-hidden shadow-xl shadow-indigo-100/10">
                                                <QuizView quizData={parsedResult} isExpanded={isExpanded} />
                                            </div>
                                        </div>
                                    );
                                }

                                if (genType === 'flashcards') {
                                    return (
                                        <div className="space-y-6">
                                            <div className="flex items-center gap-3 mb-2 px-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                    <Sparkles className="w-4 h-4 text-indigo-500" />
                                                </div>
                                                <h3 className="text-lg font-black text-gray-900 tracking-tight capitalize">Flashcard Preview</h3>
                                            </div>
                                            <div className="bg-white/50 border border-indigo-100/50 rounded-[2.5rem] overflow-hidden shadow-xl shadow-indigo-100/10">
                                                <FlashcardsView flashcardsData={parsedResult} isExpanded={isExpanded} />
                                            </div>
                                        </div>
                                    );
                                }

                                // Fallback for other types or raw strings
                                return (
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-3 mb-2 px-2">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                                <Sparkles className="w-4 h-4 text-indigo-500" />
                                            </div>
                                            <h3 className="text-lg font-black text-gray-900 tracking-tight capitalize">{genType.replace('_', ' ')} Insight</h3>
                                        </div>
                                        <div className="bg-white border border-gray-100 rounded-[1.5rem] p-8 shadow-xl shadow-indigo-100/20 text-gray-800 leading-relaxed text-sm whitespace-pre-wrap relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-bl-[4rem] group-hover:scale-110 transition-transform"></div>
                                            {typeof parsedResult === 'object' ? JSON.stringify(parsedResult, null, 2) : String(parsedResult)}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    ) : isGenerating ? (
                        <div className="space-y-4 animate-neural p-8 border border-indigo-100/50 rounded-[2rem] bg-indigo-50/20 backdrop-blur-md shadow-2xl shadow-indigo-200/20">
                            <div className="flex items-center gap-3 mb-4">
                                <Skeleton className="w-8 h-8 rounded-lg" />
                                <Skeleton className="h-6 w-48 rounded-md" />
                            </div>
                            <div className="bg-white border border-gray-100 rounded-[1.5rem] p-8 space-y-3 shadow-sm">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-[90%]" />
                                <Skeleton className="h-4 w-[95%]" />
                                <Skeleton className="h-4 w-[85%]" />
                                <Skeleton className="h-4 w-[92%]" />
                            </div>
                        </div>
                    ) : (
                        <div className="py-20 text-center space-y-6 opacity-40">
                            <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center mx-auto transition-transform hover:rotate-12 duration-500">
                                <BrainCircuit className="w-10 h-10 text-gray-300" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Archival Vacuum</p>
                                <p className="text-xs text-gray-400 font-medium max-w-[200px] mx-auto leading-relaxed">Select your knowledge sources and refine them into study artifacts.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MaterialsPanel;
