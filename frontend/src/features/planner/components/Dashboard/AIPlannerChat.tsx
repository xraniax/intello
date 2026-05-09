import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, User, Bot, Loader2, CheckCircle2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    actions?: any[];
}

const AIPlannerChat: React.FC = () => {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: "Hi! I'm your AI Planning Assistant. Need help organizing your study group, preparing for an exam, or optimizing your schedule? Just ask!"
        }
    ]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    const { mutate, isPending } = useMutation({
        mutationFn: async (prompt: string) => {
            const resp = await axios.post('/api/planner/ai/chat', { prompt });
            return resp.data.data;
        },
        onSuccess: (data) => {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: data.message,
                actions: data.actions_executed
            }]);
            // Invalidate planner data to refresh dashboard
            queryClient.invalidateQueries({ queryKey: ['planner-overview'] });
        },
        onError: (error: any) => {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: "Sorry, I ran into an issue. " + (error.response?.data?.message || error.message)
            }]);
        }
    });

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isPending]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isPending) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        mutate(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-[600px] bg-white rounded-3xl border border-indigo-50 shadow-xl shadow-indigo-500/5 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-sm">Planning Assistant</h3>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-white/70 text-[10px] font-medium uppercase tracking-wider">AI Powered</span>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth"
            >
                <AnimatePresence initial={false}>
                    {messages.map((m) => (
                        <motion.div
                            key={m.id}
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                m.role === 'user' ? 'bg-indigo-100 text-indigo-600' : 'bg-violet-100 text-violet-600'
                            }`}>
                                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`max-w-[85%] space-y-2`}>
                                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                    m.role === 'user' 
                                        ? 'bg-indigo-600 text-white rounded-tr-none' 
                                        : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'
                                } shadow-sm`}>
                                    {m.content}
                                </div>

                                {/* Actions Display */}
                                {m.actions && m.actions.length > 0 && (
                                    <div className="grid gap-2 mt-2">
                                        {m.actions.map((action: any, i: number) => (
                                            <motion.div 
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.1 }}
                                                className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-[11px] text-emerald-700 font-medium"
                                            >
                                                <CheckCircle2 size={12} className="text-emerald-500" />
                                                <span>Executed: {action.action.replace('_', ' ')}</span>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
                {isPending && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-3"
                    >
                        <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center">
                            <Bot size={16} />
                        </div>
                        <div className="bg-slate-50 border border-slate-100 px-4 py-3 rounded-2xl rounded-tl-none">
                            <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border-t border-slate-100">
                <div className="relative group">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type your request here..."
                        disabled={isPending}
                        className="w-full bg-white border border-slate-200 rounded-2xl pl-5 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 group-hover:border-slate-300"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isPending}
                        className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200 active:scale-95"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AIPlannerChat;
