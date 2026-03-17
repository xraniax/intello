import React, { useState } from 'react';
import { PanelRightClose, MessageSquarePlus } from 'lucide-react';

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
            <div className="panel-header">
                <span className="panel-title">AI Tutor</span>
                <div className="flex items-center gap-3">
                    {isThinking && (
                        <span className="text-xs text-blue-600 anim-pulse">Thinking...</span>
                    )}
                    <button
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        onClick={onClearChat}
                        title="Start a new chat"
                    >
                        <MessageSquarePlus className="w-4 h-4" />
                    </button>
                    <button
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
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
                <div className="chat-messages">
                    {messages.length === 0 && (
                        <div className="empty-state h-full flex items-center justify-center">
                            <p>Ask a question about your selected documents.</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} className={`chat-message chat-message--${msg.role}`}>
                            <div className="chat-bubble">
                                <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                                {msg.role === 'ai' && (
                                    <button
                                        onClick={() => handleTTS(msg.content)}
                                        className="text-xs text-blue-600 hover:underline mt-1 block"
                                    >
                                        Read aloud
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {chatError && (
                        <p className="text-red-600 text-xs text-center px-3">{chatError}</p>
                    )}

                    <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="chat-input-area">
                    <form onSubmit={handleChat} className="flex gap-1">
                        <button
                            type="button"
                            onClick={handleVoiceInput}
                            className={`chat-mic-btn ${isListening ? 'chat-mic-btn--active' : ''}`}
                        >
                            {isListening ? '⏹' : '🎤'}
                        </button>
                        <input
                            className="input-field text-sm"
                            placeholder="Ask a question..."
                            value={currentQuestion}
                            onChange={(e) => setCurrentQuestion(e.target.value)}
                        />
                        <button
                            type="submit"
                            disabled={isThinking || !currentQuestion.trim()}
                            className="btn-primary text-sm px-3"
                        >
                            Send
                        </button>
                    </form>
                </div>
            </>
        </div>
    );
};

export default ChatPanel;
