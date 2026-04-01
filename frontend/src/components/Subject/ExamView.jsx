import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
    FileText, 
    ClipboardCheck, 
    Eye, 
    EyeOff,
    Printer,
    Download,
    Trophy,
    BookOpen
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const ExamView = ({ examData }) => {
    const [showAnswers, setShowAnswers] = useState(false);

    if (!examData || !examData.questions || examData.questions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-gray-500">
                <FileText className="w-12 h-12 mb-4 opacity-20" />
                <p>No exam questions available.</p>
            </div>
        );
    }

    const { questions, answer_sheet } = examData;

    return (
        <div className="max-w-4xl mx-auto py-8 md:py-12 px-6">
            {/* Exam Header */}
            <div className="bg-white rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 p-8 mb-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center">
                            <ClipboardCheck className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Mock Examination</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Formal Assessment</span>
                                <span className="text-gray-200 font-bold">•</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">{questions.length} Questions</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setShowAnswers(!showAnswers)}
                            className={cn(
                                "flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all",
                                showAnswers 
                                    ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-100" 
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            )}
                        >
                            {showAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {showAnswers ? "Hide Answers" : "Show Answers"}
                        </button>
                        <button className="p-3 bg-gray-100 text-gray-400 rounded-xl hover:bg-gray-200 transition-all">
                            <Printer className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Questions Section */}
            <div className="space-y-6 mb-12">
                {questions.map((q, idx) => (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        key={idx} 
                        className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-gray-100 group-hover:bg-indigo-500 transition-colors" />
                        <div className="flex gap-6">
                            <div className="text-2xl font-black text-gray-200 group-hover:text-indigo-100 transition-colors">
                                {(idx + 1).toString().padStart(2, '0')}
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-800 mb-6 leading-relaxed">
                                    {q.question}
                                </h4>
                                <div className="p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-400 italic font-medium text-sm">
                                    {q.answer_space || "Type your answer here..."}
                                </div>

                                {/* Inline Answer (if toggled) */}
                                {showAnswers && answer_sheet && (
                                    (() => {
                                        const solution = answer_sheet.find(a => a.question_id === (idx + 1) || a.id === (idx + 1));
                                        if (!solution) return null;

                                        return (
                                            <motion.div 
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                className="mt-6 pt-6 border-t border-indigo-50"
                                            >
                                                <div className="flex gap-4">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-1">
                                                        <Trophy className="w-4 h-4 text-indigo-500" />
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Official Solution</div>
                                                        <div className="text-sm font-bold text-gray-900 mb-2">
                                                            {solution.answer}
                                                        </div>
                                                        {solution.explanation && (
                                                            <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                                                                <span className="font-bold text-gray-700">Context:</span> {solution.explanation}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Footer Summary */}
            <div className="text-center p-12 bg-gray-50 rounded-[3rem] border border-gray-100">
                <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-gray-700 mb-2">End of Examination</h3>
                <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
                    Review your answers carefully. When you're ready, toggle the "Show Answers" button to verify your knowledge.
                </p>
                <div className="mt-8 flex justify-center gap-4">
                    <button className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-gray-100 transition-all flex items-center gap-2 shadow-sm">
                        <Download className="w-4 h-4" />
                        Save as PDF
                    </button>
                    <button className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100">
                        <RotateCw className="w-4 h-4" />
                        Redo Exam
                    </button>
                </div>
            </div>
        </div>
    );
};

// Simple icon shim if RotateCw is missing
const RotateCw = (props) => (
  <svg {...props} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-cw"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
);

export default ExamView;
