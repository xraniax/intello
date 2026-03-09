import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Download } from 'lucide-react';

const StudyGenerator = ({
    genType,
    setGenType,
    handleGenerate,
    isGenerating,
    selectedCount,
    genResult,
    setGenResult
}) => {
    return (
        <section className="glass-card bg-slate-950/20 relative">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4">Study Generator</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
                {['summary', 'quiz', 'notes', 'flashcards'].map(type => (
                    <button
                        key={type}
                        onClick={() => setGenType(type)}
                        className={`px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${genType === type
                                ? 'bg-secondary text-slate-900 shadow-lg shadow-secondary/20'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        {type}
                    </button>
                ))}
            </div>
            <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedCount === 0}
                className="w-full bg-gradient-to-r from-secondary/80 to-primary/80 hover:from-secondary hover:to-primary text-slate-900 font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/10 flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
                {isGenerating ? <Loader2 className="animate-spin" size={18} /> : (
                    <>
                        <Sparkles size={18} className="group-hover:animate-pulse" />
                        Generate Tools
                    </>
                )}
            </button>
            {selectedCount === 0 && (
                <span className="text-[10px] text-slate-500 mt-2 block text-center italic">Select files to use as context</span>
            )}

            {/* Local Overlay for Gen Results (if simple mode is preferred over absolute modal) */}
            <AnimatePresence>
                {genResult && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="mt-6 p-4 bg-slate-900/80 rounded-2xl border border-secondary/30 relative overflow-hidden"
                    >
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Result</span>
                            <button onClick={() => setGenResult('')} className="text-slate-500 hover:text-white">&times;</button>
                        </div>
                        <div className="text-xs leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar pr-2 whitespace-pre-wrap text-slate-300">
                            {genResult}
                        </div>
                        <button className="mt-4 w-full py-2 bg-slate-800 text-[10px] font-bold rounded-lg hover:bg-slate-700 flex items-center justify-center gap-2">
                            <Download size={12} /> Save to Notes
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
};

export default StudyGenerator;
