import React, { useState } from 'react';
import { PanelRightClose, MessageSquarePlus, Mic, MicOff, Send, Bot, User, Volume2 } from 'lucide-react';

const ChatPanel = ({
    messages,
    currentQuestion,
    setCurrentQuestion,
    handleChat,
    handleVoiceInput,
    handleTTS,
    isThinking,
    isListening,
    chatEndRef,
    contextInfo,
    chatError,
    onClearChat,
    onCollapse
}) => {
    return (
        <div className={`panel-inner chat-panel`}>
            {/* Panel Header — always visible */}
            <div className="panel-header border-b border-gray-100/50 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 anim-pulse"></div>
                    <span className="panel-title font-black tracking-tight text-gray-900">AI Tutor</span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                        onClick={onClearChat}
                        title="Clear conversation"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                    </button>
                    <button
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        onClick={onCollapse}
                        title="Hide panel"
                    >
                        <PanelRightClose className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Chat body */}
            <>
                {/* Context info */}
                <div className="px-3 py-1 border-b border-gray-100 bg-gray-50">
                    <span className="text-xs text-gray-500">{contextInfo}</span>
                </div>

                {/* Messages */}
                <div className="chat-messages bg-[#FAFBFF]/50 p-4 space-y-6">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4 opacity-50">
                            <div className="w-16 h-16 bg-white rounded-3xl shadow-sm flex items-center justify-center">
                                <Bot className="w-8 h-8 text-indigo-400" />
                            </div>
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-widest leading-tight">Your Tutor Awaits</p>
                            <p className="text-xs text-gray-400 max-w-[180px]">Ask anything about your selected documents to begin.</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                            <div className="flex items-end gap-2 max-w-[90%] group">
                                {msg.role === 'ai' && (
                                    <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center shrink-0 mb-1">
                                        <Bot className="w-4 h-4 text-indigo-500" />
                                    </div>
                                )}
                                <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm leading-relaxed ${
                                    msg.role === 'user' 
                                        ? 'bg-indigo-600 text-white rounded-br-none' 
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                                }`}>
                                    <div className="whitespace-pre-wrap">{msg.content}</div>
                                    {msg.role === 'ai' && (
                                        <button
                                            onClick={() => handleTTS(msg.content)}
                                            className="mt-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-500 hover:text-indigo-700 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Volume2 className="w-3 h-3" />
                                            Speak
                                        </button>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mb-1">
                                        <User className="w-4 h-4 text-indigo-600" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {isThinking && (
                        <div className="flex items-start gap-2 max-w-[90%] animate-in fade-in duration-300">
                            <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center shrink-0">
                                <Bot className="w-4 h-4 text-indigo-400" />
                            </div>
                            <div className="px-4 py-3 bg-white border border-gray-100 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                                <div className="flex gap-1">
                                    <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                    <div className="w-2 h-2 bg-indigo-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {chatError && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-[10px] font-bold uppercase tracking-widest text-center mx-4">
                            {chatError}
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="chat-input-area border-t border-gray-100 bg-white p-4">
                    <form onSubmit={handleChat} className="flex items-center gap-2 bg-gray-50 p-2 rounded-2xl border border-gray-100 focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100 transition-all">
                        <button
                            type="button"
                            onClick={handleVoiceInput}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-200 anim-pulse' : 'bg-white text-gray-400 hover:text-indigo-500 hover:shadow-sm'}`}
                        >
                            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        <input
                            className="flex-grow bg-transparent border-none outline-none text-sm font-medium px-2 py-1 placeholder:text-gray-400"
                            placeholder="Type your question..."
                            value={currentQuestion}
                            onChange={(e) => setCurrentQuestion(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isThinking || !currentQuestion.trim()}
                            className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:bg-gray-200 disabled:shadow-none transition-all"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                </div>
            </>
        </div>
    );
};

export default ChatPanel;
