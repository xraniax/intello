import React from 'react';
import { motion } from 'framer-motion';
import {
    MessageSquare, Send, Mic, Volume2
} from 'lucide-react';

const AITutor = ({
    messages,
    currentQuestion,
    setCurrentQuestion,
    handleChat,
    handleVoiceInput,
    handleTTS,
    isThinking,
    isListening,
    chatEndRef,
    contextInfo
}) => {
    return (
        <div className="glass-card bg-slate-900/30 flex flex-col h-[600px] border-slate-800/80 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800/50 bg-slate-900/50 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isThinking ? 'bg-secondary animate-pulse' : 'bg-green-500'}`} />
                    <h3 className="text-xs font-black uppercase tracking-widest">AI Subject Tutor</h3>
                </div>
                <span className="text-[10px] text-slate-500 italic">
                    {contextInfo}
                </span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                        <div className="p-4 bg-slate-800/50 rounded-full mb-4">
                            <MessageSquare size={32} />
                        </div>
                        <p className="max-w-xs text-sm">Ask me anything about these resources. Dictate your question or type below.</p>
                    </div>
                )}

                {messages.map((msg, i) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className={`relative max-w-[80%] p-4 rounded-2xl text-sm shadow-xl ${msg.role === 'user'
                                ? 'bg-primary text-white ml-12 rounded-tr-none'
                                : 'bg-slate-800 text-slate-100 mr-12 rounded-tl-none border border-slate-700/50'
                            }`}>
                            {msg.content}
                            {msg.role === 'ai' && (
                                <button
                                    onClick={() => handleTTS(msg.content)}
                                    className="absolute -bottom-6 right-0 text-slate-500 hover:text-secondary transition-all"
                                    title="Read AI response"
                                >
                                    <Volume2 size={14} />
                                </button>
                            )}
                        </div>
                    </motion.div>
                ))}

                {isThinking && (
                    <div className="flex justify-start">
                        <div className="bg-slate-800/50 p-4 rounded-2xl rounded-tl-none flex gap-2">
                            <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" />
                        </div>
                    </div>
                )}
                <div ref={chatEndRef} />
            </div>

            <div className="p-4 bg-slate-900/80 border-t border-slate-800/50">
                <form onSubmit={handleChat} className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleVoiceInput}
                        className={`p-3 rounded-xl transition-all ${isListening
                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 animate-pulse'
                                : 'bg-slate-800 text-slate-400 hover:text-secondary hover:bg-slate-700'
                            }`}
                    >
                        <Mic size={20} />
                    </button>
                    <input
                        className="flex-1 bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:border-primary outline-none transition-all placeholder:text-slate-600"
                        placeholder="Ask a question..."
                        value={currentQuestion}
                        onChange={(e) => setCurrentQuestion(e.target.value)}
                    />
                    <button
                        type="submit"
                        disabled={isThinking || !currentQuestion.trim()}
                        className="bg-primary hover:bg-primary-dark text-white p-3 rounded-xl transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-primary/20"
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AITutor;
