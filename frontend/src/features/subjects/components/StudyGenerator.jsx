import React from 'react';
import { Sparkles, BookOpen, Brain, FileText, ClipboardList, Minus, Plus } from 'lucide-react';

const TYPES = [
    {
        id: 'flashcards',
        label: 'Flashcards',
        icon: BookOpen,
        description: 'Q&A cards to test recall',
        color: 'indigo',
    },
    {
        id: 'summary',
        label: 'Summary',
        icon: FileText,
        description: 'Concise overview of key ideas',
        color: 'emerald',
    },
    {
        id: 'quiz',
        label: 'Quiz',
        icon: Brain,
        description: 'Multiple-choice questions',
        color: 'violet',
    },
    {
        id: 'mock_exam',
        label: 'Mock Exam',
        icon: ClipboardList,
        description: 'Full timed exam experience',
        color: 'rose',
    },
];

const DIFFICULTIES = [
    { id: 'Intro', label: 'Beginner' },
    { id: 'Inter', label: 'Intermediate' },
    { id: 'Adv',   label: 'Advanced' },
];

const EXAM_TYPES = [
    { id: 'mcq',        label: 'Multiple Choice' },
    { id: 'essay',      label: 'Written Response' },
    { id: 'fill_blank', label: 'Fill in the Blank' },
    { id: 'matching',   label: 'Matching' },
];

const COLOR_MAP = {
    indigo:  { active: 'bg-indigo-50 border-indigo-400 text-indigo-700',   icon: 'bg-indigo-100 text-indigo-600' },
    emerald: { active: 'bg-emerald-50 border-emerald-400 text-emerald-700', icon: 'bg-emerald-100 text-emerald-600' },
    violet:  { active: 'bg-violet-50 border-violet-400 text-violet-700',   icon: 'bg-violet-100 text-violet-600' },
    rose:    { active: 'bg-rose-50 border-rose-400 text-rose-700',         icon: 'bg-rose-100 text-rose-600' },
};

const countHasLabel = { flashcards: 'Cards', quiz: 'Questions', mock_exam: 'Questions' };

const StudyGenerator = ({
    genType,
    setGenType,
    handleGenerate,
    isGenerating,
    selectedCount,
}) => {
    const [difficulty, setDifficulty] = React.useState('Inter');
    const [count, setCount] = React.useState(10);
    const [examTypes, setExamTypes] = React.useState(['mcq', 'essay']);

    const activeType = TYPES.find(t => t.id === genType) || TYPES[0];
    const showCount = genType !== 'summary';
    const showExamTypes = genType === 'mock_exam';
    const countLabel = countHasLabel[genType] || 'Items';

    const onGenerate = () => {
        handleGenerate({ difficulty, count, examTypes, topic: '' });
    };

    const toggleExamType = (type) => {
        setExamTypes(prev =>
            prev.includes(type)
                ? prev.length > 1 ? prev.filter(t => t !== type) : prev
                : [...prev, type]
        );
    };

    const clampCount = (val) => Math.min(50, Math.max(3, val));

    return (
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                </div>
                <span className="font-bold text-sm text-gray-800">Generate Study Material</span>
            </div>

            <div className="p-5 space-y-5">
                {/* Type Selector */}
                <div className="grid grid-cols-2 gap-2">
                    {TYPES.map(({ id, label, icon: Icon, description, color }) => {
                        const isActive = genType === id;
                        const colors = COLOR_MAP[color];
                        return (
                            <button
                                key={id}
                                onClick={() => setGenType(id)}
                                className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${
                                    isActive
                                        ? colors.active + ' shadow-sm'
                                        : 'border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white'
                                }`}
                            >
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isActive ? colors.icon : 'bg-white text-gray-400'}`}>
                                    <Icon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                    <p className={`text-xs font-bold leading-tight ${isActive ? '' : 'text-gray-700'}`}>{label}</p>
                                    <p className={`text-[10px] leading-tight mt-0.5 ${isActive ? 'opacity-70' : 'text-gray-400'}`}>{description}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Difficulty */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Difficulty</label>
                    <div className="flex gap-1.5">
                        {DIFFICULTIES.map(({ id, label }) => (
                            <button
                                key={id}
                                onClick={() => setDifficulty(id)}
                                className={`flex-1 py-2 rounded-lg text-[11px] font-bold border transition-all ${
                                    difficulty === id
                                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Count — hidden for summary */}
                {showCount && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{countLabel}</label>
                            <span className="text-xs font-bold text-indigo-600">{count}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCount(c => clampCount(c - 1))}
                                className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors shrink-0"
                            >
                                <Minus className="w-3 h-3" />
                            </button>
                            <input
                                type="range" min="3" max="50" step="1"
                                value={count}
                                onChange={(e) => setCount(parseInt(e.target.value))}
                                className="flex-1 accent-indigo-600 h-1.5 rounded-lg appearance-none bg-gray-200 cursor-pointer"
                            />
                            <button
                                onClick={() => setCount(c => clampCount(c + 1))}
                                className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:border-indigo-300 hover:text-indigo-600 transition-colors shrink-0"
                            >
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="flex justify-between text-[9px] text-gray-300 font-bold px-0.5">
                            <span>3</span><span>50</span>
                        </div>
                    </div>
                )}

                {/* Exam question types */}
                {showExamTypes && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Question Types</label>
                        <div className="grid grid-cols-2 gap-1.5">
                            {EXAM_TYPES.map(({ id, label }) => (
                                <button
                                    key={id}
                                    onClick={() => toggleExamType(id)}
                                    className={`py-2 px-3 rounded-lg text-[11px] font-bold border transition-all text-left ${
                                        examTypes.includes(id)
                                            ? 'bg-violet-50 border-violet-400 text-violet-700'
                                            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Generate button */}
                <button
                    onClick={onGenerate}
                    disabled={isGenerating || selectedCount === 0}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                        background: selectedCount === 0 || isGenerating ? undefined : 'linear-gradient(135deg, var(--c-primary), #4F46E5)',
                        backgroundColor: selectedCount === 0 || isGenerating ? '#e5e7eb' : undefined,
                        color: selectedCount === 0 || isGenerating ? '#9ca3af' : 'white',
                        boxShadow: selectedCount > 0 && !isGenerating ? '0 4px 14px -2px rgba(99, 102, 241, 0.4)' : 'none',
                    }}
                >
                    {isGenerating ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Generating…
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" />
                            Generate {activeType.label}
                        </>
                    )}
                </button>

                {selectedCount === 0 && !isGenerating && (
                    <p className="text-center text-[11px] text-gray-400 font-medium -mt-2">
                        Select at least one source file above
                    </p>
                )}
            </div>
        </section>
    );
};

export default StudyGenerator;
