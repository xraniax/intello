import React from 'react';
import { Sparkles, Layout, BookOpen, FileText, CheckCircle2, History, RotateCcw, BrainCircuit } from 'lucide-react';
import Skeleton from '../Common/Skeleton';

const MATERIAL_TYPES = ['flashcards', 'summary', 'quiz', 'mock_exam'];

const MaterialsPanel = ({
    genType,
    setGenType,
    handleGenerate,
    isGenerating,
    selectedCount,
    genResult,
    setGenResult,
    genError,
}) => {
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
                                className={`flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border-2 ${
                                    genType === type 
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

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || selectedCount === 0}
                        className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all duration-500 font-black uppercase tracking-widest text-xs ${
                            isGenerating || selectedCount === 0
                                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                : 'btn-vibrant shadow-xl shadow-purple-200 hover:shadow-purple-300 -translate-y-0.5 hover:-translate-y-1'
                        }`}
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Processing Knowledge...</span>
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
                        <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-indigo-500" />
                                </div>
                                <h3 className="text-lg font-black text-gray-900 tracking-tight capitalize">{genType.replace('_', ' ')} Insight</h3>
                            </div>
                            <div className="bg-white border border-gray-100 rounded-[1.5rem] p-8 shadow-xl shadow-indigo-100/20 text-gray-800 leading-relaxed text-sm whitespace-pre-wrap relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 rounded-bl-[4rem] group-hover:scale-110 transition-transform"></div>
                                {genResult}
                            </div>
                        </div>
                    ) : isGenerating ? (
                        <div className="space-y-4">
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
